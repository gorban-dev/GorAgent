/**
 * MCP Servers - Реализация готовых MCP серверов
 * Включает: searchDocs, summarize, saveToFile
 */

const fs = require('fs').promises;
const path = require('path');

/**
 * Класс для реализации MCP серверов
 */
class MCPServers {
    constructor() {
        this.outputDir = path.join(__dirname, 'mcp-output');
        this.initOutputDir();
    }

    /**
     * Создание директории для выходных файлов
     */
    async initOutputDir() {
        try {
            await fs.mkdir(this.outputDir, { recursive: true });
        } catch (error) {
            console.error('[MCP] Ошибка создания директории:', error);
        }
    }

    /**
     * Получение списка всех доступных инструментов
     */
    getTools() {
        return [
            {
                name: 'searchDocs',
                description: 'Поиск информации в документации или базе знаний по запросу. Возвращает релевантные результаты поиска.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        query: {
                            type: 'string',
                            description: 'Поисковый запрос для поиска в документации'
                        },
                        limit: {
                            type: 'number',
                            description: 'Максимальное количество результатов (по умолчанию 5)',
                            default: 5
                        },
                        source: {
                            type: 'string',
                            description: 'Источник документации (web, local, api)',
                            default: 'web'
                        }
                    },
                    required: ['query']
                }
            },
            {
                name: 'summarize',
                description: 'Создание краткого резюме из большого текста. Извлекает ключевые моменты и суммаризирует информацию.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        text: {
                            type: 'string',
                            description: 'Текст для суммаризации'
                        },
                        maxLength: {
                            type: 'number',
                            description: 'Максимальная длина резюме в словах (по умолчанию 200)',
                            default: 200
                        },
                        format: {
                            type: 'string',
                            description: 'Формат вывода (bullet-points, paragraph, structured)',
                            default: 'bullet-points'
                        }
                    },
                    required: ['text']
                }
            },
            {
                name: 'saveToFile',
                description: 'Сохранение текстовых данных в файл. Поддерживает различные форматы (txt, md, json).',
                inputSchema: {
                    type: 'object',
                    properties: {
                        content: {
                            type: 'string',
                            description: 'Содержимое для сохранения в файл'
                        },
                        filename: {
                            type: 'string',
                            description: 'Имя файла (с расширением)'
                        },
                        format: {
                            type: 'string',
                            description: 'Формат файла (txt, md, json)',
                            default: 'txt'
                        },
                        append: {
                            type: 'boolean',
                            description: 'Добавить к существующему файлу (по умолчанию false)',
                            default: false
                        }
                    },
                    required: ['content', 'filename']
                }
            }
        ];
    }

    /**
     * Выполнение инструмента
     */
    async executeTool(toolName, args) {
        console.log(`[MCP] Выполнение инструмента: ${toolName}`, args);

        switch (toolName) {
            case 'searchDocs':
                return await this.searchDocs(args);
            case 'summarize':
                return await this.summarize(args);
            case 'saveToFile':
                return await this.saveToFile(args);
            default:
                throw new Error(`Неизвестный инструмент: ${toolName}`);
        }
    }

    /**
     * searchDocs - Поиск в документации
     */
    async searchDocs(args) {
        const { query, limit = 5, source = 'web' } = args;

        console.log(`[searchDocs] Поиск: "${query}", лимит: ${limit}, источник: ${source}`);

        // Симуляция поиска в документации
        // В реальной реализации здесь был бы запрос к поисковой системе, API или базе знаний
        const mockResults = await this.mockDocumentationSearch(query, limit, source);

        return {
            success: true,
            query,
            resultsCount: mockResults.length,
            results: mockResults,
            source,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Моковый поиск в документации (для демонстрации)
     */
    async mockDocumentationSearch(query, limit, source) {
        // Симуляция задержки сети
        await new Promise(resolve => setTimeout(resolve, 300));

        const allDocs = [
            {
                title: 'Введение в MCP (Model Context Protocol)',
                url: 'https://docs.mcp.io/introduction',
                snippet: 'MCP (Model Context Protocol) — это стандартизированный протокол для взаимодействия между AI моделями и внешними инструментами. Он позволяет моделям получать доступ к данным и выполнять действия через унифицированный интерфейс.',
                relevance: 0.95,
                category: 'MCP'
            },
            {
                title: 'Архитектура MCP серверов',
                url: 'https://docs.mcp.io/architecture',
                snippet: 'MCP серверы работают по принципу клиент-сервер. Каждый сервер предоставляет набор инструментов (tools), которые могут быть вызваны через стандартный API. Серверы могут быть локальными или удаленными.',
                relevance: 0.88,
                category: 'MCP'
            },
            {
                title: 'Создание custom MCP инструментов',
                url: 'https://docs.mcp.io/custom-tools',
                snippet: 'Чтобы создать свой MCP инструмент, необходимо определить схему (inputSchema) и функцию выполнения (execute). Схема описывает параметры инструмента в формате JSON Schema.',
                relevance: 0.82,
                category: 'MCP'
            },
            {
                title: 'Цепочки вызовов MCP инструментов',
                url: 'https://docs.mcp.io/chaining',
                snippet: 'MCP поддерживает создание цепочек инструментов, где результат одного инструмента передается в другой. Это позволяет создавать сложные workflow из простых блоков.',
                relevance: 0.79,
                category: 'MCP'
            },
            {
                title: 'Best practices для MCP серверов',
                url: 'https://docs.mcp.io/best-practices',
                snippet: 'При разработке MCP серверов следует: валидировать входные данные, обрабатывать ошибки корректно, логировать операции, оптимизировать производительность, документировать API.',
                relevance: 0.75,
                category: 'MCP'
            },
            {
                title: 'Интеграция MCP с Node.js',
                url: 'https://docs.mcp.io/nodejs',
                snippet: 'Для Node.js существует официальная библиотека @modelcontextprotocol/sdk, которая упрощает создание MCP серверов. Она предоставляет готовые классы и утилиты.',
                relevance: 0.71,
                category: 'Integration'
            },
            {
                title: 'Безопасность в MCP',
                url: 'https://docs.mcp.io/security',
                snippet: 'MCP серверы должны валидировать все входящие данные, ограничивать доступ к чувствительным операциям, использовать аутентификацию и авторизацию, логировать все действия.',
                relevance: 0.68,
                category: 'Security'
            },
            {
                title: 'Примеры использования MCP',
                url: 'https://docs.mcp.io/examples',
                snippet: 'Примеры MCP серверов включают: file operations (чтение/запись файлов), web scraping (получение данных из интернета), database queries (работа с БД), API integrations (интеграция с внешними API).',
                relevance: 0.65,
                category: 'Examples'
            },
            {
                title: 'Отладка MCP серверов',
                url: 'https://docs.mcp.io/debugging',
                snippet: 'Для отладки MCP серверов используйте: подробное логирование, тестирование инструментов по отдельности, мониторинг производительности, проверку валидации схем.',
                relevance: 0.62,
                category: 'Debugging'
            },
            {
                title: 'MCP Roadmap и будущие возможности',
                url: 'https://docs.mcp.io/roadmap',
                snippet: 'В планах развития MCP: поддержка стриминга данных, улучшенная обработка ошибок, расширенные типы инструментов, интеграция с популярными фреймворками, улучшенная документация.',
                relevance: 0.58,
                category: 'Future'
            }
        ];

        // Фильтруем по релевантности к запросу (простая эвристика)
        const queryLower = query.toLowerCase();
        const filtered = allDocs
            .map(doc => {
                let score = doc.relevance;
                
                // Проверяем наличие слов из запроса в тексте
                const words = queryLower.split(/\s+/);
                for (const word of words) {
                    if (word.length < 3) continue; // Игнорируем короткие слова
                    
                    const titleMatch = doc.title.toLowerCase().includes(word);
                    const snippetMatch = doc.snippet.toLowerCase().includes(word);
                    
                    if (titleMatch) score += 0.1;
                    if (snippetMatch) score += 0.05;
                }
                
                return { ...doc, relevance: score };
            })
            .sort((a, b) => b.relevance - a.relevance)
            .slice(0, limit);

        return filtered;
    }

    /**
     * summarize - Суммаризация текста
     */
    async summarize(args) {
        const { text, maxLength = 200, format = 'bullet-points' } = args;

        console.log(`[summarize] Суммаризация текста (${text.length} символов), макс. длина: ${maxLength} слов, формат: ${format}`);

        // Симуляция задержки обработки
        await new Promise(resolve => setTimeout(resolve, 500));

        // В реальной реализации здесь был бы вызов к AI модели для суммаризации
        // Для демонстрации используем простую логику
        const summary = await this.mockSummarize(text, maxLength, format);

        return {
            success: true,
            originalLength: text.length,
            summaryLength: summary.length,
            format,
            summary,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Моковая суммаризация (для демонстрации)
     */
    async mockSummarize(text, maxLength, format) {
        // Извлекаем ключевые предложения (простая эвристика)
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        
        // Подсчитываем частоту слов для определения важных тем
        const wordFreq = {};
        const words = text.toLowerCase().match(/\b[а-яa-z]{4,}\b/gi) || [];
        for (const word of words) {
            wordFreq[word] = (wordFreq[word] || 0) + 1;
        }

        // Сортируем предложения по важности (содержат ли они частые слова)
        const scoredSentences = sentences.map(sentence => {
            const sentenceWords = sentence.toLowerCase().match(/\b[а-яa-z]{4,}\b/gi) || [];
            const score = sentenceWords.reduce((sum, word) => sum + (wordFreq[word] || 0), 0);
            return { sentence: sentence.trim(), score };
        });

        scoredSentences.sort((a, b) => b.score - a.score);

        // Берем топ предложений
        const topSentences = scoredSentences.slice(0, 5).map(s => s.sentence);

        // Форматируем в зависимости от выбранного формата
        let summary = '';
        switch (format) {
            case 'bullet-points':
                summary = '### Краткое резюме\n\n' + topSentences.map(s => `• ${s}`).join('\n');
                break;
            case 'paragraph':
                summary = topSentences.join('. ') + '.';
                break;
            case 'structured':
                summary = `### Резюме\n\n**Основные моменты:**\n${topSentences.slice(0, 3).map(s => `- ${s}`).join('\n')}\n\n**Дополнительная информация:**\n${topSentences.slice(3).map(s => `- ${s}`).join('\n')}`;
                break;
            default:
                summary = topSentences.join('\n');
        }

        // Обрезаем до максимальной длины в словах
        const summaryWords = summary.split(/\s+/);
        if (summaryWords.length > maxLength) {
            summary = summaryWords.slice(0, maxLength).join(' ') + '...';
        }

        return summary;
    }

    /**
     * saveToFile - Сохранение в файл
     */
    async saveToFile(args) {
        const { content, filename, format = 'txt', append = false } = args;

        console.log(`[saveToFile] Сохранение в файл: ${filename}, формат: ${format}, добавление: ${append}`);

        try {
            const filepath = path.join(this.outputDir, filename);
            
            // Добавляем метаданные в начало файла
            const timestamp = new Date().toISOString();
            let finalContent = content;

            if (format === 'md') {
                finalContent = `---\nСоздано: ${timestamp}\nФормат: Markdown\n---\n\n${content}`;
            } else if (format === 'json') {
                try {
                    const jsonData = JSON.parse(content);
                    finalContent = JSON.stringify({
                        meta: { created: timestamp, format: 'JSON' },
                        data: jsonData
                    }, null, 2);
                } catch (e) {
                    // Если content не JSON, оборачиваем
                    finalContent = JSON.stringify({
                        meta: { created: timestamp, format: 'JSON' },
                        data: { content }
                    }, null, 2);
                }
            } else {
                finalContent = `# Создано: ${timestamp}\n# Формат: ${format}\n\n${content}`;
            }

            if (append) {
                await fs.appendFile(filepath, '\n\n' + finalContent);
            } else {
                await fs.writeFile(filepath, finalContent, 'utf-8');
            }

            const stats = await fs.stat(filepath);

            return {
                success: true,
                filepath: filepath,
                filename: filename,
                size: stats.size,
                created: append ? false : true,
                appended: append,
                format,
                timestamp
            };
        } catch (error) {
            console.error('[saveToFile] Ошибка:', error);
            throw new Error(`Не удалось сохранить файл: ${error.message}`);
        }
    }

    /**
     * Получение списка сохраненных файлов
     */
    async getSavedFiles() {
        try {
            const files = await fs.readdir(this.outputDir);
            const filesWithStats = await Promise.all(
                files.map(async (filename) => {
                    const filepath = path.join(this.outputDir, filename);
                    const stats = await fs.stat(filepath);
                    return {
                        filename,
                        size: stats.size,
                        created: stats.birthtime,
                        modified: stats.mtime
                    };
                })
            );
            return filesWithStats;
        } catch (error) {
            console.error('[getSavedFiles] Ошибка:', error);
            return [];
        }
    }

    /**
     * Чтение файла
     */
    async readFile(filename) {
        try {
            const filepath = path.join(this.outputDir, filename);
            const content = await fs.readFile(filepath, 'utf-8');
            return {
                success: true,
                filename,
                content
            };
        } catch (error) {
            throw new Error(`Не удалось прочитать файл: ${error.message}`);
        }
    }
}

module.exports = MCPServers;




