/**
 * MCP Server: DataFormatter
 * Отдельный MCP сервер для форматирования и обработки данных
 * Порт: 8082
 */

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.MCP_FORMATTER_PORT || 8082;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ===== MCP Endpoints =====

// Получение списка доступных tools
app.get('/tools', (req, res) => {
    res.json([
        {
            name: 'format_weather_report',
            description: 'Форматирование данных о погоде в читаемый отчёт (Markdown, HTML, или обычный текст)',
            inputSchema: {
                type: 'object',
                properties: {
                    weatherData: {
                        type: 'object',
                        description: 'Данные о погоде для форматирования'
                    },
                    format: {
                        type: 'string',
                        description: 'Формат вывода: text, markdown, html, json',
                        enum: ['text', 'markdown', 'html', 'json'],
                        default: 'markdown'
                    },
                    includeEmoji: {
                        type: 'boolean',
                        description: 'Добавлять ли emoji для визуализации',
                        default: true
                    },
                    language: {
                        type: 'string',
                        description: 'Язык отчёта: ru, en',
                        enum: ['ru', 'en'],
                        default: 'ru'
                    }
                },
                required: ['weatherData']
            }
        },
        {
            name: 'create_table',
            description: 'Создание таблицы из данных в различных форматах',
            inputSchema: {
                type: 'object',
                properties: {
                    data: {
                        type: 'array',
                        description: 'Массив данных для таблицы'
                    },
                    format: {
                        type: 'string',
                        description: 'Формат таблицы: markdown, html, csv',
                        enum: ['markdown', 'html', 'csv'],
                        default: 'markdown'
                    },
                    headers: {
                        type: 'array',
                        description: 'Заголовки столбцов'
                    }
                },
                required: ['data']
            }
        },
        {
            name: 'beautify_json',
            description: 'Красивое форматирование JSON с подсветкой',
            inputSchema: {
                type: 'object',
                properties: {
                    json: {
                        type: 'object',
                        description: 'JSON для форматирования'
                    },
                    indent: {
                        type: 'number',
                        description: 'Количество пробелов для отступа',
                        default: 2
                    }
                },
                required: ['json']
            }
        },
        {
            name: 'generate_summary',
            description: 'Генерация краткого резюме из данных',
            inputSchema: {
                type: 'object',
                properties: {
                    data: {
                        type: 'object',
                        description: 'Данные для резюмирования'
                    },
                    maxLength: {
                        type: 'number',
                        description: 'Максимальная длина резюме в символах',
                        default: 500
                    }
                },
                required: ['data']
            }
        }
    ]);
});

// Выполнение tool
app.post('/tools/execute', async (req, res) => {
    try {
        const { name, arguments: args } = req.body;

        console.log(`[Formatter] Выполнение tool: ${name}`);

        let result;

        switch (name) {
            case 'format_weather_report':
                result = await formatWeatherReport(args);
                break;
            case 'create_table':
                result = await createTable(args);
                break;
            case 'beautify_json':
                result = await beautifyJson(args);
                break;
            case 'generate_summary':
                result = await generateSummary(args);
                break;
            default:
                return res.status(400).json({ error: `Неизвестный tool: ${name}` });
        }

        res.json(result);
    } catch (error) {
        console.error('[Formatter] Ошибка выполнения:', error);
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
        server: 'DataFormatter MCP',
        version: '1.0.0',
        port: PORT
    });
});

// ===== Tool Implementations =====

async function formatWeatherReport(args) {
    const { weatherData, format = 'markdown', includeEmoji = true, language = 'ru' } = args;

    console.log(`[Formatter] Форматирование погоды: формат=${format}, язык=${language}`);

    const texts = {
        ru: {
            title: '🌤️ Прогноз погоды',
            location: 'Местоположение',
            temperature: 'Температура',
            feelsLike: 'Ощущается как',
            humidity: 'Влажность',
            wind: 'Ветер',
            pressure: 'Давление',
            description: 'Описание',
            timestamp: 'Время обновления'
        },
        en: {
            title: '🌤️ Weather Forecast',
            location: 'Location',
            temperature: 'Temperature',
            feelsLike: 'Feels like',
            humidity: 'Humidity',
            wind: 'Wind',
            pressure: 'Pressure',
            description: 'Description',
            timestamp: 'Updated'
        }
    };

    const t = texts[language];

    // Извлекаем данные (поддержка разных форматов от MCP серверов погоды)
    const location = weatherData.location || weatherData.city || weatherData.name || 'Unknown';
    const temp = weatherData.temperature || weatherData.temp || weatherData.main?.temp || 'N/A';
    const feelsLike = weatherData.feels_like || weatherData.main?.feels_like || temp;
    const humidity = weatherData.humidity || weatherData.main?.humidity || 'N/A';
    const windSpeed = weatherData.wind_speed || weatherData.wind?.speed || 'N/A';
    const pressure = weatherData.pressure || weatherData.main?.pressure || 'N/A';
    const description = weatherData.description || weatherData.weather?.[0]?.description || 'No description';

    let formatted;

    if (format === 'markdown') {
        formatted = `# ${t.title}\n\n`;
        formatted += `**${t.location}:** ${location}\n\n`;
        formatted += `---\n\n`;
        formatted += `${includeEmoji ? '🌡️' : ''} **${t.temperature}:** ${temp}°C\n`;
        formatted += `${includeEmoji ? '🤔' : ''} **${t.feelsLike}:** ${feelsLike}°C\n`;
        formatted += `${includeEmoji ? '💧' : ''} **${t.humidity}:** ${humidity}%\n`;
        formatted += `${includeEmoji ? '💨' : ''} **${t.wind}:** ${windSpeed} м/с\n`;
        formatted += `${includeEmoji ? '🔽' : ''} **${t.pressure}:** ${pressure} гПа\n\n`;
        formatted += `**${t.description}:** ${description}\n\n`;
        formatted += `---\n\n`;
        formatted += `*${t.timestamp}: ${new Date().toLocaleString(language === 'ru' ? 'ru-RU' : 'en-US')}*\n`;
    } else if (format === 'html') {
        formatted = `
<!DOCTYPE html>
<html lang="${language}">
<head>
    <meta charset="UTF-8">
    <title>${t.title}</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; background: #f5f5f5; }
        .weather-card { background: white; border-radius: 10px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; margin-top: 0; }
        .weather-item { margin: 15px 0; padding: 10px; background: #f9f9f9; border-radius: 5px; }
        .weather-item strong { color: #555; }
        .description { font-style: italic; color: #666; margin-top: 20px; }
        .timestamp { text-align: right; color: #999; font-size: 0.9em; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="weather-card">
        <h1>${t.title}</h1>
        <h2>${location}</h2>
        <div class="weather-item">${includeEmoji ? '🌡️' : ''} <strong>${t.temperature}:</strong> ${temp}°C</div>
        <div class="weather-item">${includeEmoji ? '🤔' : ''} <strong>${t.feelsLike}:</strong> ${feelsLike}°C</div>
        <div class="weather-item">${includeEmoji ? '💧' : ''} <strong>${t.humidity}:</strong> ${humidity}%</div>
        <div class="weather-item">${includeEmoji ? '💨' : ''} <strong>${t.wind}:</strong> ${windSpeed} м/с</div>
        <div class="weather-item">${includeEmoji ? '🔽' : ''} <strong>${t.pressure}:</strong> ${pressure} гПа</div>
        <div class="description">${description}</div>
        <div class="timestamp">${t.timestamp}: ${new Date().toLocaleString(language === 'ru' ? 'ru-RU' : 'en-US')}</div>
    </div>
</body>
</html>`;
    } else if (format === 'text') {
        formatted = `${t.title}\n`;
        formatted += `${'='.repeat(40)}\n\n`;
        formatted += `${t.location}: ${location}\n\n`;
        formatted += `${t.temperature}: ${temp}°C\n`;
        formatted += `${t.feelsLike}: ${feelsLike}°C\n`;
        formatted += `${t.humidity}: ${humidity}%\n`;
        formatted += `${t.wind}: ${windSpeed} м/с\n`;
        formatted += `${t.pressure}: ${pressure} гПа\n\n`;
        formatted += `${t.description}: ${description}\n\n`;
        formatted += `${t.timestamp}: ${new Date().toLocaleString(language === 'ru' ? 'ru-RU' : 'en-US')}\n`;
    } else if (format === 'json') {
        formatted = JSON.stringify({
            title: t.title,
            location,
            temperature: { value: temp, unit: '°C' },
            feelsLike: { value: feelsLike, unit: '°C' },
            humidity: { value: humidity, unit: '%' },
            wind: { speed: windSpeed, unit: 'м/с' },
            pressure: { value: pressure, unit: 'гПа' },
            description,
            timestamp: new Date().toISOString()
        }, null, 2);
    }

    return {
        success: true,
        format,
        language,
        formattedData: formatted,
        originalData: weatherData
    };
}

async function createTable(args) {
    const { data, format = 'markdown', headers } = args;

    console.log(`[Formatter] Создание таблицы: формат=${format}, строк=${data.length}`);

    let table;

    if (format === 'markdown') {
        const cols = headers || Object.keys(data[0] || {});
        table = '| ' + cols.join(' | ') + ' |\n';
        table += '|' + cols.map(() => '---').join('|') + '|\n';
        for (const row of data) {
            table += '| ' + cols.map(col => row[col] || '').join(' | ') + ' |\n';
        }
    } else if (format === 'html') {
        const cols = headers || Object.keys(data[0] || {});
        table = '<table border="1" cellpadding="5" cellspacing="0">\n';
        table += '  <thead><tr>' + cols.map(col => `<th>${col}</th>`).join('') + '</tr></thead>\n';
        table += '  <tbody>\n';
        for (const row of data) {
            table += '    <tr>' + cols.map(col => `<td>${row[col] || ''}</td>`).join('') + '</tr>\n';
        }
        table += '  </tbody>\n</table>';
    } else if (format === 'csv') {
        const cols = headers || Object.keys(data[0] || {});
        table = cols.join(',') + '\n';
        for (const row of data) {
            table += cols.map(col => `"${row[col] || ''}"`).join(',') + '\n';
        }
    }

    return {
        success: true,
        format,
        table,
        rowCount: data.length
    };
}

async function beautifyJson(args) {
    const { json, indent = 2 } = args;

    const formatted = JSON.stringify(json, null, indent);

    return {
        success: true,
        formatted,
        size: formatted.length
    };
}

async function generateSummary(args) {
    const { data, maxLength = 500 } = args;

    // Простое резюмирование: извлекаем ключевые поля
    const summary = Object.entries(data)
        .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
        .join(', ')
        .substring(0, maxLength);

    return {
        success: true,
        summary,
        originalSize: JSON.stringify(data).length,
        summarySize: summary.length
    };
}

// ===== Server Start =====

app.listen(PORT, () => {
    console.log('\n' + '='.repeat(60));
    console.log('✨ MCP Server: DataFormatter');
    console.log('='.repeat(60));
    console.log(`Port: ${PORT}`);
    console.log(`Health: http://localhost:${PORT}/health`);
    console.log(`Tools: http://localhost:${PORT}/tools`);
    console.log('='.repeat(60) + '\n');
});



