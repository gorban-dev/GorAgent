/**
 * Development Assistant - Ассистент для разработки
 * Комбинирует RAG (документация проекта) + MCP Git + AI для помощи разработчикам
 */

require('dotenv').config();
const DocumentIndexer = require('./document-indexer');
const MCPGitServer = require('./mcp-server-git');
const path = require('path');

class DevAssistant {
    constructor(options = {}) {
        this.projectPath = options.projectPath || process.cwd();
        this.apiKey = options.apiKey || process.env.OPENAI_API_KEY;
        this.model = options.model || process.env.OPENAI_MODEL || 'gpt-4o-mini';
        
        // Инициализируем компоненты
        this.indexer = new DocumentIndexer({
            apiKey: this.apiKey,
            indexPath: path.join(this.projectPath, 'project-index.json')
        });
        
        this.gitServer = new MCPGitServer(this.projectPath);
        
        this.systemPrompt = `Вы — ассистент для разработки проекта. Вы помогаете разработчикам:
- Находить информацию в документации проекта
- Понимать структуру кода
- Получать информацию о git-репозитории (ветки, коммиты, изменения)
- Отвечать на вопросы о правилах стиля и best practices
- Предлагать фрагменты кода и примеры использования

У вас есть доступ к:
1. Индексированной документации проекта (README, API docs, код)
2. Git-репозиторию (текущая ветка, статус, коммиты)

Отвечайте кратко и по существу. Используйте markdown для форматирования кода.`;
    }

    /**
     * Загрузка индекса документации
     */
    async loadIndex() {
        try {
            await this.indexer.loadIndex();
            console.log('[DevAssistant] Индекс документации загружен');
            return true;
        } catch (error) {
            console.error('[DevAssistant] Ошибка загрузки индекса:', error.message);
            return false;
        }
    }

    /**
     * Получение контекста из git
     */
    async getGitContext() {
        try {
            const branch = await this.gitServer.executeTool('git_current_branch');
            const status = await this.gitServer.executeTool('git_status');
            const commits = await this.gitServer.executeTool('git_recent_commits', { limit: 5 });
            
            return {
                branch: branch.branch,
                status: status.files,
                recentCommits: commits.commits,
                hasChanges: !status.clean
            };
        } catch (error) {
            console.error('[DevAssistant] Ошибка получения git контекста:', error.message);
            return null;
        }
    }

    /**
     * Поиск в документации проекта
     */
    async searchDocs(query, topK = 5) {
        try {
            const results = await this.indexer.search(query, topK);
            return results;
        } catch (error) {
            console.error('[DevAssistant] Ошибка поиска в документации:', error.message);
            return { results: [] };
        }
    }

    /**
     * Выполнение git команды через MCP
     */
    async executeGitTool(toolName, args = {}) {
        try {
            return await this.gitServer.executeTool(toolName, args);
        } catch (error) {
            console.error(`[DevAssistant] Ошибка выполнения ${toolName}:`, error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Определение намерения пользователя (intent detection)
     */
    detectIntent(message) {
        const lowerMessage = message.toLowerCase();
        
        // Git-related queries
        if (lowerMessage.match(/\b(ветка|branch|git|коммит|commit|изменени|change|статус|status)\b/)) {
            return 'git';
        }
        
        // Code search
        if (lowerMessage.match(/\b(где|how|как|функци|function|класс|class|метод|method|код|code)\b/)) {
            return 'code';
        }
        
        // Documentation
        if (lowerMessage.match(/\b(документаци|documentation|readme|api|руководств|guide)\b/)) {
            return 'docs';
        }
        
        // Help command
        if (lowerMessage.match(/^\/help/) || lowerMessage.match(/\b(помощь|help|команд|command)\b/)) {
            return 'help';
        }
        
        return 'general';
    }

    /**
     * Создание контекста для AI
     */
    async buildContext(message, intent) {
        const context = {
            git: null,
            docs: [],
            intent
        };

        // Всегда получаем git контекст
        context.git = await this.getGitContext();

        // Ищем в документации для релевантных запросов
        if (intent === 'docs' || intent === 'code' || intent === 'general') {
            const searchResults = await this.searchDocs(message, 5);
            context.docs = searchResults.results || [];
        }

        return context;
    }

    /**
     * Форматирование контекста для промпта
     */
    formatContext(context) {
        let formatted = '\n## Контекст\n\n';

        // Git информация
        if (context.git) {
            formatted += '### Git репозиторий\n\n';
            formatted += `- **Текущая ветка:** ${context.git.branch}\n`;
            
            if (context.git.hasChanges) {
                formatted += `- **Статус:** Есть несохраненные изменения\n`;
                
                const { modified, added, deleted, untracked } = context.git.status;
                if (modified.length > 0) formatted += `  - Изменено: ${modified.join(', ')}\n`;
                if (added.length > 0) formatted += `  - Добавлено: ${added.join(', ')}\n`;
                if (deleted.length > 0) formatted += `  - Удалено: ${deleted.join(', ')}\n`;
                if (untracked.length > 0) formatted += `  - Не отслеживается: ${untracked.join(', ')}\n`;
            } else {
                formatted += `- **Статус:** Рабочая директория чистая\n`;
            }
            
            if (context.git.recentCommits && context.git.recentCommits.length > 0) {
                formatted += '\n**Последние коммиты:**\n';
                context.git.recentCommits.slice(0, 3).forEach(commit => {
                    formatted += `- \`${commit.hash}\` ${commit.message} (${commit.author})\n`;
                });
            }
            
            formatted += '\n';
        }

        // Документация
        if (context.docs && context.docs.length > 0) {
            formatted += '### Релевантная документация\n\n';
            
            context.docs.forEach((doc, i) => {
                const chunk = doc.chunk;
                const similarity = (doc.similarity * 100).toFixed(1);
                
                formatted += `#### ${i + 1}. ${chunk.metadata.documentName} (релевантность: ${similarity}%)\n\n`;
                formatted += `**Путь:** \`${chunk.metadata.path || 'N/A'}\`\n\n`;
                
                // Показываем часть текста
                const preview = chunk.text.substring(0, 500);
                formatted += `\`\`\`\n${preview}${chunk.text.length > 500 ? '...' : ''}\n\`\`\`\n\n`;
            });
        }

        return formatted;
    }

    /**
     * Обработка команды /help
     */
    getHelpMessage() {
        return `# 🤖 Development Assistant - Команды и возможности

## Что я могу делать?

### 📚 Поиск в документации
- "Как работает система напоминаний?"
- "Где находится API для MCP?"
- "Покажи пример использования DocumentIndexer"

### 🔍 Работа с кодом
- "Где определена функция processDocument?"
- "Как используется класс MCPAgent?"
- "Покажи примеры работы с эмбеддингами"

### 🔀 Git информация
- "Какая сейчас ветка?"
- "Что изменилось в проекте?"
- "Покажи последние коммиты"

### 💡 Правила и best practices
- "Какие есть правила стиля кода?"
- "Как правильно создавать MCP сервер?"
- "Best practices для работы с RAG"

## Специальные команды

- \`/help\` - показать эту справку
- \`/status\` - показать статус проекта и git
- \`/docs <запрос>\` - искать только в документации
- \`/code <запрос>\` - искать только в коде
- \`/git <команда>\` - выполнить git команду

## Примеры вопросов

1. **"Как запустить проект?"** - покажет информацию из README
2. **"Какие есть MCP серверы?"** - найдет документацию по MCP
3. **"Что изменилось?"** - покажет git status
4. **"Где функция sendMessage?"** - найдет в коде

---

Просто задавайте вопросы естественным языком!`;
    }

    /**
     * Получение статуса проекта
     */
    async getProjectStatus() {
        const gitContext = await this.getGitContext();
        const indexStats = this.indexer.getStats();
        
        let status = '# 📊 Статус проекта\n\n';
        
        // Git
        status += '## Git репозиторий\n\n';
        if (gitContext) {
            status += `- **Ветка:** ${gitContext.branch}\n`;
            status += `- **Изменений:** ${gitContext.hasChanges ? 'Есть несохраненные изменения' : 'Чистая рабочая директория'}\n`;
            status += `- **Последний коммит:** ${gitContext.recentCommits[0]?.message || 'N/A'}\n`;
        } else {
            status += '- Git репозиторий не найден\n';
        }
        
        // Индекс документации
        status += '\n## Документация\n\n';
        status += `- **Документов:** ${indexStats.totalDocuments}\n`;
        status += `- **Чанков:** ${indexStats.totalChunks}\n`;
        status += `- **Модель эмбеддингов:** ${indexStats.model}\n`;
        
        return status;
    }

    /**
     * Генерация ответа через OpenAI
     */
    async generateAnswer(message, context) {
        try {
            const contextText = this.formatContext(context);
            
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [
                        { role: 'system', content: this.systemPrompt },
                        { role: 'user', content: `${contextText}\n\n## Вопрос пользователя\n\n${message}` }
                    ],
                    temperature: 0.7,
                    max_tokens: 2000
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
            }

            const data = await response.json();
            return {
                answer: data.choices[0].message.content,
                usage: data.usage
            };
        } catch (error) {
            console.error('[DevAssistant] Ошибка генерации ответа:', error);
            throw error;
        }
    }

    /**
     * Основной метод - обработка сообщения
     */
    async processMessage(message) {
        console.log('[DevAssistant] Обработка:', message);
        
        // Обработка специальных команд
        if (message.toLowerCase().trim() === '/help') {
            return {
                success: true,
                answer: this.getHelpMessage(),
                type: 'help',
                context: null
            };
        }
        
        if (message.toLowerCase().trim() === '/status') {
            const status = await this.getProjectStatus();
            return {
                success: true,
                answer: status,
                type: 'status',
                context: null
            };
        }

        // Определяем намерение
        const intent = this.detectIntent(message);
        console.log('[DevAssistant] Intent:', intent);

        // Собираем контекст
        const context = await this.buildContext(message, intent);

        // Генерируем ответ
        const result = await this.generateAnswer(message, context);

        return {
            success: true,
            answer: result.answer,
            intent,
            context: {
                git: context.git,
                docsCount: context.docs.length
            },
            usage: result.usage
        };
    }

    /**
     * Получение статистики
     */
    getStats() {
        return {
            indexStats: this.indexer.getStats(),
            gitTools: this.gitServer.getTools().length
        };
    }
}

module.exports = DevAssistant;

