#!/usr/bin/env node
/**
 * Project Documentation Indexer - Индексация документации проекта
 * Автоматически находит и индексирует:
 * - README и другие .md файлы
 * - Исходный код (.js, .ts, .py и т.д.)
 * - API документацию
 */

require('dotenv').config();
const DocumentIndexer = require('./document-indexer');
const fs = require('fs').promises;
const path = require('path');

class ProjectDocIndexer {
    constructor(projectPath = process.cwd()) {
        this.projectPath = projectPath;
        this.indexer = new DocumentIndexer({
            indexPath: path.join(projectPath, 'project-index.json')
        });
        
        // Расширения файлов для индексации
        this.codeExtensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.go', '.rs'];
        this.docExtensions = ['.md', '.txt', '.rst'];
        
        // Игнорируемые директории
        this.ignoreDirs = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage', 'logs'];
    }

    /**
     * Проверка, нужно ли игнорировать директорию
     */
    shouldIgnoreDir(dirName) {
        return this.ignoreDirs.includes(dirName) || dirName.startsWith('.');
    }

    /**
     * Проверка, нужно ли индексировать файл
     */
    shouldIndexFile(filename) {
        const ext = path.extname(filename);
        return this.docExtensions.includes(ext) || this.codeExtensions.includes(ext);
    }

    /**
     * Рекурсивный обход директорий
     */
    async walkDirectory(dir, fileList = []) {
        const files = await fs.readdir(dir);
        
        for (const file of files) {
            const filepath = path.join(dir, file);
            const stat = await fs.stat(filepath);
            
            if (stat.isDirectory()) {
                if (!this.shouldIgnoreDir(file)) {
                    await this.walkDirectory(filepath, fileList);
                }
            } else if (stat.isFile()) {
                if (this.shouldIndexFile(file)) {
                    fileList.push(filepath);
                }
            }
        }
        
        return fileList;
    }

    /**
     * Определение типа файла для метаданных
     */
    getFileType(filepath) {
        const ext = path.extname(filepath);
        
        if (this.docExtensions.includes(ext)) {
            return 'documentation';
        } else if (this.codeExtensions.includes(ext)) {
            return 'code';
        }
        
        return 'other';
    }

    /**
     * Определение языка программирования
     */
    getLanguage(filepath) {
        const ext = path.extname(filepath);
        const langMap = {
            '.js': 'javascript',
            '.jsx': 'javascript',
            '.ts': 'typescript',
            '.tsx': 'typescript',
            '.py': 'python',
            '.java': 'java',
            '.go': 'go',
            '.rs': 'rust',
            '.md': 'markdown',
            '.txt': 'text'
        };
        
        return langMap[ext] || 'unknown';
    }

    /**
     * Извлечение функций и классов из кода (простая эвристика)
     */
    extractCodeStructure(content, language) {
        const structure = {
            functions: [],
            classes: [],
            exports: []
        };

        if (language === 'javascript' || language === 'typescript') {
            // Находим функции
            const functionRegex = /(?:async\s+)?(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(|(\w+)\s*\([^)]*\)\s*{)/g;
            let match;
            while ((match = functionRegex.exec(content)) !== null) {
                const name = match[1] || match[2] || match[3];
                if (name && !structure.functions.includes(name)) {
                    structure.functions.push(name);
                }
            }

            // Находим классы
            const classRegex = /class\s+(\w+)/g;
            while ((match = classRegex.exec(content)) !== null) {
                structure.classes.push(match[1]);
            }

            // Находим exports
            const exportRegex = /export\s+(?:default\s+)?(?:class|function|const|let|var)?\s*(\w+)?/g;
            while ((match = exportRegex.exec(content)) !== null) {
                if (match[1] && !structure.exports.includes(match[1])) {
                    structure.exports.push(match[1]);
                }
            }
        }

        return structure;
    }

    /**
     * Извлечение заголовков из Markdown
     */
    extractMarkdownHeaders(content) {
        const headers = [];
        const headerRegex = /^(#{1,6})\s+(.+)$/gm;
        let match;
        
        while ((match = headerRegex.exec(content)) !== null) {
            headers.push({
                level: match[1].length,
                text: match[2].trim()
            });
        }
        
        return headers;
    }

    /**
     * Индексация одного файла
     */
    async indexFile(filepath) {
        try {
            const content = await fs.readFile(filepath, 'utf-8');
            const relativePath = path.relative(this.projectPath, filepath);
            const filename = path.basename(filepath);
            const fileType = this.getFileType(filepath);
            const language = this.getLanguage(filepath);
            
            const metadata = {
                name: filename,
                path: relativePath,
                type: fileType,
                language,
                size: content.length
            };

            // Добавляем специфичные метаданные
            if (fileType === 'code') {
                metadata.structure = this.extractCodeStructure(content, language);
            } else if (fileType === 'documentation' && language === 'markdown') {
                metadata.headers = this.extractMarkdownHeaders(content);
            }

            console.log(`[Indexer] Индексация: ${relativePath} (${language})`);
            
            return {
                content,
                metadata
            };
        } catch (error) {
            console.error(`[Indexer] Ошибка чтения ${filepath}:`, error.message);
            return null;
        }
    }

    /**
     * Индексация всего проекта
     */
    async indexProject() {
        console.log(`\n[Project Indexer] Сканирование проекта: ${this.projectPath}\n`);
        
        // Находим все файлы
        const files = await this.walkDirectory(this.projectPath);
        console.log(`[Project Indexer] Найдено файлов: ${files.length}\n`);

        // Сортируем: сначала документация, потом код
        files.sort((a, b) => {
            const aIsDoc = this.getFileType(a) === 'documentation';
            const bIsDoc = this.getFileType(b) === 'documentation';
            if (aIsDoc && !bIsDoc) return -1;
            if (!aIsDoc && bIsDoc) return 1;
            return 0;
        });

        // Индексируем файлы
        const documents = [];
        for (const filepath of files) {
            const doc = await this.indexFile(filepath);
            if (doc) {
                documents.push(doc);
            }
        }

        console.log(`\n[Project Indexer] Обработка документов...\n`);
        
        // Обрабатываем через DocumentIndexer
        const results = await this.indexer.processDocuments(documents);
        
        // Сохраняем индекс
        const saveResult = await this.indexer.saveIndex();
        
        console.log(`\n[Project Indexer] ✅ Индексация завершена!`);
        console.log(`[Project Indexer] Файлов проиндексировано: ${documents.length}`);
        console.log(`[Project Indexer] Индекс сохранен: ${saveResult.path}`);
        console.log(`[Project Indexer] Размер индекса: ${(saveResult.size / 1024).toFixed(2)} KB`);
        
        return {
            success: true,
            files: documents.length,
            ...saveResult
        };
    }

    /**
     * Получение статистики проекта
     */
    async getProjectStats() {
        const stats = this.indexer.getStats();
        const documents = this.indexer.getDocuments();
        
        const byType = {
            documentation: 0,
            code: 0,
            other: 0
        };
        
        const byLanguage = {};
        
        for (const doc of documents) {
            const type = doc.metadata.documentType || 'other';
            byType[type] = (byType[type] || 0) + 1;
            
            const lang = doc.metadata.language || 'unknown';
            byLanguage[lang] = (byLanguage[lang] || 0) + 1;
        }
        
        return {
            ...stats,
            byType,
            byLanguage
        };
    }
}

// CLI использование
if (require.main === module) {
    const indexer = new ProjectDocIndexer();
    
    indexer.indexProject()
        .then(result => {
            console.log('\n📊 Результат:');
            console.log(JSON.stringify(result, null, 2));
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ Ошибка:', error.message);
            process.exit(1);
        });
}

module.exports = ProjectDocIndexer;

