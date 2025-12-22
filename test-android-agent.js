/**
 * Тестовый скрипт для демонстрации работы Android MCP сервера
 * Использование: node test-android-agent.js
 */

const MCPMultiAgent = require('./mcp-multi-agent');

async function testAndroidMCP() {
    console.log('\n🤖 Тестирование Android MCP сервера...\n');

    const agent = new MCPMultiAgent();

    try {
        // 1. Проверка доступности сервера
        console.log('📡 Проверка доступности Android MCP сервера...');
        const isAvailable = await agent.checkMCPServer(agent.servers.android);
        
        if (!isAvailable) {
            console.error('❌ Android MCP сервер недоступен на', agent.servers.android);
            console.log('\n💡 Запустите сервер командой:');
            console.log('   node mcp-server-android.js\n');
            return;
        }

        console.log('✅ Сервер доступен!\n');

        // 2. Получение списка эмуляторов
        console.log('📋 Получение списка доступных эмуляторов...');
        const emulators = await agent.executeTool('android', 'list_emulators', {});
        
        console.log(`\nНайдено эмуляторов: ${emulators.count}`);
        if (emulators.emulators && emulators.emulators.length > 0) {
            emulators.emulators.forEach((emulator, index) => {
                console.log(`  ${index + 1}. ${emulator}`);
            });
        } else {
            console.log('  ℹ️  Эмуляторы не найдены. Создайте AVD через Android Studio.');
            return;
        }

        // 3. Проверка статуса
        console.log('\n📊 Проверка статуса эмуляторов...');
        const status = await agent.executeTool('android', 'get_emulator_status', {});
        
        console.log(`\nЗапущено устройств: ${status.totalDevices}`);
        console.log(`Эмуляторов: ${status.runningCount}`);
        
        if (status.devices && status.devices.length > 0) {
            console.log('\nЗапущенные устройства:');
            status.devices.forEach((device, index) => {
                console.log(`  ${index + 1}. ${device.id} - ${device.status} (${device.type})`);
            });
        }

        // 4. Пример запуска эмулятора (раскомментируйте для запуска)
        /*
        if (emulators.emulators.length > 0 && status.runningCount === 0) {
            console.log('\n🚀 Запуск первого эмулятора...');
            console.log(`   Имя: ${emulators.emulators[0]}`);
            console.log('   ⏳ Это может занять некоторое время...\n');
            
            const startResult = await agent.executeTool('android', 'start_emulator', {
                name: emulators.emulators[0],
                waitForBoot: true
            });
            
            if (startResult.success) {
                console.log(`✅ ${startResult.message}`);
                if (startResult.bootTime) {
                    console.log(`   Время загрузки: ${startResult.bootTime}`);
                }
            }
        }
        */

        // 5. Пример выполнения ADB команды
        if (status.runningCount > 0) {
            console.log('\n⌨️  Выполнение тестовой ADB команды...');
            const adbResult = await agent.executeTool('android', 'execute_adb_command', {
                command: 'devices'
            });
            
            console.log('\nРезультат команды "adb devices":');
            console.log(adbResult.output);
        }

        // 6. Получение всех доступных tools
        console.log('\n🔧 Список доступных инструментов Android MCP:');
        const tools = await agent.getMCPTools(agent.servers.android);
        
        tools.forEach((tool, index) => {
            console.log(`\n  ${index + 1}. ${tool.name}`);
            console.log(`     ${tool.description}`);
        });

        console.log('\n✅ Тестирование завершено!\n');

        // Примеры использования для пользователя
        console.log('💡 Примеры команд:\n');
        console.log('// Запуск эмулятора');
        console.log('await agent.executeTool("android", "start_emulator", {');
        console.log('    name: "Pixel_5_API_31",');
        console.log('    waitForBoot: true');
        console.log('});\n');
        
        console.log('// Установка APK');
        console.log('await agent.executeTool("android", "install_apk", {');
        console.log('    apkPath: "/path/to/app.apk"');
        console.log('});\n');
        
        console.log('// Скриншот');
        console.log('await agent.executeTool("android", "take_screenshot", {');
        console.log('    outputPath: "./screenshot.png"');
        console.log('});\n');

    } catch (error) {
        console.error('\n❌ Ошибка:', error.message);
        console.error(error);
    }
}

// Запуск теста
if (require.main === module) {
    testAndroidMCP().catch(error => {
        console.error('Критическая ошибка:', error);
        process.exit(1);
    });
}

module.exports = testAndroidMCP;

