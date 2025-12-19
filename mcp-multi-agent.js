/**
 * MCP Multi-Server Agent
 * Агент для координации работы нескольких независимых MCP серверов
 * Цепочка: Weather MCP → Formatter MCP → FileSaver MCP
 */

class MCPMultiAgent {
    constructor(config = {}) {
        this.servers = {
            weather: config.weatherUrl || 'http://localhost:8080',
            formatter: config.formatterUrl || 'http://localhost:8082',
            fileSaver: config.fileSaverUrl || 'http://localhost:8081'
        };
        this.executionHistory = [];
    }

    /**
     * Вызов tool на конкретном MCP сервере
     */
    async callMCPServer(serverUrl, toolName, args) {
        console.log(`[MCP Agent] Вызов ${serverUrl}/tools/execute: ${toolName}`);
        
        const response = await fetch(`${serverUrl}/tools/execute`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: toolName,
                arguments: args
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `MCP Server error: ${response.status}`);
        }

        return await response.json();
    }

    /**
     * Получение списка tools от MCP сервера
     */
    async getMCPTools(serverUrl) {
        const response = await fetch(`${serverUrl}/tools`);
        if (!response.ok) {
            throw new Error(`Failed to get tools from ${serverUrl}`);
        }
        return await response.json();
    }

    /**
     * Проверка доступности MCP сервера
     */
    async checkMCPServer(serverUrl) {
        try {
            const response = await fetch(`${serverUrl}/health`, {
                method: 'GET',
                timeout: 3000
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    /**
     * Цепочка: Получить погоду → Форматировать → Сохранить
     */
    async executeWeatherChain(city, options = {}) {
        const {
            format = 'markdown',
            language = 'ru',
            includeEmoji = true,
            saveFormat = 'md'
        } = options;

        console.log('\n' + '🔗'.repeat(30));
        console.log(`[MCP Multi-Agent] Запуск цепочки для города: ${city}`);
        console.log('🔗'.repeat(30) + '\n');

        const execution = {
            id: `chain_${Date.now()}`,
            city,
            startTime: new Date(),
            steps: [],
            status: 'running'
        };

        try {
            // ШАГ 1: Получение погоды (Weather MCP)
            console.log('\n📍 ШАГ 1/3: Получение данных о погоде...');
            const stepWeatherStart = Date.now();

            const weatherResult = await this.callMCPServer(
                this.servers.weather,
                'get_weather',
                { city: city }
            );

            const stepWeatherTime = Date.now() - stepWeatherStart;

            // Парсим строковый ответ от Weather MCP в объект
            const weatherData = this.parseWeatherResponse(weatherResult);

            execution.steps.push({
                step: 1,
                server: 'Weather MCP',
                tool: 'get_weather',
                status: 'completed',
                duration: stepWeatherTime,
                result: weatherResult,
                parsedData: weatherData
            });

            console.log(`✅ Погода получена за ${stepWeatherTime}ms`);
            console.log(`   Локация: ${weatherData.location}`);
            console.log(`   Температура: ${weatherData.temperature}°C`);

            // ШАГ 2: Форматирование (Formatter MCP)
            console.log('\n📍 ШАГ 2/3: Форматирование данных...');
            const stepFormatterStart = Date.now();

            const formattedResult = await this.callMCPServer(
                this.servers.formatter,
                'format_weather_report',
                {
                    weatherData: weatherData, // Используем распарсенные данные
                    format: format,
                    language: language,
                    includeEmoji: includeEmoji
                }
            );

            const stepFormatterTime = Date.now() - stepFormatterStart;

            execution.steps.push({
                step: 2,
                server: 'Formatter MCP',
                tool: 'format_weather_report',
                status: 'completed',
                duration: stepFormatterTime,
                result: formattedResult
            });

            console.log(`✅ Данные форматированы за ${stepFormatterTime}ms`);

            // ШАГ 3: Сохранение (FileSaver MCP)
            console.log('\n📍 ШАГ 3/3: Сохранение результата...');
            const stepSaverStart = Date.now();

            const filename = this.generateFilename(city, saveFormat);

            const savedResult = await this.callMCPServer(
                this.servers.fileSaver,
                'save_to_file',
                {
                    content: formattedResult.formattedData,
                    filename: filename,
                    format: saveFormat,
                    metadata: {
                        city: city,
                        generatedAt: new Date().toISOString(),
                        chain: 'weather-formatter-filesaver'
                    }
                }
            );

            const stepSaverTime = Date.now() - stepSaverStart;

            execution.steps.push({
                step: 3,
                server: 'FileSaver MCP',
                tool: 'save_to_file',
                status: 'completed',
                duration: stepSaverTime,
                result: savedResult
            });

            console.log(`✅ Файл сохранён: ${savedResult.filename} (${stepSaverTime}ms)`);

            // Завершение
            execution.endTime = new Date();
            execution.totalDuration = Date.now() - execution.startTime.getTime();
            execution.status = 'completed';
            execution.savedFile = savedResult.filepath;

            this.executionHistory.push(execution);

            console.log('\n' + '✨'.repeat(30));
            console.log(`[MCP Multi-Agent] Цепочка успешно выполнена за ${execution.totalDuration}ms`);
            console.log(`📁 Файл: ${savedResult.filepath}`);
            console.log('✨'.repeat(30) + '\n');

            return {
                success: true,
                execution,
                weatherData: weatherData, // Возвращаем распарсенные данные
                rawWeatherData: weatherResult, // Сырые данные для отладки
                formattedData: formattedResult.formattedData,
                savedFile: savedResult.filepath
            };

        } catch (error) {
            console.error('\n❌ [MCP Multi-Agent] Ошибка выполнения цепочки:', error);

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
     * Парсинг строкового ответа от Weather MCP в объект
     */
    parseWeatherResponse(weatherResult) {
        // Проверяем формат ответа
        if (!weatherResult || !weatherResult.result) {
            console.warn('[Parse] Нет данных в ответе Weather MCP');
            return this.getEmptyWeatherData();
        }

        const resultString = weatherResult.result;

        // Если уже объект - возвращаем как есть
        if (typeof resultString === 'object') {
            return resultString;
        }

        // Парсим строку
        console.log('[Parse] Парсинг строки от Weather MCP...');
        
        const weatherData = {
            location: 'Unknown',
            temperature: 'N/A',
            feels_like: 'N/A',
            humidity: 'N/A',
            wind_speed: 'N/A',
            pressure: 'N/A',
            description: 'No description'
        };

        try {
            // Извлекаем данные из строки формата:
            // "Weather in Bratsk, RU:\nTemperature: -22.73°C\nDescription: overcast clouds\nHumidity: 98%\nWind Speed: 1.48 m/s"
            
            // Локация
            const locationMatch = resultString.match(/Weather in ([^:]+):/);
            if (locationMatch) {
                weatherData.location = locationMatch[1].trim();
            }

            // Температура
            const tempMatch = resultString.match(/Temperature:\s*([-\d.]+)°C/);
            if (tempMatch) {
                weatherData.temperature = parseFloat(tempMatch[1]);
                weatherData.feels_like = weatherData.temperature; // По умолчанию
            }

            // Описание
            const descMatch = resultString.match(/Description:\s*([^\n]+)/);
            if (descMatch) {
                weatherData.description = descMatch[1].trim();
            }

            // Влажность
            const humidityMatch = resultString.match(/Humidity:\s*(\d+)%/);
            if (humidityMatch) {
                weatherData.humidity = parseInt(humidityMatch[1]);
            }

            // Скорость ветра
            const windMatch = resultString.match(/Wind Speed:\s*([\d.]+)\s*m\/s/);
            if (windMatch) {
                weatherData.wind_speed = parseFloat(windMatch[1]);
            }

            // Давление (если есть)
            const pressureMatch = resultString.match(/Pressure:\s*(\d+)/);
            if (pressureMatch) {
                weatherData.pressure = parseInt(pressureMatch[1]);
            }

            console.log('[Parse] Успешно распарсено:', weatherData);
            return weatherData;

        } catch (error) {
            console.error('[Parse] Ошибка парсинга:', error);
            return this.getEmptyWeatherData();
        }
    }

    /**
     * Пустой объект погоды (fallback)
     */
    getEmptyWeatherData() {
        return {
            location: 'Unknown',
            temperature: 'N/A',
            feels_like: 'N/A',
            humidity: 'N/A',
            wind_speed: 'N/A',
            pressure: 'N/A',
            description: 'No data available'
        };
    }

    /**
     * Генерация имени файла
     */
    generateFilename(city, format) {
        const cleanCity = city
            .toLowerCase()
            .replace(/[^а-яa-z0-9]/gi, '-');
        const timestamp = new Date().toISOString().split('T')[0];
        return `weather-${cleanCity}-${timestamp}.${format}`;
    }

    /**
     * Проверка доступности всех MCP серверов
     */
    async checkAllServers() {
        const results = {};

        for (const [name, url] of Object.entries(this.servers)) {
            console.log(`Проверка ${name} (${url})...`);
            results[name] = {
                url,
                available: await this.checkMCPServer(url)
            };
        }

        return results;
    }

    /**
     * Получение списка всех доступных tools от всех серверов
     */
    async getAllTools() {
        const allTools = {};

        for (const [name, url] of Object.entries(this.servers)) {
            try {
                const tools = await this.getMCPTools(url);
                allTools[name] = {
                    url,
                    tools,
                    count: tools.length
                };
            } catch (error) {
                allTools[name] = {
                    url,
                    error: error.message,
                    tools: []
                };
            }
        }

        return allTools;
    }

    /**
     * Статистика выполнения
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
     * История выполнения
     */
    getExecutionHistory() {
        return this.executionHistory;
    }

    /**
     * Примеры использования
     */
    async runExamples() {
        console.log('\n🎯 Запуск примеров использования MCP Multi-Agent...\n');

        // Проверка доступности серверов
        console.log('🔍 Проверка доступности MCP серверов...\n');
        const serverStatus = await this.checkAllServers();
        
        for (const [name, status] of Object.entries(serverStatus)) {
            const icon = status.available ? '✅' : '❌';
            console.log(`${icon} ${name}: ${status.url} - ${status.available ? 'доступен' : 'недоступен'}`);
        }

        const allAvailable = Object.values(serverStatus).every(s => s.available);
        
        if (!allAvailable) {
            console.log('\n⚠️  Не все MCP серверы доступны. Запустите их перед выполнением примеров:');
            console.log('   - Weather MCP (порт 8080) - ваш существующий сервер');
            console.log('   - node mcp-server-formatter.js (порт 8082)');
            console.log('   - node mcp-server-filesaver.js (порт 8081)');
            return;
        }

        console.log('\n✅ Все серверы доступны! Запускаем цепочки...\n');

        // Пример 1: Москва, Markdown
        console.log('📝 Пример 1: Погода в Москве (Markdown)');
        await this.executeWeatherChain('Москва', {
            format: 'markdown',
            language: 'ru',
            includeEmoji: true,
            saveFormat: 'md'
        });

        await new Promise(resolve => setTimeout(resolve, 1000));

        // Пример 2: Шерегеш, HTML
        console.log('\n📝 Пример 2: Погода в Шерегеше (HTML)');
        await this.executeWeatherChain('Шерегеш', {
            format: 'html',
            language: 'ru',
            includeEmoji: true,
            saveFormat: 'html'
        });

        await new Promise(resolve => setTimeout(resolve, 1000));

        // Пример 3: Братск, Text
        console.log('\n📝 Пример 3: Погода в Братске (Text)');
        await this.executeWeatherChain('Братск', {
            format: 'text',
            language: 'ru',
            includeEmoji: false,
            saveFormat: 'txt'
        });

        console.log('\n✅ Все примеры выполнены!\n');

        // Показываем статистику
        console.log('📊 Статистика выполнения:');
        console.log(this.getStats());
    }
}

module.exports = MCPMultiAgent;

// Если запускается напрямую (для тестирования)
if (require.main === module) {
    const agent = new MCPMultiAgent();

    console.log('🤖 Запуск MCP Multi-Agent в режиме тестирования...\n');

    // Запускаем примеры
    agent.runExamples().then(() => {
        console.log('\n✨ Тестирование завершено!');
        process.exit(0);
    }).catch(error => {
        console.error('\n❌ Ошибка:', error);
        process.exit(1);
    });
}

