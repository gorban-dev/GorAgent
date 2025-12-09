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

// Дефолтное системное сообщение для агента (используется если клиент не прислал своё)
const DEFAULT_SYSTEM_PROMPT = `Ты — GorAgent, профессиональный и дружелюбный кальянщик с многолетним опытом. 
Ты помогаешь гостям подобрать идеальный кальян на основе их предпочтений.

ВАЖНО: Ты должен вести диалог по следующему сценарию:

1. При ПЕРВОМ сообщении от пользователя — поприветствуй его, представься кальянщиком и начни задавать вопросы по одному.

2. Тебе нужно выяснить ответы на 5 вопросов (задавай их по одному, ожидая ответа):
   - Вопрос 1: Какой уровень крепости предпочитаете? (лёгкий / средний / крепкий)
   - Вопрос 2: Какие вкусы вам нравятся? (фруктовые / ягодные / цитрусовые / свежие-мятные / сладкие / пряные-специи)
   - Вопрос 3: Предпочитаете моно-вкус или микс из нескольких табаков?
   - Вопрос 4: Есть ли табаки или вкусы, которые вам НЕ нравятся или на которые аллергия?
   - Вопрос 5: Какое у вас сегодня настроение? Хотите расслабиться, взбодриться или что-то особенное?

3. Отслеживай, на какие вопросы пользователь уже ответил. Если он ответил не на все 5 вопросов — задай следующий.

4. После получения ответов на ВСЕ 5 вопросов — выдай персональную рекомендацию кальяна.

ФОРМАТ ФИНАЛЬНОЙ РЕКОМЕНДАЦИИ должен включать:
- Название микса
- Описание вкуса и ощущений
- Конкретные бренды и линейки табака
- ОБЯЗАТЕЛЬНО: точный рецепт микса с процентами и граммами (стандартная чаша = 25 грамм)

Пример формата микса:
"🎯 Рецепт микса (чаша 25г):
• Darkside Core Barvy Citrus — 40% (10г)
• Tangiers Noir Cane Mint — 30% (7.5г)  
• Fumari White Gummi Bear — 30% (7.5г)"

Отвечай на русском языке. Будь дружелюбным и профессиональным, используй эмодзи где уместно.

Ответ возвращай ТОЛЬКО в формате JSON без дополнительной разметки:
{"message": "сообщение пользователя", "answer": "твой ответ"}
Где message - это сообщение от пользователя, answer - это твой ответ на это сообщение.`;

// Функция задержки
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
            response_format: { type: "json_object" },
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

// API для чата
app.post('/api/chat', async (req, res) => {
    try {
        // Проверка API ключа
        if (!OPENAI_API_KEY) {
            return res.status(500).json({ 
                error: 'API ключ OpenAI не настроен. Добавьте OPENAI_API_KEY в файл .env' 
            });
        }

        const { message, history = [], systemPrompt, temperature } = req.body;
        
        // Валидация и ограничение temperature (0-2 для OpenAI)
        const parsedTemp = parseFloat(temperature);
        const validTemperature = isNaN(parsedTemp) ? 0.7 : Math.min(2, Math.max(0, parsedTemp));

        // Валидация
        if (!message || typeof message !== 'string') {
            return res.status(400).json({ error: 'Сообщение не может быть пустым' });
        }

        if (message.length > 3000) {
            return res.status(400).json({ error: 'Сообщение слишком длинное' });
        }

        // Используем переданный systemPrompt или дефолтный
        let activeSystemPrompt = systemPrompt || DEFAULT_SYSTEM_PROMPT;
        
        // OpenAI требует упоминание "json" в сообщениях при использовании response_format: json_object
        // Если в system prompt нет слова "json", добавляем инструкцию автоматически
        if (!activeSystemPrompt.toLowerCase().includes('json')) {
            activeSystemPrompt += `\n\nОтвет возвращай ТОЛЬКО в формате JSON без дополнительной разметки:
{"message": "сообщение пользователя", "answer": "твой ответ"}
Где message - это сообщение от пользователя, answer - это твой ответ на это сообщение.`;
        }
        
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
            max_tokens: 2048,
            temperature: validTemperature,
            response_format: { type: "json_object" },
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
        const rawReply = data.choices?.[0]?.message?.content || '{"message": "", "answer": "Не удалось получить ответ."}';

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
            console.error('Ошибка парсинга JSON ответа:', e);
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
                provider: 'openai'
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

        const { message, history = [], systemPrompt, temperature, model } = req.body;
        
        // Валидация модели
        const selectedModel = model || 'anthropic/claude-sonnet-4';
        
        // Валидация и ограничение temperature (0-2)
        const parsedTemp = parseFloat(temperature);
        const validTemperature = isNaN(parsedTemp) ? 0.7 : Math.min(2, Math.max(0, parsedTemp));

        // Валидация
        if (!message || typeof message !== 'string') {
            return res.status(400).json({ error: 'Сообщение не может быть пустым' });
        }

        if (message.length > 3000) {
            return res.status(400).json({ error: 'Сообщение слишком длинное' });
        }

        // Используем переданный systemPrompt или дефолтный
        let activeSystemPrompt = systemPrompt || DEFAULT_SYSTEM_PROMPT;
        
        // Добавляем инструкцию по JSON формату если её нет
        if (!activeSystemPrompt.toLowerCase().includes('json')) {
           
        }
        
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
            max_tokens: 2048,
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
        const rawReply = data.choices?.[0]?.message?.content || '{"message": "", "answer": "Не удалось получить ответ."}';

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
            console.error('Ошибка парсинга JSON ответа:', e);
            // Если не удалось распарсить, возвращаем как есть
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
                provider: 'openrouter'
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

// Проверка статуса сервера
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        model: OPENAI_MODEL,
        hasApiKey: !!OPENAI_API_KEY,
        openrouter: {
            hasApiKey: !!OPENROUTER_API_KEY,
            modelsCount: Object.keys(OPENROUTER_MODELS).length
        }
    });
});

// ===== Запуск сервера =====
app.listen(PORT, () => {
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

