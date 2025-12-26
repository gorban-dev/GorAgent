# 🚀 Быстрый старт: Android Emulator MCP

## Что это?

Android Emulator MCP Server — это MCP сервер для управления Android эмуляторами через ADB команды. Вы можете запускать, останавливать эмуляторы, устанавливать APK и выполнять другие операции через простой API.

## ⚡ Быстрый запуск за 3 шага

### 1. Проверьте, что ADB установлен

```bash
adb version
```

Если ADB не найден:
- Установите Android Studio
- Добавьте в PATH:

```bash
# macOS/Linux (добавьте в ~/.bashrc или ~/.zshrc)
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/emulator

# Применить изменения
source ~/.bashrc  # или ~/.zshrc
```

### 2. Запустите сервер

```bash
# Только Android сервер
node mcp-server-android.js

# Или все MCP серверы
bash start-mcp-servers.sh
```

Сервер будет доступен на **http://localhost:8083**

### 3. Используйте

**Вариант А: Веб-интерфейс**

Откройте в браузере:
```
mcp-android-demo.html
```

**Вариант Б: Из Node.js**

```javascript
const MCPMultiAgent = require('./mcp-multi-agent');
const agent = new MCPMultiAgent();

// Получить список эмуляторов
const emulators = await agent.executeTool('android', 'list_emulators', {});
console.log(emulators.emulators);

// Запустить эмулятор
await agent.executeTool('android', 'start_emulator', {
    name: 'Pixel_5_API_31'
});
```

**Вариант В: Тестовый скрипт**

```bash
node test-android-agent.js
```

**Вариант Г: Через HTTP API**

```bash
# Список эмуляторов
curl -X POST http://localhost:8083/tools/execute \
  -H "Content-Type: application/json" \
  -d '{"name":"list_emulators","arguments":{}}'
```

## 📋 Создание эмулятора

Если у вас нет эмуляторов:

1. Откройте Android Studio
2. **Tools** → **Device Manager**
3. Нажмите **Create Device**
4. Выберите устройство (например, Pixel 5)
5. Выберите системный образ (например, API 31)
6. Нажмите **Finish**

Проверьте:
```bash
emulator -list-avds
```

## 🎯 Основные команды

### Список эмуляторов
```javascript
await agent.executeTool('android', 'list_emulators', {});
```

### Запуск эмулятора
```javascript
await agent.executeTool('android', 'start_emulator', {
    name: 'Pixel_5_API_31',
    waitForBoot: true  // Ждать полной загрузки
});
```

### Остановка эмулятора
```javascript
await agent.executeTool('android', 'stop_emulator', {});
```

### Проверка статуса
```javascript
await agent.executeTool('android', 'get_emulator_status', {});
```

### Установка APK
```javascript
await agent.executeTool('android', 'install_apk', {
    apkPath: '/path/to/app.apk'
});
```

### ADB команда
```javascript
await agent.executeTool('android', 'execute_adb_command', {
    command: 'shell pm list packages'
});
```

### Скриншот
```javascript
await agent.executeTool('android', 'take_screenshot', {
    outputPath: './screenshot.png'
});
```

## 🔧 Использование из агента

Напишите агенту: **"Открой эмулятор Pixel_5_API_31"**

Агент выполнит:
```javascript
await agent.executeTool('android', 'start_emulator', {
    name: 'Pixel_5_API_31',
    waitForBoot: true
});
```

## 📚 Полная документация

Подробное руководство: [ANDROID-MCP-GUIDE.md](./ANDROID-MCP-GUIDE.md)

## 🐛 Проблемы?

**ADB не найден:**
```bash
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

**Эмуляторы не найдены:**
- Создайте AVD в Android Studio

**Порт занят:**
```bash
export MCP_ANDROID_PORT=8084
node mcp-server-android.js
```

**Логи:**
```bash
tail -f logs/android.log
```

## 💡 Примеры сценариев

### Автотесты
```javascript
// 1. Запустить чистый эмулятор
await agent.executeTool('android', 'start_emulator', {
    name: 'Test_Device',
    options: '-wipe-data',
    waitForBoot: true
});

// 2. Установить приложение
await agent.executeTool('android', 'install_apk', {
    apkPath: './app.apk'
});

// 3. Запустить приложение
await agent.executeTool('android', 'execute_adb_command', {
    command: 'shell am start -n com.example/.MainActivity'
});

// 4. Подождать и сделать скриншот
await new Promise(r => setTimeout(r, 3000));
await agent.executeTool('android', 'take_screenshot', {
    outputPath: './test_result.png'
});

// 5. Остановить
await agent.executeTool('android', 'stop_emulator', {});
```

### Быстрая проверка
```javascript
// Проверка, что приложение установлено
const result = await agent.executeTool('android', 'execute_adb_command', {
    command: 'shell pm list packages | grep myapp'
});
console.log(result.output);
```

---

**Готово! 🎉** Теперь вы можете управлять Android эмуляторами через MCP протокол.


