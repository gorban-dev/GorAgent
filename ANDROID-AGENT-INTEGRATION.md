# 🤖 Интеграция Android MCP с агентом

## Как использовать Android MCP из агента

Android MCP сервер уже интегрирован в `MCPMultiAgent`. Вы можете использовать его напрямую через метод `executeTool`.

## 📝 Примеры команд для агента

### Базовые команды

Просто скажите агенту:

```
"Открой эмулятор Pixel_5_API_31"
"Запусти первый доступный эмулятор"
"Покажи список всех эмуляторов"
"Какие эмуляторы сейчас запущены?"
"Останови эмулятор"
"Установи APK /path/to/app.apk на эмулятор"
"Сделай скриншот эмулятора"
"Выполни adb shell pm list packages"
```

### Агент автоматически выполнит

```javascript
// Для "Открой эмулятор Pixel_5_API_31"
await agent.executeTool('android', 'start_emulator', {
    name: 'Pixel_5_API_31',
    waitForBoot: true
});

// Для "Покажи список эмуляторов"
await agent.executeTool('android', 'list_emulators', {});

// Для "Останови эмулятор"
await agent.executeTool('android', 'stop_emulator', {});
```

## 💻 Программное использование

### Вариант 1: Через MCPMultiAgent

```javascript
const MCPMultiAgent = require('./mcp-multi-agent');
const agent = new MCPMultiAgent();

// 1. Получить список эмуляторов
const emulatorsResult = await agent.executeTool('android', 'list_emulators', {});
console.log('Доступные эмуляторы:', emulatorsResult.emulators);

// 2. Запустить первый эмулятор
if (emulatorsResult.emulators.length > 0) {
    const startResult = await agent.executeTool('android', 'start_emulator', {
        name: emulatorsResult.emulators[0],
        options: '',
        waitForBoot: true
    });
    console.log(startResult.message);
}

// 3. Проверить статус
const statusResult = await agent.executeTool('android', 'get_emulator_status', {});
console.log('Запущено эмуляторов:', statusResult.runningCount);

// 4. Установить APK
const installResult = await agent.executeTool('android', 'install_apk', {
    apkPath: '/Users/home/Downloads/app.apk'
});
console.log(installResult.message);

// 5. Выполнить ADB команду
const adbResult = await agent.executeTool('android', 'execute_adb_command', {
    command: 'shell pm list packages'
});
console.log('Установленные пакеты:', adbResult.output);

// 6. Сделать скриншот
const screenshotResult = await agent.executeTool('android', 'take_screenshot', {
    outputPath: './test_screenshot.png'
});
console.log(screenshotResult.message);

// 7. Остановить эмулятор
const stopResult = await agent.executeTool('android', 'stop_emulator', {});
console.log(stopResult.message);
```

### Вариант 2: Через прямой HTTP запрос

```javascript
async function callAndroidMCP(toolName, args) {
    const response = await fetch('http://localhost:8083/tools/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: toolName,
            arguments: args
        })
    });
    return await response.json();
}

// Использование
const result = await callAndroidMCP('list_emulators', {});
console.log(result);
```

## 🔄 Интеграция в существующий агент

Если у вас есть свой агент, добавьте Android MCP:

```javascript
class MyAgent {
    constructor() {
        this.servers = {
            // ... другие серверы
            android: 'http://localhost:8083'
        };
    }

    async callTool(serverName, toolName, args) {
        const serverUrl = this.servers[serverName];
        const response = await fetch(`${serverUrl}/tools/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: toolName, arguments: args })
        });
        return await response.json();
    }

    async openEmulator(name) {
        return await this.callTool('android', 'start_emulator', {
            name: name,
            waitForBoot: true
        });
    }

    async closeEmulator() {
        return await this.callTool('android', 'stop_emulator', {});
    }
}
```

## 🎯 Сценарии использования

### Сценарий 1: Автоматическое тестирование

```javascript
async function runAutomatedTest() {
    const agent = new MCPMultiAgent();

    console.log('🚀 Запуск автоматического теста...');

    // 1. Запуск чистого эмулятора
    await agent.executeTool('android', 'start_emulator', {
        name: 'Test_Device_API_31',
        options: '-wipe-data',
        waitForBoot: true
    });

    // 2. Установка приложения
    await agent.executeTool('android', 'install_apk', {
        apkPath: './app/build/outputs/apk/debug/app-debug.apk'
    });

    // 3. Запуск приложения
    await agent.executeTool('android', 'execute_adb_command', {
        command: 'shell am start -n com.example.app/.MainActivity'
    });

    // 4. Ожидание загрузки
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 5. Взаимодействие с приложением
    await agent.executeTool('android', 'execute_adb_command', {
        command: 'shell input text "Test User"'
    });

    await agent.executeTool('android', 'execute_adb_command', {
        command: 'shell input keyevent KEYCODE_ENTER'
    });

    // 6. Скриншот результата
    await agent.executeTool('android', 'take_screenshot', {
        outputPath: './test_results/result.png'
    });

    // 7. Очистка
    await agent.executeTool('android', 'stop_emulator', {});

    console.log('✅ Тест завершен!');
}
```

### Сценарий 2: Быстрая проверка приложения

```javascript
async function quickAppCheck(apkPath) {
    const agent = new MCPMultiAgent();

    // Получаем список эмуляторов
    const emulators = await agent.executeTool('android', 'list_emulators', {});
    
    if (emulators.count === 0) {
        console.error('❌ Нет доступных эмуляторов');
        return;
    }

    // Проверяем, запущен ли эмулятор
    const status = await agent.executeTool('android', 'get_emulator_status', {});
    
    if (status.runningCount === 0) {
        // Запускаем первый доступный
        console.log('🚀 Запуск эмулятора...');
        await agent.executeTool('android', 'start_emulator', {
            name: emulators.emulators[0],
            waitForBoot: true
        });
    }

    // Устанавливаем APK
    console.log('📦 Установка APK...');
    await agent.executeTool('android', 'install_apk', {
        apkPath: apkPath
    });

    console.log('✅ Приложение установлено и готово к тестированию!');
}
```

### Сценарий 3: Мониторинг эмуляторов

```javascript
async function monitorEmulators() {
    const agent = new MCPMultiAgent();

    setInterval(async () => {
        const status = await agent.executeTool('android', 'get_emulator_status', {});
        
        console.log(`📊 Статус эмуляторов (${new Date().toLocaleTimeString()}):`);
        console.log(`   Всего устройств: ${status.totalDevices}`);
        console.log(`   Запущенных эмуляторов: ${status.runningCount}`);
        
        if (status.devices.length > 0) {
            status.devices.forEach(device => {
                console.log(`   - ${device.id}: ${device.status} (${device.type})`);
            });
        }
    }, 30000); // Каждые 30 секунд
}
```

## 📋 Доступные параметры

### start_emulator

```javascript
{
    name: 'Pixel_5_API_31',          // Обязательно: имя эмулятора
    options: '-no-snapshot-load',    // Опционально: доп. опции
    waitForBoot: true                // Опционально: ждать загрузки (по умолчанию: true)
}
```

**Полезные опции:**
- `-no-snapshot-load` - не загружать снимок
- `-wipe-data` - очистить данные
- `-no-audio` - без звука
- `-gpu swiftshader_indirect` - программный рендеринг

### install_apk

```javascript
{
    apkPath: '/path/to/app.apk',     // Обязательно: путь к APK
    device: 'emulator-5554'          // Опционально: конкретное устройство
}
```

### execute_adb_command

```javascript
{
    command: 'shell pm list packages',  // Обязательно: команда (без "adb")
    device: 'emulator-5554'             // Опционально: конкретное устройство
}
```

**Популярные команды:**
- `devices` - список устройств
- `shell pm list packages` - список приложений
- `shell getprop` - свойства устройства
- `shell dumpsys battery` - информация о батарее
- `shell input text "Hello"` - ввод текста
- `shell input keyevent KEYCODE_HOME` - нажатие кнопки Home
- `shell screencap /sdcard/screen.png` - скриншот
- `pull /sdcard/file.txt ./file.txt` - скачать файл

### take_screenshot

```javascript
{
    outputPath: './screenshot.png',  // Опционально: путь для сохранения
    device: 'emulator-5554'          // Опционально: конкретное устройство
}
```

## 🔧 Настройка агента для работы с Android MCP

### Добавление в app.js (веб-чат)

```javascript
// В app.js после других эндпоинтов

// Эндпоинт для Android MCP
app.post('/api/android/execute', async (req, res) => {
    try {
        const { tool, args } = req.body;
        
        const response = await fetch('http://localhost:8083/tools/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: tool,
                arguments: args
            })
        });

        const result = await response.json();
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
```

### Добавление команд в системный промпт

Обновите системный промпт агента:

```javascript
const systemPrompt = `
Ты - умный AI ассистент с доступом к следующим инструментам:

...

**Android Emulator Control:**
- list_emulators() - получить список эмуляторов
- start_emulator(name) - запустить эмулятор
- stop_emulator() - остановить эмулятор
- install_apk(apkPath) - установить APK
- execute_adb_command(command) - выполнить ADB команду

Когда пользователь просит:
- "открой эмулятор" → используй start_emulator
- "покажи эмуляторы" → используй list_emulators
- "останови эмулятор" → используй stop_emulator
- "установи приложение" → используй install_apk
`;
```

## 🐛 Отладка

### Проверка доступности сервера

```javascript
async function checkAndroidMCP() {
    try {
        const response = await fetch('http://localhost:8083/health');
        const health = await response.json();
        console.log('✅ Android MCP доступен:', health);
        return true;
    } catch (error) {
        console.error('❌ Android MCP недоступен:', error.message);
        return false;
    }
}
```

### Логирование выполнения

```javascript
async function executeToolWithLogging(agent, serverName, toolName, args) {
    console.log(`🔧 Выполнение: ${serverName}.${toolName}`);
    console.log('   Параметры:', args);
    
    const startTime = Date.now();
    const result = await agent.executeTool(serverName, toolName, args);
    const duration = Date.now() - startTime;
    
    console.log(`✅ Завершено за ${duration}ms`);
    console.log('   Результат:', result);
    
    return result;
}
```

## 📚 Дополнительные ресурсы

- [Быстрый старт](./START-ANDROID-MCP.md) - начало работы
- [Полное руководство](./ANDROID-MCP-GUIDE.md) - все возможности
- [Тестовый скрипт](./test-android-agent.js) - примеры использования
- [Веб-интерфейс](./mcp-android-demo.html) - визуальное управление

## 💡 Советы

1. **Всегда проверяйте доступность сервера** перед выполнением команд
2. **Используйте `waitForBoot: true`** при запуске эмуляторов для корректной работы
3. **Указывайте абсолютные пути** для APK файлов
4. **Создайте несколько эмуляторов** с разными конфигурациями для тестирования
5. **Используйте `-wipe-data`** для чистого старта в автотестах

---

**Готово!** 🎉 Теперь вы можете управлять Android эмуляторами через агента.

