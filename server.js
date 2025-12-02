/**
 * GorAgent — Node.js сервер
 * Проксирует запросы к OpenAI API
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

// Retry конфигурация
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 секунда

// Системное сообщение для агента
const SYSTEM_PROMPT = `Ты — GorAgent, дружелюбный и умный ИИ-ассистент. 
Ты помогаешь пользователям с ответами на вопросы, написанием кода, объяснением концепций и творческими задачами.
Отвечай на русском языке, если пользователь пишет на русском.
Будь краток, но информативен. Ответ возвращай ТОЛЬКО в формате JSON без дополнительной разметки:
{"message": "сообщение пользователя", "answer": "твой ответ"}
Где message - это сообщение от пользователя, answer - это твой ответ на это сообщение.`;

// Функция задержки
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Функция запроса к OpenAI с retry
async function callOpenAI(messages, retryCount = 0) {
    const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: OPENAI_MODEL,
            messages,
            max_tokens: 2048,
            temperature: 0.7,
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
        return callOpenAI(messages, retryCount + 1);
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

        const { message, history = [] } = req.body;

        // Валидация
        if (!message || typeof message !== 'string') {
            return res.status(400).json({ error: 'Сообщение не может быть пустым' });
        }

        if (message.length > 3000) {
            return res.status(400).json({ error: 'Сообщение слишком длинное' });
        }

        // Формируем сообщения для OpenAI
        const messages = [
            { role: 'system', content: SYSTEM_PROMPT },
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
            temperature: 0.7,
            response_format: { type: "json_object" },
        };
        
        console.log('\n' + '='.repeat(60));
        console.log(`[${new Date().toISOString()}] ЗАПРОС К OpenAI`);
        console.log('='.repeat(60));
        console.log('Структура запроса:');
        console.log(JSON.stringify(requestBody, null, 2));
        console.log('='.repeat(60) + '\n');

        // Запрос к OpenAI API с автоматическим retry
        const response = await callOpenAI(messages);

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

        // Логируем распарсенный ответ
        console.log('\n' + '='.repeat(60));
        console.log(`[${new Date().toISOString()}] РАСПАРСЕННЫЙ ОТВЕТ`);
        console.log('='.repeat(60));
        console.log('Отправляем клиенту:');
        console.log(JSON.stringify(parsedReply, null, 2));
        console.log('='.repeat(60) + '\n');

        res.json(parsedReply);

    } catch (error) {
        console.error('Server Error:', error);
        res.status(500).json({ 
            error: 'Внутренняя ошибка сервера. Попробуйте позже.' 
        });
    }
});

// Проверка статуса сервера
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        model: OPENAI_MODEL,
        hasApiKey: !!OPENAI_API_KEY 
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
    console.log(`║   📦 Модель: ${OPENAI_MODEL.padEnd(40)}║`);
    console.log(`║   🔑 API ключ: ${OPENAI_API_KEY ? 'Настроен ✓' : 'НЕ НАСТРОЕН ✗'.padEnd(37)}║`);
    console.log('║                                                            ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');
    
    if (!OPENAI_API_KEY) {
        console.log('⚠️  Внимание: API ключ OpenAI не найден!');
        console.log('   Создайте файл .env и добавьте: OPENAI_API_KEY=ваш_ключ');
        console.log('');
    }
});

