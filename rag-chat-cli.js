#!/usr/bin/env node
/**
 * RAG Chat CLI — чат-бот с RAG памятью в терминале
 * Использование: node rag-chat-cli.js
 */

const readline = require('readline');
const API_BASE = 'http://localhost:3000';

// Цвета для терминала
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    blue: '\x1b[34m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m',
    gray: '\x1b[90m'
};

// История чата
let chatHistory = [];
let totalTokens = 0;
let totalSources = 0;

// Настройки
let settings = {
    topK: 3,
    similarityThreshold: 0.6  // Снижен до 0.6
};

// Создаем интерфейс для ввода
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${colors.cyan}Вы > ${colors.reset}`
});

// Красивый вывод
function printHeader() {
    console.clear();
    console.log(`${colors.bright}${colors.blue}╔════════════════════════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.bright}${colors.blue}║${colors.reset}                  ${colors.bright}🤖 RAG CHAT${colors.reset}                          ${colors.bright}${colors.blue}║${colors.reset}`);
    console.log(`${colors.bright}${colors.blue}║${colors.reset}        Чат-бот с доступом к базе знаний               ${colors.bright}${colors.blue}║${colors.reset}`);
    console.log(`${colors.bright}${colors.blue}╚════════════════════════════════════════════════════════════╝${colors.reset}`);
    console.log();
    console.log(`${colors.gray}Команды: /help - помощь, /stats - статистика, /clear - очистить, /exit - выход${colors.reset}`);
    console.log(`${colors.gray}Настройки: Источников=${settings.topK}, Порог=${settings.similarityThreshold}${colors.reset}`);
    console.log();
}

// Вывод сообщения пользователя
function printUserMessage(message) {
    console.log(`${colors.cyan}${colors.bright}Вы:${colors.reset} ${message}`);
    console.log();
}

// Вывод сообщения ассистента
function printAssistantMessage(message, sources) {
    console.log(`${colors.green}${colors.bright}🤖 Ассистент:${colors.reset}`);
    console.log(`${colors.reset}${message}${colors.reset}`);
    
    if (sources && sources.length > 0) {
        console.log();
        console.log(`${colors.yellow}${colors.bright}📚 Источники (${sources.length}):${colors.reset}`);
        sources.forEach((source, i) => {
            console.log(`${colors.gray}  ${i + 1}. 📄 ${source.document} ${colors.reset}${colors.yellow}(${(source.similarity * 100).toFixed(0)}%)${colors.reset}`);
            console.log(`${colors.gray}     ${source.text.substring(0, 100)}...${colors.reset}`);
        });
    }
    
    console.log();
}

// Вывод ошибки
function printError(error) {
    console.log(`${colors.red}${colors.bright}❌ Ошибка:${colors.reset} ${error}`);
    console.log();
}

// Отправка сообщения
async function sendMessage(message) {
    try {
        // Показываем индикатор загрузки
        process.stdout.write(`${colors.gray}Думаю...${colors.reset}`);
        
        const response = await fetch(`${API_BASE}/api/rag-chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message,
                history: chatHistory,
                topK: settings.topK,
                similarityThreshold: settings.similarityThreshold,
                provider: 'openai'
            })
        });

        // Очищаем индикатор
        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0);

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Не удалось получить ответ');
        }

        // Добавляем в историю
        chatHistory.push({
            role: 'user',
            content: message,
            timestamp: new Date().toISOString()
        });

        chatHistory.push({
            role: 'assistant',
            content: data.answer,
            sources: data.sources,
            timestamp: new Date().toISOString()
        });

        // Обновляем статистику
        totalTokens += data.metadata.tokens.total;
        totalSources += data.sources.length;

        // Выводим ответ
        printAssistantMessage(data.answer, data.sources);

    } catch (error) {
        // Очищаем индикатор
        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0);
        
        printError(error.message);
    }
}

// Обработка команд
function handleCommand(input) {
    const command = input.toLowerCase().trim();

    switch (command) {
        case '/help':
            console.log(`${colors.bright}Доступные команды:${colors.reset}`);
            console.log(`  ${colors.cyan}/help${colors.reset}     - показать эту справку`);
            console.log(`  ${colors.cyan}/stats${colors.reset}    - показать статистику`);
            console.log(`  ${colors.cyan}/clear${colors.reset}    - очистить историю`);
            console.log(`  ${colors.cyan}/settings${colors.reset} - изменить настройки`);
            console.log(`  ${colors.cyan}/export${colors.reset}   - экспортировать чат`);
            console.log(`  ${colors.cyan}/exit${colors.reset}     - выйти из чата`);
            console.log();
            return true;

        case '/stats':
            console.log(`${colors.bright}Статистика:${colors.reset}`);
            console.log(`  Сообщений: ${chatHistory.length}`);
            console.log(`  Использовано источников: ${totalSources}`);
            console.log(`  Токенов: ${totalTokens.toLocaleString()}`);
            console.log(`  Настройки: topK=${settings.topK}, порог=${settings.similarityThreshold}`);
            console.log();
            return true;

        case '/clear':
            chatHistory = [];
            totalTokens = 0;
            totalSources = 0;
            printHeader();
            console.log(`${colors.green}✅ История очищена${colors.reset}`);
            console.log();
            return true;

        case '/settings':
            rl.question(`Количество источников (текущее ${settings.topK}): `, (topK) => {
                if (topK) settings.topK = parseInt(topK) || settings.topK;
                
                rl.question(`Порог релевантности 0-1 (текущий ${settings.similarityThreshold}): `, (threshold) => {
                    if (threshold) settings.similarityThreshold = parseFloat(threshold) || settings.similarityThreshold;
                    
                    console.log(`${colors.green}✅ Настройки обновлены${colors.reset}`);
                    console.log();
                    rl.prompt();
                });
            });
            return true;

        case '/export':
            const fs = require('fs');
            const filename = `rag-chat-export-${Date.now()}.json`;
            const data = {
                exported: new Date().toISOString(),
                messages: chatHistory.length,
                settings,
                history: chatHistory
            };
            fs.writeFileSync(filename, JSON.stringify(data, null, 2));
            console.log(`${colors.green}✅ Чат экспортирован в ${filename}${colors.reset}`);
            console.log();
            return true;

        case '/exit':
        case '/quit':
            console.log(`${colors.bright}Спасибо за использование RAG Chat! 👋${colors.reset}`);
            process.exit(0);
            return true;

        default:
            return false;
    }
}

// Обработка ввода
rl.on('line', async (input) => {
    const trimmed = input.trim();

    if (!trimmed) {
        rl.prompt();
        return;
    }

    // Команда
    if (trimmed.startsWith('/')) {
        const handled = handleCommand(trimmed);
        if (!handled) {
            console.log(`${colors.red}Неизвестная команда. Используйте /help${colors.reset}`);
            console.log();
        }
        rl.prompt();
        return;
    }

    // Обычное сообщение
    printUserMessage(trimmed);
    await sendMessage(trimmed);
    rl.prompt();
});

// Обработка Ctrl+C
rl.on('SIGINT', () => {
    console.log();
    console.log(`${colors.bright}Выход... 👋${colors.reset}`);
    process.exit(0);
});

// Проверка подключения к серверу
async function checkServer() {
    try {
        const response = await fetch(`${API_BASE}/api/health`);
        const data = await response.json();
        
        if (!data.status === 'ok') {
            throw new Error('Сервер недоступен');
        }

        // Проверяем наличие документов
        const statsResponse = await fetch(`${API_BASE}/api/document-indexer/stats`);
        const stats = await statsResponse.json();

        if (stats.totalDocuments === 0) {
            console.log(`${colors.yellow}⚠️  Внимание: В индексе нет документов!${colors.reset}`);
            console.log(`${colors.gray}   Добавьте документы через веб-интерфейс: http://localhost:3000/document-index-demo${colors.reset}`);
            console.log();
        } else {
            console.log(`${colors.green}✅ Сервер готов. Документов в индексе: ${stats.totalDocuments}${colors.reset}`);
            console.log();
        }

        return true;
    } catch (error) {
        console.log(`${colors.red}❌ Ошибка подключения к серверу${colors.reset}`);
        console.log(`${colors.gray}   Убедитесь что сервер запущен: npm start${colors.reset}`);
        console.log();
        process.exit(1);
    }
}

// Запуск
async function start() {
    printHeader();
    await checkServer();
    
    console.log(`${colors.gray}Введите ваш вопрос или команду (например: /help)${colors.reset}`);
    console.log();
    
    rl.prompt();
}

start().catch(error => {
    console.error(`${colors.red}Критическая ошибка:${colors.reset}`, error);
    process.exit(1);
});

