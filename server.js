/**
 * GorAgent — Node.js сервер
 * Проксирует запросы к OpenAI API и OpenRouter API
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== Конфигурация OpenAI =====
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// ===== Конфигурация OpenRouter =====
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Доступные модели OpenRouter
const OPENROUTER_MODELS = {
    'anthropic/claude-sonnet-4': 'Claude Sonnet 4 (Anthropic)',
    'anthropic/claude-3.5-haiku': 'Claude 3.5 Haiku (Anthropic)',
    'openai/gpt-4o': 'GPT-4o (OpenAI)',
    'openai/gpt-4o-mini': 'GPT-4o Mini (OpenAI)',
    'google/gemini-2.0-flash-001': 'Gemini 2.0 Flash (Google)',
    'google/gemini-2.5-pro-preview': 'Gemini 2.5 Pro Preview (Google)',
    'meta-llama/llama-3.3-70b-instruct': 'Llama 3.3 70B (Meta)',
    'mistralai/mistral-large-2411': 'Mistral Large 24.11',
    'deepseek/deepseek-chat': 'DeepSeek Chat',
    'qwen/qwen-2.5-72b-instruct': 'Qwen 2.5 72B (Alibaba)'
};

// Retry конфигурация
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 секунда

// ===== Конфигурация MCP =====
const MCP_SERVERS = {
    weather: {
        url: 'http://localhost:8080',
        name: 'Weather MCP',
        enabled: true
    },
    formatter: {
        url: 'http://localhost:8082',
        name: 'Formatter MCP',
        enabled: true
    },
    filesaver: {
        url: 'http://localhost:8081',
        name: 'FileSaver MCP',
        enabled: true
    },
    android: {
        url: 'http://localhost:8083',
        name: 'Android Emulator MCP',
        enabled: true
    }
};

// Для обратной совместимости
const MCP_SERVER_URL = MCP_SERVERS.weather.url;
const MCP_ENABLED = Object.values(MCP_SERVERS).some(s => s.enabled);

// ===== Конфигурация сжатия истории =====
const COMPRESSION_THRESHOLD = 10; // Каждые N сообщений делаем summary
const SUMMARY_PROMPT = `Ты — эксперт по сжатию диалогов. Твоя задача — создать краткое, но информативное резюме разговора.

ПРАВИЛА:
1. Сохрани ВСЕ важные факты, предпочтения и детали, которые пользователь сообщил
2. Сохрани контекст и настроение разговора
3. Используй структурированный формат
4. Не теряй критическую информацию для продолжения диалога
5. Резюме должно быть на русском языке

Ответ верни в формате:
### Резюме диалога
**Пользователь сообщил:**
- [ключевые факты и предпочтения]

**Обсуждалось:**
- [основные темы разговора]

**Важный контекст:**
- [что нужно помнить для продолжения]`;

// Статистика сжатия (in-memory для демо)
let compressionStats = {
    totalCompressions: 0,
    totalTokensSaved: 0,
    lastCompressionTime: null
};

// Кэш для инструментов MCP
let mcpToolsCache = [];
let mcpToolsCacheTime = 0;
const MCP_TOOLS_CACHE_TTL = 60000; // 1 минута (уменьшено для частого обновления)

// ===== Инициализация MCP Agent =====
const MCPAgent = require('./mcp-agent');
const mcpAgent = new MCPAgent();

// ===== Инициализация MCP Multi-Agent =====
const MCPMultiAgent = require('./mcp-multi-agent');
const mcpMultiAgent = new MCPMultiAgent({
    weatherUrl: MCP_SERVERS.weather.url,
    formatterUrl: MCP_SERVERS.formatter.url,
    fileSaverUrl: MCP_SERVERS.filesaver.url,
    androidUrl: MCP_SERVERS.android.url
});

// Функция для получения актуального system prompt с инструментами
async function getSystemPromptWithTools(basePrompt) {
    if (!MCP_ENABLED) {
        return basePrompt;
    }

    // Проверяем кэш инструментов
    const now = Date.now();
    if (now - mcpToolsCacheTime > MCP_TOOLS_CACHE_TTL) {
        mcpToolsCache = await getMCPTools();
        mcpToolsCacheTime = now;
    }

    if (mcpToolsCache.length === 0) {
        return basePrompt;
    }

    // Формируем описание инструментов для system prompt
    const toolsDescription = mcpToolsCache.map(tool => {
        const props = tool.inputSchema?.properties || {};
        const required = tool.inputSchema?.required || [];
        const params = Object.keys(props).map(key => {
            const param = props[key];
            const requiredMark = required.includes(key) ? ' (обязательный)' : ' (опциональный)';
            return `  - ${key}: ${param.description}${requiredMark}`;
        }).join('\n');

        return `### ${tool.name}
${tool.description}

Параметры:
${params}`;
    }).join('\n\n');

    // Добавляем инструкции по использованию инструментов
    const toolsInstructions = `
## Доступные инструменты

У тебя есть доступ к следующим инструментам через MCP (Model Context Protocol):

${toolsDescription}

### Как использовать инструменты:

1. **Анализируй запрос пользователя** - определи, нужен ли инструмент для ответа
2. **Если инструмент нужен** - используй специальный формат вызова инструмента
3. **Формат вызова инструмента:**
   - Пиши ТОЛЬКО JSON объект в квадратных скобках: [{"tool_call": {"name": "tool_name", "arguments": {...}}}]
   - tool_name - имя инструмента
   - arguments - объект с параметрами инструмента
4. **После получения результата** - используй его в своем ответе пользователю

### Примеры использования инструментов:

Если пользователь спрашивает погоду:
[{"tool_call": {"name": "get_weather", "arguments": {"city": "Москва"}}}]

Если пользователь просит найти информацию:
[{"tool_call": {"name": "search_web", "arguments": {"query": "тема поиска"}}}]

### Важно:
- Вызывай инструменты ТОЛЬКО когда это действительно необходимо
- Используй результаты инструментов в своем ответе
- Продолжай диалог естественно после получения результатов инструментов
`;

    return basePrompt + '\n\n' + toolsInstructions;
}

// Дефолтное системное сообщение для агента (используется если клиент не прислал своё)
const DEFAULT_SYSTEM_PROMPT = `Ты — GorAgent, универсальный AI помощник с доступом к различным инструментам.

У тебя есть доступ к следующим категориям инструментов:
- 📱 Android эмуляторы: управление Android эмуляторами (запуск, остановка, скриншоты, установка APK)
- 🌤️ Погода: получение информации о погоде
- 💾 Файлы: сохранение и форматирование данных

Твоя задача:
1. Понять запрос пользователя
2. Определить, нужен ли для выполнения запроса какой-то инструмент
3. Если нужен — вызвать соответствующий инструмент в формате:
   [{"tool_call": {"name": "имя_инструмента", "arguments": {...}}}]
4. После получения результата — сформулировать понятный ответ пользователю на русском языке

Примеры использования инструментов:

🔹 Для Android эмуляторов:
- "покажи список эмуляторов" → [{"tool_call": {"name": "android__list_emulators", "arguments": {}}}]
- "запусти эмулятор Small_Phone" → [{"tool_call": {"name": "android__start_emulator", "arguments": {"name": "Small_Phone"}}}]
- "сделай скриншот" → [{"tool_call": {"name": "android__take_screenshot", "arguments": {}}}]
- "какой эмулятор запущен" → [{"tool_call": {"name": "android__get_emulator_status", "arguments": {}}}]

Отвечай на русском языке, будь кратким и полезным. Используй эмодзи где уместно.

Ответ возвращай ТОЛЬКО в формате JSON без дополнительной разметки:
{"message": "сообщение пользователя", "answer": "твой ответ"}
Где message - это сообщение от пользователя, answer - это твой ответ на это сообщение.`;

// Функция задержки
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ===== Функции для работы с MCP =====

// Получение списка инструментов от всех MCP серверов
async function getMCPTools() {
    if (!MCP_ENABLED) return [];

    const allTools = [];

    for (const [serverKey, serverConfig] of Object.entries(MCP_SERVERS)) {
        if (!serverConfig.enabled) continue;

        try {
            const response = await fetch(`${serverConfig.url}/tools`);
            if (!response.ok) {
                console.warn(`[MCP] ${serverConfig.name}: не удалось получить инструменты (${response.status})`);
                continue;
            }
            
            const tools = await response.json();
            
            // Добавляем префикс к каждому инструменту для идентификации сервера
            const toolsWithPrefix = tools.map(tool => ({
                ...tool,
                name: `${serverKey}__${tool.name}`, // Префикс сервера
                _originalName: tool.name,
                _server: serverKey,
                _serverUrl: serverConfig.url,
                _serverName: serverConfig.name,
                description: `[${serverConfig.name}] ${tool.description}`
            }));
            
            allTools.push(...toolsWithPrefix);
            console.log(`[MCP] ${serverConfig.name}: получено ${tools.length} инструмент(ов)`);
        } catch (error) {
            console.warn(`[MCP] ${serverConfig.name}: ошибка - ${error.message}`);
        }
    }

    console.log(`[MCP] Всего получено инструментов: ${allTools.length}`);
    return allTools;
}

// Выполнение инструмента через MCP сервер
async function executeMCPTool(toolName, arguments) {
    if (!MCP_ENABLED) {
        throw new Error('MCP интеграция отключена');
    }

    try {
        // Разбираем имя инструмента: serverKey__originalToolName
        let serverUrl = MCP_SERVER_URL; // по умолчанию для обратной совместимости
        let originalToolName = toolName;
        let serverName = 'MCP Server';

        if (toolName.includes('__')) {
            const [serverKey, ...nameParts] = toolName.split('__');
            originalToolName = nameParts.join('__');
            
            const serverConfig = MCP_SERVERS[serverKey];
            if (serverConfig && serverConfig.enabled) {
                serverUrl = serverConfig.url;
                serverName = serverConfig.name;
            } else {
                throw new Error(`MCP сервер "${serverKey}" не найден или отключен`);
            }
        }

        console.log(`[MCP] Выполнение: ${serverName}.${originalToolName}`);

        const response = await fetch(`${serverUrl}/tools/execute`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: originalToolName,
                arguments: arguments
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `${serverName} error: ${response.status}`);
        }

        const result = await response.json();
        console.log(`[MCP] ${serverName}.${originalToolName} успешно выполнен`);
        return result;
    } catch (error) {
        console.error('[MCP] Ошибка выполнения инструмента:', error);
        throw error;
    }
}

// Обработка tool calls в ответе модели
async function processToolCalls(responseText, provider = 'openai', model = null, temperature = 0.7) {
    try {
        const toolCalls = [];

        // Функция для извлечения tool_call из объекта
        const extractToolCall = (parsed) => {
            let toolCallObj = null;
            
            // Формат: {"tool_call": {"name": "...", "arguments": {...}}}
            if (parsed.tool_call && parsed.tool_call.name) {
                toolCallObj = parsed.tool_call;
            }
            // Формат: [{"tool_call": {"name": "...", "arguments": {...}}}]
            else if (Array.isArray(parsed) && parsed[0]?.tool_call) {
                toolCallObj = parsed[0].tool_call;
            }
            // Формат: {"name": "...", "arguments": {...}}
            else if (parsed.name && parsed.arguments) {
                toolCallObj = parsed;
            }
            
            if (toolCallObj && toolCallObj.name) {
                toolCalls.push({
                    name: toolCallObj.name,
                    arguments: toolCallObj.arguments || {}
                });
            }
        };

        // Шаг 1: Пробуем парсить весь ответ как JSON (без markdown)
        try {
            const directParsed = JSON.parse(responseText.trim());
            extractToolCall(directParsed);
        } catch (e) {
            // Не JSON напрямую, продолжаем с другими методами
        }

        // Шаг 2: Извлекаем JSON из markdown блоков ```json ... ```
        if (toolCalls.length === 0) {
            const markdownJsonRegex = /```(?:json)?\s*\n?([\s\S]*?)\n?```/g;
            let jsonMatch;
            
            while ((jsonMatch = markdownJsonRegex.exec(responseText)) !== null) {
                try {
                    const jsonStr = jsonMatch[1].trim();
                    const parsed = JSON.parse(jsonStr);
                    extractToolCall(parsed);
                } catch (e) {
                    console.warn('[Tool Call] Ошибка парсинга JSON из markdown:', e.message);
                }
            }
        }

        if (toolCalls.length === 0) {
            return null; // Нет tool calls
        }

        console.log('[Tool Call] Найдены tool calls:', toolCalls.length);

        // Выполняем все tool calls
        const toolResults = [];
        for (const toolCall of toolCalls) {
            try {
                console.log(`[Tool Call] Выполняю инструмент: ${toolCall.name}`, toolCall.arguments);
                const result = await executeMCPTool(toolCall.name, toolCall.arguments);
                toolResults.push({
                    tool_call: toolCall,
                    result: result,
                    success: true
                });
            } catch (error) {
                console.error(`[Tool Call] Ошибка выполнения инструмента ${toolCall.name}:`, error.message);
                toolResults.push({
                    tool_call: toolCall,
                    error: error.message,
                    success: false
                });
            }
        }

        // Формируем сообщение с результатами для модели
        const toolResultsMessage = toolResults.map((tr, i) => {
            const toolCall = tr.tool_call;
            if (tr.success) {
                return `Инструмент ${i + 1} (${toolCall.name}): Выполнен успешно\nРезультат: ${JSON.stringify(tr.result)}`;
            } else {
                return `Инструмент ${i + 1} (${toolCall.name}): Ошибка выполнения\nОшибка: ${tr.error}`;
            }
        }).join('\n\n');

        // Создаем новый запрос к модели с результатами инструментов
        const followUpMessages = [
            {
                role: 'system',
                content: await getSystemPromptWithTools('Ты получил результаты выполнения инструментов. Используй эту информацию в своем ответе пользователю. Ответь на русском языке в формате JSON.')
            },
            {
                role: 'user',
                content: `Результаты выполнения инструментов:\n\n${toolResultsMessage}\n\nТеперь дай окончательный ответ пользователю на основе этих результатов.`
            }
        ];

        let followUpResponse;
        if (provider === 'openai' && OPENAI_API_KEY) {
            followUpResponse = await callOpenAI(followUpMessages, temperature);
        } else if (provider === 'openrouter' && OPENROUTER_API_KEY) {
            followUpResponse = await callOpenRouter(followUpMessages, model || 'openai/gpt-4o-mini', temperature);
        } else {
            throw new Error('Нет доступного API провайдера для follow-up запроса');
        }

        if (!followUpResponse.ok) {
            throw new Error('Ошибка при follow-up запросе к модели');
        }

        const followUpData = await followUpResponse.json();
        const finalAnswer = followUpData.choices?.[0]?.message?.content || 'Не удалось получить ответ после выполнения инструментов.';

        return {
            originalResponse: responseText,
            toolResults: toolResults,
            finalAnswer: finalAnswer
        };

    } catch (error) {
        console.error('[Tool Call] Ошибка обработки tool calls:', error);
        return null;
    }
}

// ===== Функция оценки токенов (приблизительная) =====
function estimateTokens(text) {
    if (!text) return 0;
    // Приблизительная оценка: ~4 символа = 1 токен для русского текста
    // Для английского ~4 символа = 1 токен
    return Math.ceil(text.length / 3.5);
}

// ===== Функция создания summary истории =====
async function createHistorySummary(history, provider = 'openai', model = null) {
    if (history.length === 0) return null;
    
    // Формируем текст истории для сжатия
    const historyText = history.map((msg, i) => {
        const role = msg.role === 'user' ? 'Пользователь' : 'Ассистент';
        return `${role}: ${msg.content}`;
    }).join('\n\n');
    
    const messages = [
        { role: 'system', content: SUMMARY_PROMPT },
        { role: 'user', content: `Создай резюме следующего диалога:\n\n${historyText}` }
    ];
    
    try {
        let response;
        
        if (provider === 'openai' && OPENAI_API_KEY) {
            response = await callOpenAI(messages, 0.3);
        } else if (provider === 'openrouter' && OPENROUTER_API_KEY) {
            const summaryModel = model || 'openai/gpt-4o-mini'; // Используем быструю модель для summary
            response = await callOpenRouter(messages, summaryModel, 0.3);
        } else {
            console.warn('[Summary] Нет доступного API для создания summary');
            return null;
        }
        
        if (!response.ok) {
            console.error('[Summary] Ошибка API при создании summary');
            return null;
        }
        
        const data = await response.json();
        const summary = data.choices?.[0]?.message?.content;
        
        if (summary) {
            const originalTokens = estimateTokens(historyText);
            const summaryTokens = estimateTokens(summary);
            const tokensSaved = originalTokens - summaryTokens;
            
            compressionStats.totalCompressions++;
            compressionStats.totalTokensSaved += Math.max(0, tokensSaved);
            compressionStats.lastCompressionTime = new Date().toISOString();
            
            console.log('\n' + '🗜️'.repeat(20));
            console.log(`[${new Date().toISOString()}] ИСТОРИЯ СЖАТА`);
            console.log('🗜️'.repeat(20));
            console.log(`Оригинальных сообщений: ${history.length}`);
            console.log(`Оригинальный размер: ~${originalTokens} токенов`);
            console.log(`Размер summary: ~${summaryTokens} токенов`);
            console.log(`Сэкономлено: ~${tokensSaved} токенов (${((tokensSaved/originalTokens)*100).toFixed(1)}%)`);
            console.log('🗜️'.repeat(20) + '\n');
            
            return {
                summary,
                originalCount: history.length,
                originalTokens,
                summaryTokens,
                tokensSaved,
                compressionRatio: ((tokensSaved/originalTokens)*100).toFixed(1)
            };
        }
        
        return null;
    } catch (error) {
        console.error('[Summary] Ошибка при создании summary:', error);
        return null;
    }
}

// ===== Функция проверки необходимости сжатия =====
function shouldCompress(history, threshold = COMPRESSION_THRESHOLD) {
    return history.length >= threshold;
}

// Функция запроса к OpenAI с retry
async function callOpenAI(messages, temperature = 0.7, retryCount = 0) {
    const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: OPENAI_MODEL,
            messages,
            max_tokens: 8192,
            temperature: temperature,
            //response_format: { type: "json_object" },
        }),
    });

    // Если ошибка 429 (rate limit) и есть попытки — ждём и повторяем
    if (response.status === 429 && retryCount < MAX_RETRIES) {
        const retryAfter = response.headers.get('retry-after');
        const delay = retryAfter 
            ? parseInt(retryAfter) * 1000 
            : INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
        
        console.log(`[Rate Limit] Ожидание ${delay}ms перед повторной попыткой (${retryCount + 1}/${MAX_RETRIES})...`);
        await sleep(delay);
        return callOpenAI(messages, temperature, retryCount + 1);
    }

    return response;
}

// Функция запроса к OpenRouter с retry
async function callOpenRouter(messages, model, temperature = 0.7, retryCount = 0) {
    // Лимит токенов (зависит от доступных кредитов на OpenRouter)
    // Для моделей с reasoning может понадобиться больше
    const maxTokens = 4096;
    
    const response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'http://localhost:3000',
            'X-Title': 'GorAgent'
        },
        body: JSON.stringify({
            model: model,
            messages,
            max_tokens: maxTokens,
            temperature: temperature,
        }),
    });

    // Если ошибка 429 (rate limit) и есть попытки — ждём и повторяем
    if (response.status === 429 && retryCount < MAX_RETRIES) {
        const retryAfter = response.headers.get('retry-after');
        const delay = retryAfter 
            ? parseInt(retryAfter) * 1000 
            : INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
        
        console.log(`[OpenRouter Rate Limit] Ожидание ${delay}ms перед повторной попыткой (${retryCount + 1}/${MAX_RETRIES})...`);
        await sleep(delay);
        return callOpenRouter(messages, model, temperature, retryCount + 1);
    }

    return response;
}

// ===== Middleware =====
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname)));

// ===== Маршруты =====

// Главная страница
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Страница демо MCP цепочки
app.get('/mcp-demo', (req, res) => {
    res.sendFile(path.join(__dirname, 'mcp-chain-demo.html'));
});

// Страница демо MCP Multi-Agent
app.get('/mcp-multi-demo', (req, res) => {
    res.sendFile(path.join(__dirname, 'mcp-multi-demo.html'));
});

// API для чата
app.post('/api/chat', async (req, res) => {
    try {
        const { message, history = [], systemPrompt, temperature, maxTokens, provider = 'openai' } = req.body;
        
        // Проверка API ключа в зависимости от провайдера
        if (provider === 'openai' && !OPENAI_API_KEY) {
            return res.status(500).json({ 
                error: 'API ключ OpenAI не настроен. Добавьте OPENAI_API_KEY в файл .env' 
            });
        }
        
        if (provider === 'openrouter' && !OPENROUTER_API_KEY) {
            return res.status(500).json({ 
                error: 'API ключ OpenRouter не настроен. Добавьте OPENROUTER_API_KEY в файл .env' 
            });
        }
        
        // Валидация и ограничение temperature (0-2 для OpenAI)
        const parsedTemp = parseFloat(temperature);
        const validTemperature = isNaN(parsedTemp) ? 0.7 : Math.min(2, Math.max(0, parsedTemp));
        
        // Валидация и ограничение max_tokens
        const parsedMaxTokens = parseInt(maxTokens);
        const validMaxTokens = isNaN(parsedMaxTokens) ? 2048 : Math.min(16384, Math.max(256, parsedMaxTokens));

        // Валидация
        if (!message || typeof message !== 'string') {
            return res.status(400).json({ error: 'Сообщение не может быть пустым' });
        }

        if (message.length > 3000) {
            return res.status(400).json({ error: 'Сообщение слишком длинное' });
        }

        // Используем переданный systemPrompt или дефолтный
        let activeSystemPrompt = systemPrompt || DEFAULT_SYSTEM_PROMPT;

        // Добавляем инструменты MCP к system prompt
        activeSystemPrompt = await getSystemPromptWithTools(activeSystemPrompt);
        
        // Логируем используемый System Prompt
        console.log('\n' + '~'.repeat(60));
        console.log(`[${new Date().toISOString()}] АКТИВНЫЙ SYSTEM PROMPT`);
        console.log('~'.repeat(60));
        console.log(activeSystemPrompt.substring(0, 200) + '...');
        console.log('~'.repeat(60) + '\n');

        // Формируем сообщения для OpenAI
        const messages = [
            { role: 'system', content: activeSystemPrompt },
            // Добавляем последние сообщения из истории для контекста
            ...history.slice(-20).map(msg => ({
                role: msg.role,
                content: msg.content
            }))
        ];

        // Если последнее сообщение в истории не от пользователя, добавляем текущее
        if (messages[messages.length - 1]?.role !== 'user') {
            messages.push({ role: 'user', content: message });
        }

        // Логируем структуру запроса
        const requestBody = {
            model: OPENAI_MODEL,
            messages,
            max_tokens: validMaxTokens,
            temperature: validTemperature,
            //response_format: { type: "json_object" },
        };
        
        console.log('\n' + '='.repeat(60));
        console.log(`[${new Date().toISOString()}] ЗАПРОС К OpenAI`);
        console.log('='.repeat(60));
        console.log('Структура запроса:');
        console.log(JSON.stringify(requestBody, null, 2));
        console.log('='.repeat(60) + '\n');

        // Замеряем время запроса
        const startTime = Date.now();
        
        // Запрос к OpenAI API с автоматическим retry
        const response = await callOpenAI(messages, validTemperature);
        
        const responseTime = Date.now() - startTime;

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('OpenAI API Error:', errorData);
            
            // Обработка специфичных ошибок
            if (response.status === 401) {
                return res.status(500).json({ error: 'Недействительный API ключ OpenAI' });
            }
            if (response.status === 429) {
                return res.status(429).json({ 
                    error: 'Превышен лимит запросов OpenAI. Это может быть из-за ограничений вашего API ключа. Подождите минуту и попробуйте снова.' 
                });
            }
            if (response.status === 503) {
                return res.status(503).json({ error: 'Сервис OpenAI временно недоступен' });
            }
            
            return res.status(response.status).json({ 
                error: errorData.error?.message || 'Ошибка при запросе к OpenAI API' 
            });
        }

        const data = await response.json();
        let rawReply = data.choices?.[0]?.message?.content || '{"message": "", "answer": "Не удалось получить ответ."}';

        // Обрабатываем tool calls, если они есть
        const toolCallResult = await processToolCalls(rawReply, 'openai', null, validTemperature);
        if (toolCallResult) {
            console.log('[Tool Call] Обнаружены tool calls, выполняем...');
            rawReply = toolCallResult.finalAnswer;
        }

        // Логируем сырой ответ от OpenAI
        console.log('\n' + '='.repeat(60));
        console.log(`[${new Date().toISOString()}] ОТВЕТ ОТ OpenAI`);
        console.log('='.repeat(60));
        console.log('Сырой ответ от API:');
        console.log(JSON.stringify(data, null, 2));
        console.log('-'.repeat(60));
        console.log('Контент сообщения (rawReply):');
        console.log(rawReply);
        console.log('='.repeat(60) + '\n');

        // Парсим JSON ответ от модели
        let parsedReply;
        try {
            parsedReply = JSON.parse(rawReply);
        } catch (e) {
            // Это нормально - модель может вернуть обычный текст вместо JSON
            console.log('[Info] Модель вернула текст вместо JSON, используем как есть');
            parsedReply = { message: message, answer: rawReply };
        }

        // Извлекаем метаданные usage
        const usage = data.usage || {};
        const promptTokens = usage.prompt_tokens || 0;
        const completionTokens = usage.completion_tokens || 0;
        const totalTokens = usage.total_tokens || 0;
        
        // Расчёт стоимости для OpenAI (примерные цены для gpt-4.1-mini)
        // gpt-4.1-mini: $0.40/1M input, $1.60/1M output
        const inputCost = (promptTokens / 1000000) * 0.40;
        const outputCost = (completionTokens / 1000000) * 1.60;
        const totalCost = inputCost + outputCost;

        // Логируем распарсенный ответ
        console.log('\n' + '='.repeat(60));
        console.log(`[${new Date().toISOString()}] РАСПАРСЕННЫЙ ОТВЕТ`);
        console.log('='.repeat(60));
        console.log('Время ответа:', responseTime, 'ms');
        console.log('Токены:', { promptTokens, completionTokens, totalTokens });
        console.log('Стоимость:', totalCost.toFixed(6), 'USD');
        console.log('Отправляем клиенту:');
        console.log(JSON.stringify(parsedReply, null, 2));
        console.log('='.repeat(60) + '\n');

        // Добавляем метаданные к ответу
        res.json({
            ...parsedReply,
            _meta: {
                responseTime,
                tokens: {
                    prompt: promptTokens,
                    completion: completionTokens,
                    total: totalTokens
                },
                cost: totalCost,
                model: OPENAI_MODEL,
                provider: 'openai',
                maxTokens: validMaxTokens
            }
        });

    } catch (error) {
        console.error('Server Error:', error);
        res.status(500).json({ 
            error: 'Внутренняя ошибка сервера. Попробуйте позже.' 
        });
    }
});

// API для чата через OpenRouter
app.post('/api/chat/openrouter', async (req, res) => {
    try {
        // Проверка API ключа
        if (!OPENROUTER_API_KEY) {
            return res.status(500).json({ 
                error: 'API ключ OpenRouter не настроен' 
            });
        }

        const { message, history = [], systemPrompt, temperature, model, maxTokens } = req.body;
        
        // Валидация модели
        const selectedModel = model || 'anthropic/claude-sonnet-4';
        
        // Валидация и ограничение temperature (0-2)
        const parsedTemp = parseFloat(temperature);
        const validTemperature = isNaN(parsedTemp) ? 0.7 : Math.min(2, Math.max(0, parsedTemp));
        
        // Валидация и ограничение max_tokens
        const parsedMaxTokens = parseInt(maxTokens);
        const validMaxTokens = isNaN(parsedMaxTokens) ? 2048 : Math.min(16384, Math.max(256, parsedMaxTokens));

        // Валидация
        if (!message || typeof message !== 'string') {
            return res.status(400).json({ error: 'Сообщение не может быть пустым' });
        }

        if (message.length > 3000) {
            return res.status(400).json({ error: 'Сообщение слишком длинное' });
        }

        // Используем переданный systemPrompt или дефолтный
        let activeSystemPrompt = systemPrompt || DEFAULT_SYSTEM_PROMPT;

        // Добавляем инструменты MCP к system prompt
        activeSystemPrompt = await getSystemPromptWithTools(activeSystemPrompt);
        
        // Логируем используемый System Prompt
        console.log('\n' + '~'.repeat(60));
        console.log(`[${new Date().toISOString()}] OPENROUTER - АКТИВНЫЙ SYSTEM PROMPT`);
        console.log('~'.repeat(60));
        console.log('Модель:', selectedModel);
        console.log(activeSystemPrompt.substring(0, 200) + '...');
        console.log('~'.repeat(60) + '\n');

        // Формируем сообщения для OpenRouter
        const messages = [
            { role: 'system', content: activeSystemPrompt },
            ...history.slice(-20).map(msg => ({
                role: msg.role,
                content: msg.content
            }))
        ];

        // Если последнее сообщение в истории не от пользователя, добавляем текущее
        if (messages[messages.length - 1]?.role !== 'user') {
            messages.push({ role: 'user', content: message });
        }

        // Логируем структуру запроса
        const requestBody = {
            model: selectedModel,
            messages,
            max_tokens: validMaxTokens,
            temperature: validTemperature,
        };
        
        console.log('\n' + '='.repeat(60));
        console.log(`[${new Date().toISOString()}] ЗАПРОС К OpenRouter`);
        console.log('='.repeat(60));
        console.log('Структура запроса:');
        console.log(JSON.stringify(requestBody, null, 2));
        console.log('='.repeat(60) + '\n');

        // Замеряем время запроса
        const startTime = Date.now();
        
        // Запрос к OpenRouter API с автоматическим retry
        const response = await callOpenRouter(messages, selectedModel, validTemperature);
        
        const responseTime = Date.now() - startTime;

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('OpenRouter API Error:', errorData);
            
            // Обработка специфичных ошибок
            if (response.status === 401) {
                return res.status(500).json({ error: 'Недействительный API ключ OpenRouter' });
            }
            if (response.status === 429) {
                return res.status(429).json({ 
                    error: 'Превышен лимит запросов OpenRouter. Подождите минуту и попробуйте снова.' 
                });
            }
            if (response.status === 503) {
                return res.status(503).json({ error: 'Сервис OpenRouter временно недоступен' });
            }
            
            return res.status(response.status).json({ 
                error: errorData.error?.message || 'Ошибка при запросе к OpenRouter API' 
            });
        }

        const data = await response.json();
        let rawReply = data.choices?.[0]?.message?.content || '{"message": "", "answer": "Не удалось получить ответ."}';

        // Обрабатываем tool calls, если они есть
        const toolCallResult = await processToolCalls(rawReply, 'openrouter', selectedModel, validTemperature);
        if (toolCallResult) {
            console.log('[Tool Call] Обнаружены tool calls, выполняем...');
            rawReply = toolCallResult.finalAnswer;
        }

        // Логируем сырой ответ от OpenRouter
        console.log('\n' + '='.repeat(60));
        console.log(`[${new Date().toISOString()}] ОТВЕТ ОТ OpenRouter`);
        console.log('='.repeat(60));
        console.log('Сырой ответ от API:');
        console.log(JSON.stringify(data, null, 2));
        console.log('-'.repeat(60));
        console.log('Контент сообщения (rawReply):');
        console.log(rawReply);
        console.log('='.repeat(60) + '\n');

        // Парсим JSON ответ от модели (если это JSON)
        let parsedReply;
        try {
            // Сначала пробуем распарсить как чистый JSON
            const trimmedReply = rawReply.trim();
            if (trimmedReply.startsWith('{') && trimmedReply.endsWith('}')) {
                parsedReply = JSON.parse(trimmedReply);
            } else {
                // Пытаемся найти JSON в ответе
                const jsonMatch = rawReply.match(/\{[^{}]*"message"\s*:\s*"[^"]*"[^{}]*"answer"\s*:\s*"[\s\S]*?"[^{}]*\}/);
                if (jsonMatch) {
                    parsedReply = JSON.parse(jsonMatch[0]);
                } else {
                    // Модель вернула обычный текст — используем как есть
                    parsedReply = { message: message, answer: rawReply };
                }
            }
        } catch (e) {
            // Это нормально - модель может вернуть обычный текст вместо JSON
            console.log('[Info] Модель вернула текст вместо JSON, используем как есть');
            parsedReply = { message: message, answer: rawReply };
        }

        // Извлекаем метаданные usage
        const usage = data.usage || {};
        const promptTokens = usage.prompt_tokens || 0;
        const completionTokens = usage.completion_tokens || 0;
        const totalTokens = usage.total_tokens || 0;
        
        // OpenRouter возвращает стоимость напрямую или её можно взять из usage
        // Если нет - считаем по примерным ценам
        let totalCost = 0;
        if (usage.total_cost !== undefined) {
            totalCost = usage.total_cost;
        } else if (data.usage?.cost !== undefined) {
            totalCost = data.usage.cost;
        } else {
            // Примерный расчёт (OpenRouter обычно возвращает стоимость)
            // Средние цены: $0.001/1K input, $0.002/1K output
            totalCost = (promptTokens / 1000) * 0.001 + (completionTokens / 1000) * 0.002;
        }

        // Логируем распарсенный ответ
        console.log('\n' + '='.repeat(60));
        console.log(`[${new Date().toISOString()}] РАСПАРСЕННЫЙ ОТВЕТ (OpenRouter)`);
        console.log('='.repeat(60));
        console.log('Время ответа:', responseTime, 'ms');
        console.log('Токены:', { promptTokens, completionTokens, totalTokens });
        console.log('Стоимость:', totalCost.toFixed(6), 'USD');
        console.log('Отправляем клиенту:');
        console.log(JSON.stringify(parsedReply, null, 2));
        console.log('='.repeat(60) + '\n');

        // Добавляем метаданные к ответу
        res.json({
            ...parsedReply,
            _meta: {
                responseTime,
                tokens: {
                    prompt: promptTokens,
                    completion: completionTokens,
                    total: totalTokens
                },
                cost: totalCost,
                model: selectedModel,
                provider: 'openrouter',
                maxTokens: validMaxTokens
            }
        });

    } catch (error) {
        console.error('Server Error (OpenRouter):', error);
        res.status(500).json({ 
            error: 'Внутренняя ошибка сервера. Попробуйте позже.' 
        });
    }
});

// Получение списка моделей OpenRouter
app.get('/api/openrouter/models', (req, res) => {
    res.json({
        models: OPENROUTER_MODELS,
        hasApiKey: !!OPENROUTER_API_KEY
    });
});

// Получение списка MCP инструментов
app.get('/api/mcp/tools', async (req, res) => {
    try {
        // Параметр refresh для принудительного обновления
        const refresh = req.query.refresh === 'true';
        
        if (refresh) {
            console.log('[API] Принудительное обновление списка MCP инструментов...');
            mcpToolsCache = await getMCPTools();
            mcpToolsCacheTime = Date.now();
        }
        
        const tools = mcpToolsCache.length > 0 ? mcpToolsCache : await getMCPTools();
        
        // Группируем инструменты по серверам
        const toolsByServer = {};
        tools.forEach(tool => {
            const serverKey = tool._server || 'unknown';
            if (!toolsByServer[serverKey]) {
                toolsByServer[serverKey] = {
                    serverName: tool._serverName || 'Unknown',
                    serverUrl: tool._serverUrl || '',
                    tools: []
                };
            }
            toolsByServer[serverKey].tools.push(tool);
        });

        res.json({
            enabled: MCP_ENABLED,
            totalTools: tools.length,
            servers: MCP_SERVERS,
            toolsByServer: toolsByServer,
            tools: tools, // Все инструменты с префиксами
            cached: !refresh && mcpToolsCache.length > 0,
            cacheTime: mcpToolsCacheTime > 0 ? new Date(mcpToolsCacheTime).toISOString() : null
        });
    } catch (error) {
        console.error('[API] Ошибка при получении MCP инструментов:', error);
        res.status(500).json({
            error: 'Не удалось получить список инструментов',
            enabled: MCP_ENABLED,
            servers: MCP_SERVERS,
            tools: []
        });
    }
});

// Принудительное обновление кеша MCP инструментов
app.post('/api/mcp/tools/refresh', async (req, res) => {
    try {
        console.log('[API] Обновление кеша MCP инструментов...');
        mcpToolsCache = await getMCPTools();
        mcpToolsCacheTime = Date.now();
        
        res.json({
            success: true,
            message: 'Кеш инструментов успешно обновлен',
            totalTools: mcpToolsCache.length,
            timestamp: new Date(mcpToolsCacheTime).toISOString()
        });
    } catch (error) {
        console.error('[API] Ошибка обновления кеша:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Выполнение MCP инструмента
app.post('/api/mcp/execute', async (req, res) => {
    try {
        const { toolName, arguments: toolArgs } = req.body;

        if (!toolName) {
            return res.status(400).json({ error: 'Не указан toolName' });
        }

        console.log('[API] Выполнение MCP инструмента:', toolName, toolArgs);

        const result = await executeMCPTool(toolName, toolArgs || {});
        res.json({ result });
    } catch (error) {
        console.error('[API] Ошибка выполнения MCP инструмента:', error);
        res.status(500).json({
            error: error.message || 'Ошибка выполнения инструмента'
        });
    }
});

// ===== API для сжатия истории =====
app.post('/api/compress-history', async (req, res) => {
    try {
        const { history, provider = 'openai', model } = req.body;
        
        if (!history || !Array.isArray(history) || history.length === 0) {
            return res.status(400).json({ error: 'История пуста или не передана' });
        }
        
        console.log('\n' + '📦'.repeat(20));
        console.log(`[${new Date().toISOString()}] ЗАПРОС НА СЖАТИЕ ИСТОРИИ`);
        console.log('📦'.repeat(20));
        console.log(`Сообщений в истории: ${history.length}`);
        console.log(`Провайдер: ${provider}`);
        console.log('📦'.repeat(20) + '\n');
        
        const result = await createHistorySummary(history, provider, model);
        
        if (result) {
            res.json({
                success: true,
                ...result
            });
        } else {
            res.status(500).json({ 
                error: 'Не удалось создать summary',
                success: false 
            });
        }
    } catch (error) {
        console.error('[Compress] Error:', error);
        res.status(500).json({ 
            error: 'Ошибка при сжатии истории',
            success: false 
        });
    }
});

// ===== API для получения статистики сжатия =====
app.get('/api/compression-stats', (req, res) => {
    res.json({
        ...compressionStats,
        threshold: COMPRESSION_THRESHOLD
    });
});

// ===== API для MCP Agent (цепочки инструментов) =====

// Выполнение полной цепочки: поиск → суммаризация → сохранение
app.post('/api/mcp/chain', async (req, res) => {
    try {
        const { query, options = {} } = req.body;

        if (!query || typeof query !== 'string') {
            return res.status(400).json({ error: 'Не указан query для поиска' });
        }

        console.log('[API] Запуск MCP цепочки:', query);

        const result = await mcpAgent.executeChain(query, options);

        res.json(result);
    } catch (error) {
        console.error('[API] Ошибка выполнения MCP цепочки:', error);
        res.status(500).json({
            error: error.message || 'Ошибка выполнения цепочки'
        });
    }
});

// Получение списка доступных MCP инструментов (из локального агента)
app.get('/api/mcp/agent-tools', (req, res) => {
    try {
        const tools = mcpAgent.getTools();
        res.json({
            tools,
            count: tools.length
        });
    } catch (error) {
        console.error('[API] Ошибка получения инструментов:', error);
        res.status(500).json({
            error: error.message
        });
    }
});

// Получение истории выполнения цепочек
app.get('/api/mcp/history', (req, res) => {
    try {
        const history = mcpAgent.getExecutionHistory();
        res.json({
            history,
            count: history.length
        });
    } catch (error) {
        console.error('[API] Ошибка получения истории:', error);
        res.status(500).json({
            error: error.message
        });
    }
});

// Получение статистики выполнения
app.get('/api/mcp/stats', (req, res) => {
    try {
        const stats = mcpAgent.getStats();
        res.json(stats);
    } catch (error) {
        console.error('[API] Ошибка получения статистики:', error);
        res.status(500).json({
            error: error.message
        });
    }
});

// Получение списка сохраненных файлов
app.get('/api/mcp/files', async (req, res) => {
    try {
        const files = await mcpAgent.getSavedFiles();
        res.json({
            files,
            count: files.length
        });
    } catch (error) {
        console.error('[API] Ошибка получения файлов:', error);
        res.status(500).json({
            error: error.message
        });
    }
});

// Чтение конкретного сохраненного файла
app.get('/api/mcp/files/:filename', async (req, res) => {
    try {
        const { filename } = req.params;
        const file = await mcpAgent.readFile(filename);
        res.json(file);
    } catch (error) {
        console.error('[API] Ошибка чтения файла:', error);
        res.status(500).json({
            error: error.message
        });
    }
});

// Выполнение отдельного MCP инструмента через агента
app.post('/api/mcp/tool', async (req, res) => {
    try {
        const { toolName, args = {} } = req.body;

        if (!toolName) {
            return res.status(400).json({ error: 'Не указан toolName' });
        }

        console.log('[API] Выполнение MCP инструмента через агента:', toolName, args);

        const result = await mcpAgent.executeTool(toolName, args);
        res.json({ result });
    } catch (error) {
        console.error('[API] Ошибка выполнения инструмента:', error);
        res.status(500).json({
            error: error.message
        });
    }
});

// ===== API для MCP Multi-Agent (работа с несколькими MCP серверами) =====

// Запуск цепочки погоды: Weather MCP → Formatter MCP → FileSaver MCP
app.post('/api/mcp-multi/weather-chain', async (req, res) => {
    try {
        const { city, options = {} } = req.body;

        if (!city) {
            return res.status(400).json({ error: 'Не указан город (city)' });
        }

        console.log('[API Multi] Запуск цепочки погоды для города:', city);

        const result = await mcpMultiAgent.executeWeatherChain(city, options);

        res.json(result);
    } catch (error) {
        console.error('[API Multi] Ошибка выполнения цепочки:', error);
        res.status(500).json({
            error: error.message || 'Ошибка выполнения цепочки'
        });
    }
});

// Проверка доступности всех MCP серверов
app.get('/api/mcp-multi/check-servers', async (req, res) => {
    try {
        const status = await mcpMultiAgent.checkAllServers();
        res.json(status);
    } catch (error) {
        console.error('[API Multi] Ошибка проверки серверов:', error);
        res.status(500).json({
            error: error.message
        });
    }
});

// Получение всех tools от всех MCP серверов
app.get('/api/mcp-multi/all-tools', async (req, res) => {
    try {
        const tools = await mcpMultiAgent.getAllTools();
        res.json(tools);
    } catch (error) {
        console.error('[API Multi] Ошибка получения tools:', error);
        res.status(500).json({
            error: error.message
        });
    }
});

// Статистика multi-agent
app.get('/api/mcp-multi/stats', (req, res) => {
    try {
        const stats = mcpMultiAgent.getStats();
        res.json(stats);
    } catch (error) {
        console.error('[API Multi] Ошибка получения статистики:', error);
        res.status(500).json({
            error: error.message
        });
    }
});

// История выполнения multi-agent
app.get('/api/mcp-multi/history', (req, res) => {
    try {
        const history = mcpMultiAgent.getExecutionHistory();
        res.json({
            history,
            count: history.length
        });
    } catch (error) {
        console.error('[API Multi] Ошибка получения истории:', error);
        res.status(500).json({
            error: error.message
        });
    }
});

// Проверка статуса сервера
app.get('/api/health', async (req, res) => {
    try {
        const mcpTools = await getMCPTools();
        const mcpAgentStats = mcpAgent.getStats();
        const mcpAgentTools = mcpAgent.getTools();
        
        // Проверяем доступность каждого MCP сервера
        const serversStatus = {};
        for (const [key, config] of Object.entries(MCP_SERVERS)) {
            try {
                const response = await fetch(`${config.url}/health`, { 
                    signal: AbortSignal.timeout(3000) 
                });
                serversStatus[key] = {
                    ...config,
                    available: response.ok,
                    status: response.ok ? 'online' : 'offline'
                };
            } catch (error) {
                serversStatus[key] = {
                    ...config,
                    available: false,
                    status: 'offline',
                    error: error.message
                };
            }
        }
        
        res.json({
            status: 'ok',
            model: OPENAI_MODEL,
            hasApiKey: !!OPENAI_API_KEY,
            openrouter: {
                hasApiKey: !!OPENROUTER_API_KEY,
                modelsCount: Object.keys(OPENROUTER_MODELS).length
            },
            mcp: {
                enabled: MCP_ENABLED,
                serversCount: Object.keys(MCP_SERVERS).length,
                servers: serversStatus,
                totalTools: mcpTools.length
            },
            mcpAgent: {
                enabled: true,
                toolsCount: mcpAgentTools.length,
                stats: mcpAgentStats
            }
        });
    } catch (error) {
        res.json({
            status: 'ok',
            model: OPENAI_MODEL,
            hasApiKey: !!OPENAI_API_KEY,
            openrouter: {
                hasApiKey: !!OPENROUTER_API_KEY,
                modelsCount: Object.keys(OPENROUTER_MODELS).length
            },
            mcp: {
                enabled: MCP_ENABLED,
                servers: MCP_SERVERS,
                toolsCount: 0,
                error: 'Не удалось проверить MCP серверы'
            },
            mcpAgent: {
                enabled: true,
                toolsCount: 3,
                stats: mcpAgent.getStats()
            }
        });
    }
});

// ===== Запуск сервера =====
app.listen(PORT, async () => {
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                                                            ║');
    console.log('║   🤖 GorAgent запущен!                                     ║');
    console.log('║                                                            ║');
    console.log(`║   🌐 Откройте: http://localhost:${PORT}                       ║`);
    console.log('║                                                            ║');
    console.log('║   📡 API Провайдеры:                                       ║');
    console.log(`║   • OpenAI:     ${OPENAI_API_KEY ? '✓ Настроен' : '✗ НЕ НАСТРОЕН'}                            ║`);
    console.log(`║   • OpenRouter: ${OPENROUTER_API_KEY ? '✓ Настроен' : '✗ НЕ НАСТРОЕН'}                            ║`);
    
    // Загружаем MCP инструменты при старте
    if (MCP_ENABLED) {
        console.log('║                                                            ║');
        console.log('║   🔧 Загрузка MCP инструментов...                         ║');
        try {
            mcpToolsCache = await getMCPTools();
            mcpToolsCacheTime = Date.now();
            console.log(`║   ✓ Загружено ${mcpToolsCache.length} MCP инструмент(ов)                     ║`);
        } catch (error) {
            console.log('║   ✗ Ошибка загрузки MCP инструментов                     ║');
        }
    }
    console.log('║                                                            ║');
    console.log(`║   📦 OpenAI модель: ${OPENAI_MODEL.padEnd(33)}║`);
    console.log(`║   📦 OpenRouter моделей: ${String(Object.keys(OPENROUTER_MODELS).length).padEnd(28)}║`);
    console.log('║                                                            ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');
    
    if (!OPENAI_API_KEY && !OPENROUTER_API_KEY) {
        console.log('⚠️  Внимание: Ни один API ключ не настроен!');
        console.log('   Создайте файл .env и добавьте:');
        console.log('   OPENAI_API_KEY=ваш_ключ');
        console.log('   или');
        console.log('   OPENROUTER_API_KEY=ваш_ключ');
        console.log('');
    }
});

