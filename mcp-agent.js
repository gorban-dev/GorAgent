/**
 * MCP Agent - Агент-оркестратор для координации цепочек MCP инструментов
 * Реализует паттерн "поиск → суммаризация → сохранение"
 */

const MCPServers = require('./mcp-servers');

class MCPAgent {
    constructor() {
        this.mcpServers = new MCPServers();
        this.executionHistory = [];
    }

    /**
     * Выполнение цепочки: поиск → суммаризация → сохранение
     */
    async executeChain(query, options = {}) {
        const {
            searchLimit = 5,
            searchSource = 'web',
            summaryMaxLength = 200,
            summaryFormat = 'bullet-points',
            saveFilename = null,
            saveFormat = 'md',
            saveAppend = false
        } = options;

        console.log('\n' + '🔗'.repeat(30));
        console.log(`[MCP Agent] Запуск цепочки для запроса: "${query}"`);
        console.log('🔗'.repeat(30) + '\n');

        const execution = {
            id: `chain_${Date.now()}`,
            query,
            startTime: new Date(),
            steps: [],
            status: 'running'
        };

        try {
            // ШАГ 1: Поиск в документации
            console.log('\n📍 ШАГ 1/3: Поиск в документации...');
            const stepSearchStart = Date.now();
            
            const searchResult = await this.mcpServers.executeTool('searchDocs', {
                query,
                limit: searchLimit,
                source: searchSource
            });

            const stepSearchTime = Date.now() - stepSearchStart;
            
            execution.steps.push({
                step: 1,
                name: 'searchDocs',
                status: 'completed',
                duration: stepSearchTime,
                result: searchResult
            });

            console.log(`✅ Поиск завершен: найдено ${searchResult.resultsCount} результатов (${stepSearchTime}ms)`);

            // Формируем текст из результатов поиска
            const searchText = this.formatSearchResults(searchResult);

            // ШАГ 2: Суммаризация результатов
            console.log('\n📍 ШАГ 2/3: Суммаризация результатов...');
            const stepSummaryStart = Date.now();

            const summaryResult = await this.mcpServers.executeTool('summarize', {
                text: searchText,
                maxLength: summaryMaxLength,
                format: summaryFormat
            });

            const stepSummaryTime = Date.now() - stepSummaryStart;

            execution.steps.push({
                step: 2,
                name: 'summarize',
                status: 'completed',
                duration: stepSummaryTime,
                result: summaryResult
            });

            console.log(`✅ Суммаризация завершена: ${summaryResult.summaryLength} символов (${stepSummaryTime}ms)`);

            // ШАГ 3: Сохранение результата
            console.log('\n📍 ШАГ 3/3: Сохранение результата...');
            const stepSaveStart = Date.now();

            // Формируем имя файла, если не указано
            const filename = saveFilename || this.generateFilename(query, saveFormat);

            // Формируем итоговый контент для сохранения
            const contentToSave = this.formatFinalContent(query, searchResult, summaryResult);

            const saveResult = await this.mcpServers.executeTool('saveToFile', {
                content: contentToSave,
                filename: filename,
                format: saveFormat,
                append: saveAppend
            });

            const stepSaveTime = Date.now() - stepSaveStart;

            execution.steps.push({
                step: 3,
                name: 'saveToFile',
                status: 'completed',
                duration: stepSaveTime,
                result: saveResult
            });

            console.log(`✅ Сохранение завершено: ${saveResult.filepath} (${stepSaveTime}ms)`);

            // Завершаем выполнение цепочки
            execution.endTime = new Date();
            execution.totalDuration = Date.now() - execution.startTime.getTime();
            execution.status = 'completed';

            this.executionHistory.push(execution);

            console.log('\n' + '✨'.repeat(30));
            console.log(`[MCP Agent] Цепочка успешно выполнена за ${execution.totalDuration}ms`);
            console.log('✨'.repeat(30) + '\n');

            return {
                success: true,
                execution,
                summary: summaryResult.summary,
                savedFile: saveResult.filepath,
                searchResultsCount: searchResult.resultsCount
            };

        } catch (error) {
            console.error('\n❌ [MCP Agent] Ошибка выполнения цепочки:', error);
            
            execution.endTime = new Date();
            execution.totalDuration = Date.now() - execution.startTime.getTime();
            execution.status = 'failed';
            execution.error = error.message;

            this.executionHistory.push(execution);

            return {
                success: false,
                error: error.message,
                execution
            };
        }
    }

    /**
     * Форматирование результатов поиска в текст
     */
    formatSearchResults(searchResult) {
        const { query, results } = searchResult;

        let text = `Результаты поиска по запросу: "${query}"\n\n`;

        for (const [index, result] of results.entries()) {
            text += `Документ ${index + 1}: ${result.title}\n`;
            text += `URL: ${result.url}\n`;
            text += `Категория: ${result.category}\n`;
            text += `Релевантность: ${(result.relevance * 100).toFixed(0)}%\n`;
            text += `Описание: ${result.snippet}\n\n`;
            text += '---\n\n';
        }

        return text;
    }

    /**
     * Форматирование итогового контента для сохранения
     */
    formatFinalContent(query, searchResult, summaryResult) {
        let content = `# Результаты поиска и анализа\n\n`;
        content += `**Запрос:** ${query}\n`;
        content += `**Дата:** ${new Date().toLocaleString('ru-RU')}\n`;
        content += `**Найдено документов:** ${searchResult.resultsCount}\n\n`;
        content += `---\n\n`;
        content += `## Краткое резюме\n\n`;
        content += `${summaryResult.summary}\n\n`;
        content += `---\n\n`;
        content += `## Детальные результаты поиска\n\n`;

        for (const [index, result] of searchResult.results.entries()) {
            content += `### ${index + 1}. ${result.title}\n\n`;
            content += `- **URL:** ${result.url}\n`;
            content += `- **Категория:** ${result.category}\n`;
            content += `- **Релевантность:** ${(result.relevance * 100).toFixed(0)}%\n\n`;
            content += `${result.snippet}\n\n`;
        }

        content += `---\n\n`;
        content += `*Создано с помощью MCP Agent*\n`;

        return content;
    }

    /**
     * Генерация имени файла на основе запроса
     */
    generateFilename(query, format) {
        // Очищаем запрос от спецсимволов
        const cleanQuery = query
            .toLowerCase()
            .replace(/[^а-яa-z0-9\s]/gi, '')
            .replace(/\s+/g, '-')
            .substring(0, 50);

        const timestamp = new Date().toISOString().split('T')[0];
        return `search-${cleanQuery}-${timestamp}.${format}`;
    }

    /**
     * Выполнение отдельного инструмента
     */
    async executeTool(toolName, args) {
        return await this.mcpServers.executeTool(toolName, args);
    }

    /**
     * Получение списка доступных инструментов
     */
    getTools() {
        return this.mcpServers.getTools();
    }

    /**
     * Получение истории выполнения
     */
    getExecutionHistory() {
        return this.executionHistory;
    }

    /**
     * Получение последнего выполнения
     */
    getLastExecution() {
        return this.executionHistory[this.executionHistory.length - 1] || null;
    }

    /**
     * Получение статистики выполнения
     */
    getStats() {
        const totalExecutions = this.executionHistory.length;
        const successfulExecutions = this.executionHistory.filter(e => e.status === 'completed').length;
        const failedExecutions = this.executionHistory.filter(e => e.status === 'failed').length;

        const avgDuration = totalExecutions > 0
            ? this.executionHistory.reduce((sum, e) => sum + (e.totalDuration || 0), 0) / totalExecutions
            : 0;

        return {
            totalExecutions,
            successfulExecutions,
            failedExecutions,
            successRate: totalExecutions > 0 ? (successfulExecutions / totalExecutions * 100).toFixed(1) + '%' : '0%',
            avgDuration: Math.round(avgDuration)
        };
    }

    /**
     * Получение списка сохраненных файлов
     */
    async getSavedFiles() {
        return await this.mcpServers.getSavedFiles();
    }

    /**
     * Чтение сохраненного файла
     */
    async readFile(filename) {
        return await this.mcpServers.readFile(filename);
    }

    /**
     * Пример использования: демонстрация различных сценариев
     */
    async runExamples() {
        console.log('\n🎯 Запуск примеров использования MCP Agent...\n');

        // Пример 1: Базовый поиск и сохранение
        console.log('📝 Пример 1: Базовый поиск о MCP');
        await this.executeChain('MCP архитектура и лучшие практики', {
            searchLimit: 3,
            summaryFormat: 'bullet-points',
            saveFilename: 'example-mcp-basics.md'
        });

        // Небольшая пауза между примерами
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Пример 2: Расширенный поиск с параграфом
        console.log('\n📝 Пример 2: Поиск о безопасности с форматом параграфа');
        await this.executeChain('MCP безопасность и валидация', {
            searchLimit: 5,
            summaryFormat: 'paragraph',
            summaryMaxLength: 150,
            saveFilename: 'example-mcp-security.md'
        });

        // Небольшая пауза
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Пример 3: Структурированное резюме
        console.log('\n📝 Пример 3: Поиск о интеграции со структурированным резюме');
        await this.executeChain('MCP интеграция с Node.js', {
            searchLimit: 4,
            summaryFormat: 'structured',
            summaryMaxLength: 250,
            saveFilename: 'example-mcp-nodejs.md'
        });

        console.log('\n✅ Все примеры выполнены!\n');
        
        // Показываем статистику
        console.log('📊 Статистика выполнения:');
        console.log(this.getStats());
    }
}

module.exports = MCPAgent;

// Если запускается напрямую (для тестирования)
if (require.main === module) {
    const agent = new MCPAgent();
    
    console.log('🤖 Запуск MCP Agent в режиме тестирования...\n');
    
    // Запускаем примеры
    agent.runExamples().then(() => {
        console.log('\n✨ Тестирование завершено!');
        process.exit(0);
    }).catch(error => {
        console.error('\n❌ Ошибка:', error);
        process.exit(1);
    });
}




