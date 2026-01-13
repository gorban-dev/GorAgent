#!/usr/bin/env node
/**
 * Тест Development Assistant
 * Проверяет работу всех компонентов системы
 */

require('dotenv').config();
const DevAssistant = require('./dev-assistant');
const ProjectDocIndexer = require('./index-project-docs');
const MCPGitServer = require('./mcp-server-git');

// Цвета для вывода
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    red: '\x1b[31m',
    gray: '\x1b[90m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
    console.log();
    log('═'.repeat(60), 'blue');
    log(`  ${title}`, 'bright');
    log('═'.repeat(60), 'blue');
    console.log();
}

async function testGitServer() {
    logSection('🔀 Тест MCP Git Server');
    
    const gitServer = new MCPGitServer(__dirname);
    
    try {
        // Тест 1: Текущая ветка
        log('1. Получение текущей ветки...', 'yellow');
        const branch = await gitServer.executeTool('git_current_branch');
        log(`   ✓ Ветка: ${branch.branch}`, 'green');
        
        // Тест 2: Статус
        log('2. Получение статуса...', 'yellow');
        const status = await gitServer.executeTool('git_status');
        log(`   ✓ Изменений: ${status.totalChanges}`, 'green');
        if (status.totalChanges > 0) {
            log(`   - Изменено: ${status.files.modified.length}`, 'gray');
            log(`   - Добавлено: ${status.files.added.length}`, 'gray');
            log(`   - Удалено: ${status.files.deleted.length}`, 'gray');
        }
        
        // Тест 3: Последние коммиты
        log('3. Получение последних коммитов...', 'yellow');
        const commits = await gitServer.executeTool('git_recent_commits', { limit: 3 });
        log(`   ✓ Получено коммитов: ${commits.count}`, 'green');
        commits.commits.slice(0, 3).forEach((commit, i) => {
            log(`   ${i + 1}. ${commit.hash} - ${commit.message}`, 'gray');
        });
        
        // Тест 4: Список веток
        log('4. Получение списка веток...', 'yellow');
        const branches = await gitServer.executeTool('git_branches');
        log(`   ✓ Локальных веток: ${branches.branches.local.length}`, 'green');
        log(`   ✓ Удаленных веток: ${branches.branches.remote.length}`, 'green');
        
        // Тест 5: Контрибьюторы
        log('5. Получение контрибьюторов...', 'yellow');
        const contributors = await gitServer.executeTool('git_contributors');
        log(`   ✓ Контрибьюторов: ${contributors.count}`, 'green');
        contributors.contributors.slice(0, 3).forEach((c, i) => {
            log(`   ${i + 1}. ${c.name} (${c.commits} коммитов)`, 'gray');
        });
        
        log('\n✅ Git Server: Все тесты пройдены!', 'green');
        return true;
        
    } catch (error) {
        log(`\n❌ Git Server: Ошибка - ${error.message}`, 'red');
        return false;
    }
}

async function testProjectIndexer() {
    logSection('📚 Тест Project Indexer');
    
    const indexer = new ProjectDocIndexer(__dirname);
    
    try {
        log('Проверка наличия индекса...', 'yellow');
        
        try {
            await indexer.indexer.loadIndex();
            const stats = indexer.indexer.getStats();
            log(`✓ Индекс загружен`, 'green');
            log(`  - Документов: ${stats.totalDocuments}`, 'gray');
            log(`  - Чанков: ${stats.totalChunks}`, 'gray');
            log(`  - Модель: ${stats.model}`, 'gray');
        } catch (error) {
            log('⚠️  Индекс не найден. Создайте его командой:', 'yellow');
            log('   node index-project-docs.js', 'gray');
            return false;
        }
        
        // Тест поиска
        log('\nТест семантического поиска...', 'yellow');
        const searchResult = await indexer.indexer.search('MCP сервер', 3);
        log(`✓ Найдено результатов: ${searchResult.results.length}`, 'green');
        
        searchResult.results.forEach((result, i) => {
            const similarity = (result.similarity * 100).toFixed(1);
            log(`  ${i + 1}. ${result.chunk.metadata.documentName} (${similarity}%)`, 'gray');
        });
        
        log('\n✅ Project Indexer: Все тесты пройдены!', 'green');
        return true;
        
    } catch (error) {
        log(`\n❌ Project Indexer: Ошибка - ${error.message}`, 'red');
        return false;
    }
}

async function testDevAssistant() {
    logSection('🤖 Тест Development Assistant');
    
    const assistant = new DevAssistant({
        projectPath: __dirname,
        apiKey: process.env.OPENAI_API_KEY
    });
    
    try {
        // Загружаем индекс
        log('1. Загрузка индекса...', 'yellow');
        const loaded = await assistant.loadIndex();
        if (loaded) {
            log('   ✓ Индекс загружен', 'green');
        } else {
            log('   ⚠️  Индекс не загружен (возможно не создан)', 'yellow');
        }
        
        // Получаем git контекст
        log('2. Получение git контекста...', 'yellow');
        const gitContext = await assistant.getGitContext();
        if (gitContext) {
            log(`   ✓ Ветка: ${gitContext.branch}`, 'green');
            log(`   ✓ Изменений: ${gitContext.hasChanges ? 'Есть' : 'Нет'}`, 'green');
        }
        
        // Тест поиска в документации
        log('3. Поиск в документации...', 'yellow');
        const docs = await assistant.searchDocs('как запустить проект', 3);
        log(`   ✓ Найдено документов: ${docs.results.length}`, 'green');
        
        // Тест определения намерений
        log('4. Тест определения намерений...', 'yellow');
        const intents = [
            { message: 'Какая текущая ветка?', expected: 'git' },
            { message: 'Где функция processDocument?', expected: 'code' },
            { message: 'Как работает RAG?', expected: 'docs' }
        ];
        
        intents.forEach(({ message, expected }) => {
            const intent = assistant.detectIntent(message);
            const match = intent === expected ? '✓' : '✗';
            log(`   ${match} "${message}" -> ${intent}`, intent === expected ? 'green' : 'red');
        });
        
        // Тест команды /help
        log('5. Тест команды /help...', 'yellow');
        const helpResult = await assistant.processMessage('/help');
        log(`   ✓ Получен ответ (${helpResult.answer.length} символов)`, 'green');
        
        // Тест команды /status
        log('6. Тест команды /status...', 'yellow');
        const statusResult = await assistant.processMessage('/status');
        log(`   ✓ Получен статус`, 'green');
        
        // Тест обычного вопроса (если есть API ключ)
        if (process.env.OPENAI_API_KEY && loaded) {
            log('7. Тест обычного вопроса...', 'yellow');
            const result = await assistant.processMessage('Расскажи кратко о проекте');
            log(`   ✓ Получен ответ (${result.answer.length} символов)`, 'green');
            log(`   ✓ Intent: ${result.intent}`, 'gray');
            log(`   ✓ Токенов использовано: ${result.usage.total_tokens}`, 'gray');
        } else {
            log('7. Пропущен (нужен OpenAI API ключ и индекс)', 'gray');
        }
        
        log('\n✅ Development Assistant: Все тесты пройдены!', 'green');
        return true;
        
    } catch (error) {
        log(`\n❌ Development Assistant: Ошибка - ${error.message}`, 'red');
        console.error(error);
        return false;
    }
}

async function runTests() {
    log('\n' + '='.repeat(60), 'bright');
    log('  🧪 Тестирование Development Assistant System', 'bright');
    log('='.repeat(60) + '\n', 'bright');
    
    const results = {
        gitServer: false,
        projectIndexer: false,
        devAssistant: false
    };
    
    // Запускаем тесты
    results.gitServer = await testGitServer();
    results.projectIndexer = await testProjectIndexer();
    results.devAssistant = await testDevAssistant();
    
    // Итоги
    logSection('📊 Итоги тестирования');
    
    const passed = Object.values(results).filter(r => r).length;
    const total = Object.keys(results).length;
    
    log(`Git Server:       ${results.gitServer ? '✅ PASSED' : '❌ FAILED'}`, results.gitServer ? 'green' : 'red');
    log(`Project Indexer:  ${results.projectIndexer ? '✅ PASSED' : '❌ FAILED'}`, results.projectIndexer ? 'green' : 'red');
    log(`Dev Assistant:    ${results.devAssistant ? '✅ PASSED' : '❌ FAILED'}`, results.devAssistant ? 'green' : 'red');
    
    console.log();
    log(`Результат: ${passed}/${total} тестов пройдено`, passed === total ? 'green' : 'yellow');
    
    if (passed === total) {
        log('\n🎉 Все системы работают! Можно запускать Dev Assistant.', 'green');
        log('\nЗапуск:', 'bright');
        log('  npm start', 'gray');
        log('  Затем откройте: http://localhost:3000/dev-assistant', 'gray');
    } else {
        log('\n⚠️  Некоторые тесты не прошли. Проверьте настройки.', 'yellow');
        
        if (!results.projectIndexer) {
            log('\nДля индексации проекта выполните:', 'yellow');
            log('  node index-project-docs.js', 'gray');
        }
        
        if (!results.devAssistant) {
            log('\nУбедитесь что настроен OpenAI API ключ:', 'yellow');
            log('  echo "OPENAI_API_KEY=sk-..." > .env', 'gray');
        }
    }
    
    console.log();
}

// Запуск
if (require.main === module) {
    runTests().catch(error => {
        console.error('\n❌ Критическая ошибка:', error);
        process.exit(1);
    });
}

module.exports = { testGitServer, testProjectIndexer, testDevAssistant };

