/**
 * MCP Server: Android Emulator Controller
 * Отдельный MCP сервер для управления Android эмулятором через adb
 * Порт: 8083
 */

const express = require('express');
const cors = require('cors');
const { exec, spawn } = require('child_process');
const util = require('util');
const path = require('path');
const os = require('os');

const execPromise = util.promisify(exec);

const app = express();
const PORT = process.env.MCP_ANDROID_PORT || 8083;

// Определение путей к Android SDK
const ANDROID_HOME = process.env.ANDROID_HOME || 
                     process.env.ANDROID_SDK_ROOT || 
                     path.join(os.homedir(), 'Library', 'Android', 'sdk');

const ADB_PATH = process.env.ADB_PATH || path.join(ANDROID_HOME, 'platform-tools', 'adb');
const EMULATOR_PATH = process.env.EMULATOR_PATH || path.join(ANDROID_HOME, 'emulator', 'emulator');

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ===== MCP Endpoints =====

// Получение списка доступных tools
app.get('/tools', (req, res) => {
    res.json([
        {
            name: 'list_emulators',
            description: 'Получение списка всех доступных Android эмуляторов (установленных AVD)',
            inputSchema: {
                type: 'object',
                properties: {}
            }
        },
        {
            name: 'start_emulator',
            description: 'Запуск Android эмулятора по имени. Поддерживает дополнительные опции запуска.',
            inputSchema: {
                type: 'object',
                properties: {
                    name: {
                        type: 'string',
                        description: 'Имя эмулятора (AVD name) для запуска'
                    },
                    options: {
                        type: 'string',
                        description: 'Дополнительные опции запуска (например: -no-snapshot-load, -wipe-data)',
                        default: ''
                    },
                    waitForBoot: {
                        type: 'boolean',
                        description: 'Ждать ли полной загрузки эмулятора',
                        default: true
                    }
                },
                required: ['name']
            }
        },
        {
            name: 'stop_emulator',
            description: 'Остановка запущенного Android эмулятора',
            inputSchema: {
                type: 'object',
                properties: {
                    device: {
                        type: 'string',
                        description: 'ID устройства (например: emulator-5554). Если не указано, останавливается первый найденный эмулятор',
                        default: ''
                    }
                }
            }
        },
        {
            name: 'get_emulator_status',
            description: 'Получение статуса и информации о запущенных эмуляторах',
            inputSchema: {
                type: 'object',
                properties: {}
            }
        },
        {
            name: 'install_apk',
            description: 'Установка APK файла на эмулятор',
            inputSchema: {
                type: 'object',
                properties: {
                    apkPath: {
                        type: 'string',
                        description: 'Путь к APK файлу для установки'
                    },
                    device: {
                        type: 'string',
                        description: 'ID устройства (опционально, по умолчанию первое найденное)',
                        default: ''
                    }
                },
                required: ['apkPath']
            }
        },
        {
            name: 'execute_adb_command',
            description: 'Выполнение произвольной adb команды',
            inputSchema: {
                type: 'object',
                properties: {
                    command: {
                        type: 'string',
                        description: 'ADB команда для выполнения (без префикса "adb")'
                    },
                    device: {
                        type: 'string',
                        description: 'ID устройства для команды (опционально)',
                        default: ''
                    }
                },
                required: ['command']
            }
        },
        {
            name: 'take_screenshot',
            description: 'Снимок экрана с эмулятора',
            inputSchema: {
                type: 'object',
                properties: {
                    outputPath: {
                        type: 'string',
                        description: 'Путь для сохранения скриншота (по умолчанию ./screenshot.png)',
                        default: './screenshot.png'
                    },
                    device: {
                        type: 'string',
                        description: 'ID устройства (опционально)',
                        default: ''
                    }
                }
            }
        }
    ]);
});

// Выполнение tool
app.post('/tools/execute', async (req, res) => {
    try {
        const { name, arguments: args } = req.body;

        console.log(`[Android] Выполнение tool: ${name}`, args);

        let result;

        switch (name) {
            case 'list_emulators':
                result = await listEmulators(args);
                break;
            case 'start_emulator':
                result = await startEmulator(args);
                break;
            case 'stop_emulator':
                result = await stopEmulator(args);
                break;
            case 'get_emulator_status':
                result = await getEmulatorStatus(args);
                break;
            case 'install_apk':
                result = await installApk(args);
                break;
            case 'execute_adb_command':
                result = await executeAdbCommand(args);
                break;
            case 'take_screenshot':
                result = await takeScreenshot(args);
                break;
            default:
                return res.status(400).json({ error: `Неизвестный tool: ${name}` });
        }

        res.json(result);
    } catch (error) {
        console.error('[Android] Ошибка выполнения:', error);
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
        server: 'Android Emulator Controller MCP',
        version: '1.0.0',
        port: PORT
    });
});

// ===== Tool Implementations =====

/**
 * Проверка наличия adb и emulator
 */
async function checkAdbAvailable() {
    try {
        await execPromise(`"${ADB_PATH}" version`);
        return true;
    } catch (error) {
        throw new Error(`ADB не найден по пути: ${ADB_PATH}. Убедитесь, что Android SDK установлен`);
    }
}

/**
 * Получение списка всех установленных эмуляторов
 */
async function listEmulators(args) {
    await checkAdbAvailable();

    try {
        // Используем emulator -list-avds для получения списка
        const { stdout, stderr } = await execPromise(`"${EMULATOR_PATH}" -list-avds`);
        
        const avdList = stdout
            .trim()
            .split('\n')
            .filter(line => line.trim().length > 0);

        console.log(`[Android] Найдено эмуляторов: ${avdList.length}`);

        return {
            success: true,
            emulators: avdList,
            count: avdList.length,
            message: avdList.length > 0 
                ? `Найдено ${avdList.length} эмулятор(ов)` 
                : 'Эмуляторы не найдены. Создайте AVD через Android Studio.',
            androidHome: ANDROID_HOME,
            emulatorPath: EMULATOR_PATH
        };
    } catch (error) {
        throw new Error(`Не удалось получить список эмуляторов. Emulator: ${EMULATOR_PATH}. Ошибка: ${error.message}`);
    }
}

/**
 * Запуск эмулятора
 */
async function startEmulator(args) {
    await checkAdbAvailable();

    const { name, options = '', waitForBoot = true } = args;

    console.log(`[Android] Запуск эмулятора: ${name}`);

    try {
        // Проверяем, не запущен ли уже эмулятор
        const status = await getEmulatorStatus({});
        const alreadyRunning = status.devices.some(d => 
            d.type === 'emulator' && d.status === 'device'
        );

        if (alreadyRunning) {
            return {
                success: true,
                message: 'Эмулятор уже запущен',
                alreadyRunning: true,
                devices: status.devices
            };
        }

        // Запускаем эмулятор в фоновом режиме
        console.log(`[Android] Запуск эмулятора: ${EMULATOR_PATH} -avd ${name} ${options}`);
        
        // Используем простой exec с & для запуска в фоне
        const emulatorCommand = `"${EMULATOR_PATH}" -avd "${name}" ${options} > /dev/null 2>&1 &`;
        
        exec(emulatorCommand, {
            env: {
                ...process.env,
                ANDROID_HOME: ANDROID_HOME,
                ANDROID_SDK_ROOT: ANDROID_HOME
            }
        }, (error, stdout, stderr) => {
            if (error) {
                console.error(`[Android] Предупреждение при запуске эмулятора:`, error.message);
            }
            console.log(`[Android] exec завершился`);
        });
        
        console.log(`[Android] Команда запуска эмулятора выполнена`);

        // Если нужно дождаться загрузки
        if (waitForBoot) {
            console.log(`[Android] Ожидание загрузки эмулятора...`);
            
            // Ждем появления устройства (максимум 60 секунд)
            let bootComplete = false;
            let attempts = 0;
            const maxAttempts = 60;

            while (!bootComplete && attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                attempts++;

                try {
                    const { stdout } = await execPromise(`"${ADB_PATH}" devices`);
                    const deviceLines = stdout.split('\n').filter(l => l.includes('emulator'));
                    
                    if (deviceLines.length > 0) {
                        // Проверяем, что устройство полностью загружено
                        try {
                            const { stdout: bootStatus } = await execPromise(`"${ADB_PATH}" shell getprop sys.boot_completed`);
                            if (bootStatus.trim() === '1') {
                                bootComplete = true;
                            }
                        } catch (e) {
                            // Устройство еще не готово
                        }
                    }
                } catch (e) {
                    // Продолжаем ждать
                }

                if (attempts % 10 === 0) {
                    console.log(`[Android] Ожидание... (${attempts}/${maxAttempts} сек)`);
                }
            }

            if (bootComplete) {
                return {
                    success: true,
                    message: `Эмулятор "${name}" успешно запущен и готов к работе`,
                    emulatorName: name,
                    bootTime: `${attempts} секунд`
                };
            } else {
                return {
                    success: true,
                    message: `Эмулятор "${name}" запускается (загрузка может занять больше времени)`,
                    emulatorName: name,
                    warning: 'Эмулятор запущен, но загрузка еще не завершена. Проверьте статус позже.'
                };
            }
        } else {
            return {
                success: true,
                message: `Команда запуска эмулятора "${name}" выполнена`,
                emulatorName: name,
                note: 'Загрузка эмулятора происходит в фоновом режиме'
            };
        }
    } catch (error) {
        throw new Error(`Не удалось запустить эмулятор: ${error.message}`);
    }
}

/**
 * Остановка эмулятора
 */
async function stopEmulator(args) {
    await checkAdbAvailable();

    const { device = '' } = args;

    console.log(`[Android] Остановка эмулятора${device ? ': ' + device : ''}`);

    try {
        let targetDevice = device;

        // Если устройство не указано, находим первый эмулятор
        if (!targetDevice) {
            const { stdout } = await execPromise(`"${ADB_PATH}" devices`);
            const lines = stdout.split('\n').filter(l => l.includes('emulator'));
            
            if (lines.length === 0) {
                return {
                    success: false,
                    message: 'Запущенные эмуляторы не найдены'
                };
            }

            targetDevice = lines[0].split('\t')[0].trim();
            console.log(`[Android] Найдено устройство: ${targetDevice}`);
        }

        // Останавливаем эмулятор через adb emu kill
        await execPromise(`"${ADB_PATH}" -s ${targetDevice} emu kill`);

        console.log(`[Android] Эмулятор ${targetDevice} остановлен`);

        return {
            success: true,
            message: `Эмулятор ${targetDevice} успешно остановлен`,
            device: targetDevice
        };
    } catch (error) {
        throw new Error(`Не удалось остановить эмулятор: ${error.message}`);
    }
}

/**
 * Получение статуса эмуляторов
 */
async function getEmulatorStatus(args) {
    await checkAdbAvailable();

    try {
        const { stdout } = await execPromise(`"${ADB_PATH}" devices -l`);
        
        const lines = stdout.split('\n').slice(1).filter(l => l.trim().length > 0);
        
        const devices = lines.map(line => {
            const parts = line.split(/\s+/);
            const deviceId = parts[0];
            const status = parts[1];
            
            // Извлекаем дополнительную информацию
            const model = (line.match(/model:([^\s]+)/) || [])[1] || 'unknown';
            const device = (line.match(/device:([^\s]+)/) || [])[1] || 'unknown';
            
            return {
                id: deviceId,
                status: status,
                model: model,
                device: device,
                type: deviceId.startsWith('emulator') ? 'emulator' : 'physical'
            };
        });

        const emulators = devices.filter(d => d.type === 'emulator');
        const runningCount = emulators.filter(d => d.status === 'device').length;

        console.log(`[Android] Статус: ${runningCount} эмулятор(ов) запущено`);

        return {
            success: true,
            devices: devices,
            emulators: emulators,
            runningCount: runningCount,
            totalDevices: devices.length,
            message: runningCount > 0 
                ? `Запущено ${runningCount} эмулятор(ов)` 
                : 'Нет запущенных эмуляторов'
        };
    } catch (error) {
        throw new Error(`Не удалось получить статус эмуляторов: ${error.message}`);
    }
}

/**
 * Установка APK на эмулятор
 */
async function installApk(args) {
    await checkAdbAvailable();

    const { apkPath, device = '' } = args;

    console.log(`[Android] Установка APK: ${apkPath}`);

    try {
        const deviceFlag = device ? `-s ${device}` : '';
        const { stdout, stderr } = await execPromise(`"${ADB_PATH}" ${deviceFlag} install -r "${apkPath}"`);

        const success = stdout.includes('Success') || !stderr.includes('Failure');

        if (success) {
            return {
                success: true,
                message: `APK успешно установлен: ${apkPath}`,
                apkPath: apkPath,
                device: device || 'default',
                output: stdout
            };
        } else {
            throw new Error(`Установка не удалась: ${stderr}`);
        }
    } catch (error) {
        throw new Error(`Не удалось установить APK: ${error.message}`);
    }
}

/**
 * Выполнение произвольной adb команды
 */
async function executeAdbCommand(args) {
    await checkAdbAvailable();

    const { command, device = '' } = args;

    console.log(`[Android] Выполнение команды: adb ${device ? '-s ' + device : ''} ${command}`);

    try {
        const deviceFlag = device ? `-s ${device}` : '';
        const { stdout, stderr } = await execPromise(`"${ADB_PATH}" ${deviceFlag} ${command}`);

        return {
            success: true,
            command: `adb ${deviceFlag} ${command}`,
            stdout: stdout,
            stderr: stderr,
            output: stdout || stderr
        };
    } catch (error) {
        throw new Error(`Не удалось выполнить команду: ${error.message}`);
    }
}

/**
 * Снимок экрана с эмулятора
 */
async function takeScreenshot(args) {
    await checkAdbAvailable();

    const { outputPath = './screenshot.png', device = '' } = args;

    console.log(`[Android] Создание скриншота: ${outputPath}`);

    try {
        const deviceFlag = device ? `-s ${device}` : '';
        
        // Проверяем статус устройства
        const { stdout: devicesOutput } = await execPromise(`"${ADB_PATH}" devices`);
        if (devicesOutput.includes('unauthorized')) {
            throw new Error('Устройство не авторизовано. Разрешите отладку по USB на экране эмулятора и попробуйте снова.');
        }
        
        if (!devicesOutput.includes('device')) {
            throw new Error('Нет подключенных устройств. Запустите эмулятор.');
        }
        
        const tempPath = '/sdcard/screenshot.png';

        // Делаем скриншот на устройстве
        await execPromise(`"${ADB_PATH}" ${deviceFlag} shell screencap -p ${tempPath}`);
        
        // Копируем на компьютер (используем абсолютный путь для надежности)
        const absolutePath = path.isAbsolute(outputPath) 
            ? outputPath 
            : path.join(process.cwd(), outputPath);
            
        await execPromise(`"${ADB_PATH}" ${deviceFlag} pull ${tempPath} "${absolutePath}"`);
        
        // Удаляем временный файл
        await execPromise(`"${ADB_PATH}" ${deviceFlag} shell rm ${tempPath}`);

        console.log(`[Android] Скриншот сохранен: ${absolutePath}`);

        return {
            success: true,
            message: `Скриншот успешно сохранен: ${absolutePath}`,
            outputPath: absolutePath,
            device: device || 'default'
        };
    } catch (error) {
        console.error('[Android] Ошибка создания скриншота:', error);
        
        // Улучшенная обработка ошибок
        if (error.message.includes('unauthorized')) {
            throw new Error('Устройство не авторизовано. На экране эмулятора должно появиться диалоговое окно "Allow USB debugging?" - нажмите "Allow" или "OK"');
        }
        
        throw new Error(`Не удалось создать скриншот: ${error.message}`);
    }
}

// ===== Server Start =====

app.listen(PORT, () => {
    console.log('\n' + '='.repeat(60));
    console.log('📱 MCP Server: Android Emulator Controller');
    console.log('='.repeat(60));
    console.log(`Port: ${PORT}`);
    console.log(`Health: http://localhost:${PORT}/health`);
    console.log(`Tools: http://localhost:${PORT}/tools`);
    console.log('='.repeat(60));
    console.log(`Android SDK: ${ANDROID_HOME}`);
    console.log(`ADB: ${ADB_PATH}`);
    console.log(`Emulator: ${EMULATOR_PATH}`);
    console.log('='.repeat(60) + '\n');
    
    // Проверяем доступность adb при запуске
    checkAdbAvailable()
        .then(() => {
            console.log('✅ ADB доступен\n');
        })
        .catch(error => {
            console.error('⚠️  ' + error.message);
            console.error('Установите Android SDK или проверьте пути\n');
        });
});

