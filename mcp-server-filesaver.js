/**
 * MCP Server: FileSaver
 * Отдельный MCP сервер для сохранения данных в файлы
 * Порт: 8081
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.MCP_FILESAVER_PORT || 8081;
const OUTPUT_DIR = path.join(__dirname, 'mcp-data');

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Инициализация директории для файлов
async function initOutputDir() {
    try {
        await fs.mkdir(OUTPUT_DIR, { recursive: true });
        console.log(`[FileSaver] Директория создана: ${OUTPUT_DIR}`);
    } catch (error) {
        console.error('[FileSaver] Ошибка создания директории:', error);
    }
}

// ===== MCP Endpoints =====

// Получение списка доступных tools
app.get('/tools', (req, res) => {
    res.json([
        {
            name: 'save_to_file',
            description: 'Сохранение текстовых данных в файл. Поддерживает форматы: txt, md, json, html',
            inputSchema: {
                type: 'object',
                properties: {
                    content: {
                        type: 'string',
                        description: 'Содержимое для сохранения в файл'
                    },
                    filename: {
                        type: 'string',
                        description: 'Имя файла (с расширением или без)'
                    },
                    format: {
                        type: 'string',
                        description: 'Формат файла: txt, md, json, html',
                        enum: ['txt', 'md', 'json', 'html'],
                        default: 'txt'
                    },
                    metadata: {
                        type: 'object',
                        description: 'Дополнительные метаданные для добавления в файл'
                    }
                },
                required: ['content', 'filename']
            }
        },
        {
            name: 'append_to_file',
            description: 'Добавление данных к существующему файлу',
            inputSchema: {
                type: 'object',
                properties: {
                    content: {
                        type: 'string',
                        description: 'Содержимое для добавления'
                    },
                    filename: {
                        type: 'string',
                        description: 'Имя файла'
                    }
                },
                required: ['content', 'filename']
            }
        },
        {
            name: 'list_files',
            description: 'Получение списка всех сохранённых файлов',
            inputSchema: {
                type: 'object',
                properties: {
                    pattern: {
                        type: 'string',
                        description: 'Паттерн для фильтрации (опционально)'
                    }
                }
            }
        },
        {
            name: 'read_file',
            description: 'Чтение содержимого файла',
            inputSchema: {
                type: 'object',
                properties: {
                    filename: {
                        type: 'string',
                        description: 'Имя файла для чтения'
                    }
                },
                required: ['filename']
            }
        }
    ]);
});

// Выполнение tool
app.post('/tools/execute', async (req, res) => {
    try {
        const { name, arguments: args } = req.body;

        console.log(`[FileSaver] Выполнение tool: ${name}`, args);

        let result;

        switch (name) {
            case 'save_to_file':
                result = await saveToFile(args);
                break;
            case 'append_to_file':
                result = await appendToFile(args);
                break;
            case 'list_files':
                result = await listFiles(args);
                break;
            case 'read_file':
                result = await readFile(args);
                break;
            default:
                return res.status(400).json({ error: `Неизвестный tool: ${name}` });
        }

        res.json(result);
    } catch (error) {
        console.error('[FileSaver] Ошибка выполнения:', error);
        res.status(500).json({ 
            error: error.message,
            tool: req.body.name 
        });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        server: 'FileSaver MCP',
        version: '1.0.0',
        port: PORT,
        outputDir: OUTPUT_DIR
    });
});

// ===== Tool Implementations =====

async function saveToFile(args) {
    const { content, filename, format = 'txt', metadata = {} } = args;

    // Добавляем расширение если его нет
    let finalFilename = filename;
    if (!path.extname(filename)) {
        finalFilename = `${filename}.${format}`;
    }

    const filepath = path.join(OUTPUT_DIR, finalFilename);

    // Формируем финальный контент с метаданными
    let finalContent = content;

    if (format === 'md' || format === 'txt') {
        const header = [
            '---',
            `Created: ${new Date().toISOString()}`,
            `Format: ${format}`,
            ...Object.entries(metadata).map(([key, value]) => `${key}: ${value}`),
            '---',
            ''
        ].join('\n');
        finalContent = header + '\n' + content;
    } else if (format === 'json') {
        try {
            const jsonData = typeof content === 'string' ? JSON.parse(content) : content;
            finalContent = JSON.stringify({
                metadata: {
                    created: new Date().toISOString(),
                    ...metadata
                },
                data: jsonData
            }, null, 2);
        } catch (e) {
            // Если не JSON, оборачиваем
            finalContent = JSON.stringify({
                metadata: {
                    created: new Date().toISOString(),
                    ...metadata
                },
                data: { content }
            }, null, 2);
        }
    } else if (format === 'html') {
        finalContent = `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="created" content="${new Date().toISOString()}">
    <title>${filename}</title>
</head>
<body>
${content}
</body>
</html>`;
    }

    await fs.writeFile(filepath, finalContent, 'utf-8');

    const stats = await fs.stat(filepath);

    console.log(`[FileSaver] Файл сохранён: ${filepath} (${stats.size} bytes)`);

    return {
        success: true,
        filepath: filepath,
        filename: finalFilename,
        size: stats.size,
        format: format,
        created: new Date().toISOString()
    };
}

async function appendToFile(args) {
    const { content, filename } = args;
    const filepath = path.join(OUTPUT_DIR, filename);

    await fs.appendFile(filepath, '\n' + content, 'utf-8');

    const stats = await fs.stat(filepath);

    console.log(`[FileSaver] Данные добавлены в файл: ${filepath}`);

    return {
        success: true,
        filepath: filepath,
        filename: filename,
        size: stats.size,
        appended: true
    };
}

async function listFiles(args) {
    const { pattern } = args || {};

    let files = await fs.readdir(OUTPUT_DIR);

    if (pattern) {
        const regex = new RegExp(pattern, 'i');
        files = files.filter(f => regex.test(f));
    }

    const filesWithStats = await Promise.all(
        files.map(async (filename) => {
            const filepath = path.join(OUTPUT_DIR, filename);
            const stats = await fs.stat(filepath);
            return {
                filename,
                size: stats.size,
                created: stats.birthtime,
                modified: stats.mtime
            };
        })
    );

    console.log(`[FileSaver] Найдено файлов: ${filesWithStats.length}`);

    return {
        success: true,
        files: filesWithStats,
        count: filesWithStats.length
    };
}

async function readFile(args) {
    const { filename } = args;
    const filepath = path.join(OUTPUT_DIR, filename);

    const content = await fs.readFile(filepath, 'utf-8');

    console.log(`[FileSaver] Файл прочитан: ${filepath}`);

    return {
        success: true,
        filename,
        content
    };
}

// ===== Server Start =====

initOutputDir().then(() => {
    app.listen(PORT, () => {
        console.log('\n' + '='.repeat(60));
        console.log('🗄️  MCP Server: FileSaver');
        console.log('='.repeat(60));
        console.log(`Port: ${PORT}`);
        console.log(`Output Dir: ${OUTPUT_DIR}`);
        console.log(`Health: http://localhost:${PORT}/health`);
        console.log(`Tools: http://localhost:${PORT}/tools`);
        console.log('='.repeat(60) + '\n');
    });
});





