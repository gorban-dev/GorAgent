/**
 * GorAgent — ИИ Чат на базе OpenAI API и OpenRouter
 * Фронтенд логика
 */

// ===== Конфигурация =====
const OPENAI_MODEL_NAME = 'gpt-4.1-mini';
const API_ENDPOINTS = {
    openai: '/api/chat',
    openrouter: '/api/chat/openrouter'
};
const MAX_MESSAGE_LENGTH = 3000;

// Текущий провайдер API и модель
let currentApiProvider = 'openai';
let currentOpenRouterModel = 'anthropic/claude-sonnet-4';

// ===== DOM Элементы =====
const chatEl = document.getElementById('chat');
const inputEl = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const clearBtn = document.getElementById('clear-btn');
const typingEl = document.getElementById('typing-indicator');
const modelNameEl = document.getElementById('model-name');

// System Prompt элементы
const settingsBtn = document.getElementById('settings-btn');
const systemPromptPanel = document.getElementById('system-prompt-panel');
const panelOverlay = document.getElementById('panel-overlay');
const closePanelBtn = document.getElementById('close-panel-btn');
const systemPromptTextarea = document.getElementById('system-prompt-textarea');
const applyPromptBtn = document.getElementById('apply-prompt-btn');
const promptStatus = document.getElementById('prompt-status');

// Temperature элементы получаются динамически при необходимости

// ===== История сообщений =====
let conversationHistory = [];
let isWaitingForResponse = false;

// ===== Сжатие истории =====
let compressionEnabled = false;
let compressionThreshold = 10;
let compressionSummary = null; // Хранит текущее резюме сжатой истории
let compressionStats = {
    totalMessages: 0,
    compressedTokens: 0,      // Токены сжатых сообщений (до сжатия)
    summaryTokens: 0,         // Токены в резюме (после сжатия)
    compressions: []
};

// ===== Напоминания =====
let reminders = []; // Массив активных напоминаний
let reminderNotifications = []; // История уведомлений о напоминаниях
let reminderInterval = null; // Интервал для проверки напоминаний
let pendingMinuteReminder = null; // Ожидает подтверждения минутное напоминание
const REMINDER_CHECK_INTERVAL = 10000; // Проверять каждые 10 секунд (10000 мс)

// ===== System Prompt =====
const SYSTEM_PROMPT_PRESETS = {
    hookah: {
        name: 'Кальянщик',
        prompt: `Ты — GorAgent, профессиональный и дружелюбный кальянщик с многолетним опытом. 
Ты помогаешь гостям подобрать идеальный кальян на основе их предпочтений.

ВАЖНО: Ты должен вести диалог по следующему сценарию:

1. При ПЕРВОМ сообщении от пользователя — поприветствуй его, представься кальянщиком и начни задавать вопросы по одному.

2. Тебе нужно выяснить ответы на 5 вопросов (задавай их по одному, ожидая ответа):
   - Вопрос 1: Какой уровень крепости предпочитаете? (лёгкий / средний / крепкий)
   - Вопрос 2: Какие вкусы вам нравятся? (фруктовые / ягодные / цитрусовые / свежие-мятные / сладкие / пряные-специи)
   - Вопрос 3: Предпочитаете моно-вкус или микс из нескольких табаков?
   - Вопрос 4: Есть ли табаки или вкусы, которые вам НЕ нравятся или на которые аллергия?
   - Вопрос 5: Какое у вас сегодня настроение? Хотите расслабиться, взбодриться или что-то особенное?

3. Отслеживай, на какие вопросы пользователь уже ответил. Если он ответил не на все 5 вопросов — задай следующий.

4. После получения ответов на ВСЕ 5 вопросов — выдай персональную рекомендацию кальяна.

ФОРМАТ ФИНАЛЬНОЙ РЕКОМЕНДАЦИИ должен включать:
- Название микса
- Описание вкуса и ощущений
- Конкретные бренды и линейки табака
- ОБЯЗАТЕЛЬНО: точный рецепт микса с процентами и граммами (стандартная чаша = 25 грамм)

Отвечай на русском языке. Будь дружелюбным и профессиональным, используй эмодзи где уместно.

Ответ возвращай ТОЛЬКО в формате JSON без дополнительной разметки:
{"message": "сообщение пользователя", "answer": "твой ответ"}
Где message - это сообщение от пользователя, answer - это твой ответ на это сообщение.`
    },
    pirate: {
        name: 'Пират',
        prompt: `Ты — грозный пират капитан Чёрная Борода! 🏴‍☠️

Ты говоришь как настоящий пират: используй "Арррр!", "Тысяча чертей!", "Клянусь морскими глубинами!" и другие пиратские выражения.

Твои особенности:
- Ты рассказываешь о своих приключениях на семи морях
- Ты ищешь сокровища и зовёшь собеседника в свою команду
- Ты используешь морские термины: "полундра", "рея", "камбуз", "трюм"
- Ты иногда угрожаешь заставить собеседника драить палубу 🦜

Отвечай на русском языке, но с пиратским колоритом!

Ответ возвращай ТОЛЬКО в формате JSON без дополнительной разметки:
{"message": "сообщение пользователя", "answer": "твой ответ"}
Где message - это сообщение от пользователя, answer - это твой ответ на это сообщение.`
    },
    poet: {
        name: 'Поэт',
        prompt: `Ты — романтичный поэт Серебряного века. 📜✨

Твой стиль:
- Ты говоришь изысканным, возвышенным языком
- Периодически вставляешь в речь короткие стихи или рифмы
- Ты философствуешь о красоте, любви и смысле жизни
- Ты сравниваешь обыденные вещи с чем-то прекрасным
- Используй метафоры и эпитеты

Твои любимые темы: луна, звёзды, осенние листья, вечность, душа.

Начинай ответы с глубокомысленных вздохов типа "Ах, друг мой..." или "О, какая глубина в ваших словах..."

Отвечай на русском языке в стиле поэтов XIX-XX века.

Ответ возвращай ТОЛЬКО в формате JSON без дополнительной разметки:
{"message": "сообщение пользователя", "answer": "твой ответ"}
Где message - это сообщение от пользователя, answer - это твой ответ на это сообщение.`
    },
    tech: {
        name: 'Программист',
        prompt: `Ты — опытный senior-программист и архитектор ПО. 💻

Твои особенности:
- Ты отвечаешь чётко, структурированно, по делу
- Любишь использовать технические термины и аналогии с кодом
- Иногда шутишь программистские шутки ("Это не баг, это фича!")
- Ссылаешься на принципы SOLID, DRY, KISS
- Любишь говорить про оптимизацию и чистый код
- Используешь эмодзи: 🚀 ✅ ⚠️ 🔥 💡

Ты можешь помочь с:
- Объяснением концепций программирования
- Code review и советами по архитектуре
- Отладкой и решением проблем
- Выбором технологий

Отвечай на русском языке в дружелюбном, но профессиональном стиле.

Ответ возвращай ТОЛЬКО в формате JSON без дополнительной разметки:
{"message": "сообщение пользователя", "answer": "твой ответ"}
Где message - это сообщение от пользователя, answer - это твой ответ на это сообщение.`
    },
    reminders: {
        name: 'Менеджер напоминаний',
        prompt: `Ты — умный помощник по управлению напоминаниями и планированию. 🔔📅

Твои особенности:
- Ты помогаешь пользователям создавать и управлять напоминаниями
- Ты умеешь анализировать запросы и предлагать оптимальные интервалы
- Ты даёшь советы по эффективному использованию системы напоминаний
- Ты можешь напоминать о важных событиях, погоде, новостях и многом другом
- Для погодных напоминаний используешь реальные данные через MCP инструменты
- Используешь эмодзи: 🔔 ⏰ 📅 🗓️ 💡 ✅

Ты можешь помочь с:
- Созданием напоминаний о погоде, новостях, встречах
- Настройкой регулярных уведомлений (ежедневно, ежечасно, каждые 30/15 минут)
- Анализом эффективности напоминаний
- Предложениями по улучшению продуктивности

ВАЖНО: Когда пользователь просит создать напоминание, система автоматически распознаёт это и создаёт напоминание без твоего участия. Просто подтверди создание.

Примеры использования:
- "Напоминай мне о погоде в Шерегеше каждое утро" → Система автоматически создаст напоминание
- "Создай напоминание о встрече на 15:00" → Система автоматически создаст напоминание
- "Напоминай о новостях технологий каждый час" → Система автоматически создаст напоминание

Отвечай на русском языке в дружелюбном и полезном стиле.

Ответ возвращай ТОЛЬКО в формате JSON без дополнительной разметки:
{"message": "сообщение пользователя", "answer": "твой ответ"}
Где message - это сообщение от пользователя, answer - это твой ответ на это сообщение.`
    }
};

let currentSystemPrompt = SYSTEM_PROMPT_PRESETS.hookah.prompt;
let currentPresetName = 'Кальянщик';
let currentTemperature = 0.7;
let currentMaxTokens = 2048;

// Пользовательские пресеты (загружаются из localStorage)
let customPresets = {};

// DOM элементы для пользовательских пресетов
const newPresetNameInput = document.getElementById('new-preset-name');
const savePresetBtn = document.getElementById('save-preset-btn');
const customPresetsSection = document.getElementById('custom-presets-section');
const customPresetsContainer = document.getElementById('custom-presets');

// ===== Инициализация =====
document.addEventListener('DOMContentLoaded', () => {
    // Загрузить настройки API провайдера
    loadApiProviderSettings();
    
    // Установить название модели
    updateModelNameDisplay();
    
    // Загрузить историю из localStorage
    loadConversationFromStorage();
    
    // Загрузить сохранённый System Prompt
    loadSystemPromptFromStorage();
    
    // Загрузить пользовательские пресеты
    loadCustomPresets();

    // Загрузить MCP инструменты
    loadMCPTools();

    // Инициализировать обработчики переключения API
    initApiProviderHandlers();
    
    // Инициализировать обработчики сжатия истории
    initCompressionHandlers();

    // Инициализировать обработчики напоминаний
    initReminderHandlers();

    // Инициализировать систему напоминаний
    loadRemindersFromStorage();
    loadReminderNotificationsFromStorage();
    startReminderChecker();

    // Если история пуста, показать приветственное сообщение
    if (conversationHistory.length === 0) {
        showWelcomeMessage();
    } else {
        // Восстановить сообщения из истории
        restoreMessagesFromHistory();
        // Показать недавние напоминания
        showReminderNotificationsOnLoad();
    }
    
    // Авто-ресайз textarea
    setupTextareaAutoResize();
});

/**
 * Обновить отображение названия модели в хедере
 */
function updateModelNameDisplay() {
    if (modelNameEl) {
        if (currentApiProvider === 'openai') {
            modelNameEl.textContent = OPENAI_MODEL_NAME;
        } else {
            // Для OpenRouter показываем короткое название модели
            const modelParts = currentOpenRouterModel.split('/');
            modelNameEl.textContent = modelParts[1] || currentOpenRouterModel;
        }
    }
}

/**
 * Загрузка настроек API провайдера из localStorage
 */
function loadApiProviderSettings() {
    try {
        const savedProvider = localStorage.getItem('goragent_api_provider');
        const savedModel = localStorage.getItem('goragent_openrouter_model');
        
        if (savedProvider && (savedProvider === 'openai' || savedProvider === 'openrouter')) {
            currentApiProvider = savedProvider;
        }
        
        if (savedModel) {
            currentOpenRouterModel = savedModel;
        }
        
        console.log('Загруженные настройки API:', { provider: currentApiProvider, model: currentOpenRouterModel });
    } catch (e) {
        console.warn('Не удалось загрузить настройки API провайдера:', e);
    }
}

/**
 * Сохранение настроек API провайдера в localStorage
 */
function saveApiProviderSettings() {
    try {
        localStorage.setItem('goragent_api_provider', currentApiProvider);
        localStorage.setItem('goragent_openrouter_model', currentOpenRouterModel);
    } catch (e) {
        console.warn('Не удалось сохранить настройки API провайдера:', e);
    }
}

/**
 * Инициализация обработчиков переключения API
 */
function initApiProviderHandlers() {
    const apiTabs = document.querySelectorAll('.api-tab');
    const openrouterSettings = document.getElementById('openrouter-settings');
    const modelSelect = document.getElementById('openrouter-model');
    const apiStatus = document.getElementById('api-status');
    
    // Установить начальное состояние UI
    apiTabs.forEach(tab => {
        if (tab.dataset.provider === currentApiProvider) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    
    // Показать/скрыть настройки OpenRouter
    if (openrouterSettings) {
        openrouterSettings.hidden = currentApiProvider !== 'openrouter';
    }
    
    // Установить выбранную модель
    if (modelSelect) {
        modelSelect.value = currentOpenRouterModel;
    }
    
    // Обновить статус API
    updateApiStatusBadge();
    
    // Обработчики кликов по табам
    apiTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const provider = tab.dataset.provider;
            
            // Обновить активный таб
            apiTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Показать/скрыть настройки OpenRouter
            if (openrouterSettings) {
                openrouterSettings.hidden = provider !== 'openrouter';
            }
            
            // Сохранить выбранный провайдер (применится при нажатии "Применить")
            currentApiProvider = provider;
            updateApiStatusBadge();
        });
    });
    
    // Обработчик выбора модели
    if (modelSelect) {
        modelSelect.addEventListener('change', (e) => {
            currentOpenRouterModel = e.target.value;
        });
    }
}

/**
 * Обновить бейдж статуса API в футере панели
 */
function updateApiStatusBadge() {
    const apiStatus = document.getElementById('api-status');
    if (apiStatus) {
        if (currentApiProvider === 'openai') {
            apiStatus.textContent = '🟢 OpenAI';
            apiStatus.className = 'api-status-badge openai';
        } else {
            const modelParts = currentOpenRouterModel.split('/');
            apiStatus.textContent = `🌐 ${modelParts[1] || 'OpenRouter'}`;
            apiStatus.className = 'api-status-badge openrouter';
        }
    }
}

/**
 * Загрузка System Prompt из localStorage
 */
function loadSystemPromptFromStorage() {
    try {
        const savedPrompt = localStorage.getItem('goragent_system_prompt');
        const savedName = localStorage.getItem('goragent_preset_name');
        const savedTemp = localStorage.getItem('goragent_temperature');
        
        if (savedPrompt) {
            currentSystemPrompt = savedPrompt;
            currentPresetName = savedName || 'Пользовательский';
            updatePromptStatus();
        }
        
        if (savedTemp) {
            const parsedTemp = parseFloat(savedTemp);
            if (!isNaN(parsedTemp) && parsedTemp >= 0 && parsedTemp <= 2) {
                currentTemperature = parsedTemp;
            }
        }
        
        const savedMaxTokens = localStorage.getItem('goragent_max_tokens');
        if (savedMaxTokens) {
            const parsedMaxTokens = parseInt(savedMaxTokens);
            if (!isNaN(parsedMaxTokens) && parsedMaxTokens >= 256 && parsedMaxTokens <= 16384) {
                currentMaxTokens = parsedMaxTokens;
            }
        }
        
        // Обновляем UI слайдера temperature
        const slider = document.getElementById('temperature-slider');
        const valueDisplay = document.getElementById('temperature-value');
        if (slider) slider.value = currentTemperature;
        if (valueDisplay) valueDisplay.textContent = currentTemperature.toFixed(1);
        
        // Обновляем UI поля max_tokens
        const maxTokensInput = document.getElementById('max-tokens-input');
        if (maxTokensInput) maxTokensInput.value = currentMaxTokens;
        
        console.log('Загруженный temperature:', currentTemperature);
        console.log('Загруженный max_tokens:', currentMaxTokens);
    } catch (e) {
        console.warn('Не удалось загрузить System Prompt:', e);
    }
}

/**
 * Загрузка пользовательских пресетов из localStorage
 */
function loadCustomPresets() {
    try {
        const saved = localStorage.getItem('goragent_custom_presets');
        if (saved) {
            customPresets = JSON.parse(saved);
            renderCustomPresets();
        }
    } catch (e) {
        console.warn('Не удалось загрузить пользовательские пресеты:', e);
        customPresets = {};
    }
}

/**
 * Сохранение пользовательских пресетов в localStorage
 */
function saveCustomPresets() {
    try {
        localStorage.setItem('goragent_custom_presets', JSON.stringify(customPresets));
    } catch (e) {
        console.warn('Не удалось сохранить пользовательские пресеты:', e);
    }
}

/**
 * Отрисовка пользовательских пресетов
 */
function renderCustomPresets() {
    const keys = Object.keys(customPresets);
    
    if (keys.length === 0) {
        customPresetsSection.hidden = true;
        return;
    }
    
    customPresetsSection.hidden = false;
    customPresetsContainer.innerHTML = '';
    
    keys.forEach(key => {
        const preset = customPresets[key];
        
        const wrapper = document.createElement('div');
        wrapper.className = 'custom-preset-wrapper';
        
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'preset-btn custom';
        btn.dataset.customPreset = key;
        btn.textContent = `✨ ${preset.name}`;
        
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'delete-preset-btn';
        deleteBtn.dataset.deletePreset = key;
        deleteBtn.innerHTML = '×';
        deleteBtn.title = 'Удалить пресет';
        
        wrapper.appendChild(btn);
        wrapper.appendChild(deleteBtn);
        customPresetsContainer.appendChild(wrapper);
    });
    
    // Добавляем обработчики для новых кнопок
    attachCustomPresetHandlers();
}

/**
 * Добавление обработчиков для пользовательских пресетов
 */
function attachCustomPresetHandlers() {
    // Выбор пресета
    document.querySelectorAll('.preset-btn.custom').forEach(btn => {
        btn.addEventListener('click', () => {
            const key = btn.dataset.customPreset;
            const preset = customPresets[key];
            if (preset) {
                systemPromptTextarea.value = preset.prompt;
                selectedPresetName = preset.name;
                // Подсветить выбранную кнопку
                document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            }
        });
    });
    
    // Удаление пресета
    document.querySelectorAll('.delete-preset-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const key = btn.dataset.deletePreset;
            const preset = customPresets[key];
            if (preset && confirm(`Удалить пресет "${preset.name}"?`)) {
                delete customPresets[key];
                saveCustomPresets();
                renderCustomPresets();
                
                console.log('%c🗑️ Пресет удалён:', 'color: #ef4444', preset.name);
            }
        });
    });
}

/**
 * Создание нового пользовательского пресета
 */
function createCustomPreset(name, prompt) {
    // Генерируем уникальный ключ
    const key = 'custom_' + Date.now();
    
    customPresets[key] = {
        name: name,
        prompt: prompt
    };
    
    saveCustomPresets();
    renderCustomPresets();
    
    console.log('%c💾 Новый пресет сохранён:', 'color: #10b981', name);
}

// ===== MCP Tools =====

// Загрузка и отображение MCP инструментов
async function loadMCPTools() {
    try {
        const response = await fetch('/api/mcp/tools');
        const data = await response.json();

        updateMCPStatus(data);
        renderMCPTools(data.tools);
    } catch (error) {
        console.error('[MCP] Ошибка загрузки инструментов:', error);
        updateMCPStatus({ enabled: false, tools: [], error: 'Не удалось загрузить инструменты' });
    }
}

// Обновление статуса MCP
function updateMCPStatus(data) {
    const statusBadge = document.getElementById('mcp-status-badge');
    const statusDot = statusBadge.querySelector('.mcp-status-dot');
    const statusText = statusBadge.querySelector('.mcp-status-text');
    const toolsCount = document.getElementById('mcp-tools-count');

    if (data.error || !data.enabled) {
        statusBadge.className = 'mcp-status-badge disconnected';
        statusText.textContent = 'Отключен';
        toolsCount.textContent = '0';
    } else {
        statusBadge.className = 'mcp-status-badge connected';
        statusText.textContent = 'Подключен';
        toolsCount.textContent = data.tools.length || 0;
    }
}

// Отрисовка списка MCP инструментов
function renderMCPTools(tools) {
    const toolsList = document.getElementById('mcp-tools-list');

    if (!tools || tools.length === 0) {
        toolsList.innerHTML = '<div class="mcp-no-tools">Инструменты не найдены</div>';
        return;
    }

    toolsList.innerHTML = tools.map(tool => {
        const inputSchema = tool.inputSchema || {};
        const properties = inputSchema.properties || {};
        const required = inputSchema.required || [];

        const paramsHtml = Object.keys(properties).map(key => {
            const param = properties[key];
            const isRequired = required.includes(key);
            return `<div class="mcp-tool-param">${key}${isRequired ? ' *' : ''}: ${param.description || 'Нет описания'}</div>`;
        }).join('');

        return `
            <div class="mcp-tool-item">
                <div class="mcp-tool-name">🔧 ${tool.name}</div>
                <div class="mcp-tool-description">${tool.description || 'Нет описания'}</div>
                ${paramsHtml ? `<div class="mcp-tool-params">${paramsHtml}</div>` : ''}
            </div>
        `;
    }).join('');
}

// ===== Обработчики событий =====
sendBtn.addEventListener('click', handleSend);

clearBtn.addEventListener('click', () => {
    if (confirm('Очистить историю чата?')) {
        clearChat();
    }
});

inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
    }
});

// System Prompt панель
settingsBtn.addEventListener('click', () => {
    systemPromptPanel.hidden = false;
    systemPromptTextarea.value = currentSystemPrompt;
    selectedPresetName = currentPresetName;
    document.body.style.overflow = 'hidden';

    // Загрузить свежие MCP инструменты
    loadMCPTools();
    
    // Установить текущее значение temperature
    const slider = document.getElementById('temperature-slider');
    const valueDisplay = document.getElementById('temperature-value');
    if (slider) slider.value = currentTemperature;
    if (valueDisplay) valueDisplay.textContent = currentTemperature.toFixed(1);
    
    // Установить текущее значение max_tokens
    const maxTokensInput = document.getElementById('max-tokens-input');
    if (maxTokensInput) maxTokensInput.value = currentMaxTokens;
    
    // Установить текущий API провайдер
    const apiTabs = document.querySelectorAll('.api-tab');
    const openrouterSettings = document.getElementById('openrouter-settings');
    const modelSelect = document.getElementById('openrouter-model');
    
    apiTabs.forEach(tab => {
        if (tab.dataset.provider === currentApiProvider) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    
    if (openrouterSettings) {
        openrouterSettings.hidden = currentApiProvider !== 'openrouter';
    }
    
    if (modelSelect) {
        modelSelect.value = currentOpenRouterModel;
    }
    
    updateApiStatusBadge();
    
    // Сбросить подсветку кнопок пресетов
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
});

// Temperature slider - добавляем обработчик после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    const slider = document.getElementById('temperature-slider');
    const valueDisplay = document.getElementById('temperature-value');
    
    if (slider) {
        slider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            if (valueDisplay) valueDisplay.textContent = value.toFixed(1);
        });
    }
    
    // Max Tokens input - валидация при изменении
    const maxTokensInput = document.getElementById('max-tokens-input');
    
    if (maxTokensInput) {
        maxTokensInput.addEventListener('change', (e) => {
            let value = parseInt(e.target.value);
            // Ограничиваем значение в допустимых пределах
            if (isNaN(value) || value < 256) value = 256;
            if (value > 16384) value = 16384;
            e.target.value = value;
        });
    }
});

function closePanel() {
    systemPromptPanel.hidden = true;
    document.body.style.overflow = '';
}

closePanelBtn.addEventListener('click', closePanel);
panelOverlay.addEventListener('click', closePanel);

// Переменная для отслеживания выбранного пресета
let selectedPresetName = 'Кальянщик';

// Применить новый System Prompt
applyPromptBtn.addEventListener('click', () => {
    const newPrompt = systemPromptTextarea.value.trim();
    const slider = document.getElementById('temperature-slider');
    const maxTokensInput = document.getElementById('max-tokens-input');
    const newTemperature = slider ? parseFloat(slider.value) : currentTemperature;
    let newMaxTokens = maxTokensInput ? parseInt(maxTokensInput.value) : currentMaxTokens;
    // Валидация max tokens
    if (isNaN(newMaxTokens) || newMaxTokens < 256) newMaxTokens = 256;
    if (newMaxTokens > 16384) newMaxTokens = 16384;
    const modelSelect = document.getElementById('openrouter-model');
    
    console.log('Слайдер temperature найден:', !!slider);
    console.log('Значение слайдера temperature:', slider?.value);
    console.log('Новый temperature:', newTemperature);
    console.log('Поле max_tokens найдено:', !!maxTokensInput);
    console.log('Новый max_tokens:', newMaxTokens);
    console.log('API провайдер:', currentApiProvider);
    
    if (newPrompt) {
        currentSystemPrompt = newPrompt;
        currentPresetName = selectedPresetName;
        currentTemperature = newTemperature;
        currentMaxTokens = newMaxTokens;
        
        // Сохраняем выбранную модель OpenRouter
        if (modelSelect && currentApiProvider === 'openrouter') {
            currentOpenRouterModel = modelSelect.value;
        }
        
        updatePromptStatus();
        
        // Сохраняем настройки
        localStorage.setItem('goragent_temperature', currentTemperature.toString());
        localStorage.setItem('goragent_max_tokens', currentMaxTokens.toString());
        saveApiProviderSettings();
        
        // Обновляем отображение модели в хедере
        updateModelNameDisplay();
        updateApiStatusBadge();
        
        // Очищаем историю чата (не учитываем прошлый контекст при смене роли/температуры)
        conversationHistory = [];
        chatEl.innerHTML = '';
        localStorage.removeItem('goragent_history');
        localStorage.removeItem('goragent_conversation');
        
        // Логируем изменение
        console.log('%c═══════════════════════════════════════════════════════', 'color: #FF9800');
        console.log('%c⚙️ НАСТРОЙКИ ИЗМЕНЕНЫ (история очищена)', 'color: #FF9800; font-weight: bold; font-size: 14px');
        console.log('%c═══════════════════════════════════════════════════════', 'color: #FF9800');
        console.log('Режим:', currentPresetName);
        console.log('Temperature:', currentTemperature);
        console.log('Max Tokens:', currentMaxTokens);
        console.log('API провайдер:', currentApiProvider);
        if (currentApiProvider === 'openrouter') {
            console.log('OpenRouter модель:', currentOpenRouterModel);
        }
        console.log('Новый System Prompt:');
        console.log(currentSystemPrompt);
        console.log('%c═══════════════════════════════════════════════════════', 'color: #FF9800');
        
        // Формируем сообщение с информацией о настройках
        const providerInfo = currentApiProvider === 'openai' 
            ? 'API: **OpenAI**' 
            : `API: **OpenRouter**\nМодель: **${currentOpenRouterModel}**`;
        
        // Показать уведомление
        addMessage(`✅ **Настройки обновлены!**\n\nРежим: **${currentPresetName}**\nTemperature: **${currentTemperature}**\nMax Tokens: **${currentMaxTokens}**\n${providerInfo}\n\n🔄 История чата очищена. Начните новый диалог!`, 'agent');
    }
    closePanel();
});

// Пресеты
document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const presetKey = btn.dataset.preset;
        const preset = SYSTEM_PROMPT_PRESETS[presetKey];
        if (preset) {
            systemPromptTextarea.value = preset.prompt;
            selectedPresetName = preset.name;
            // Подсветить выбранную кнопку
            document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        }
    });
});

// Если пользователь редактирует textarea вручную - это "Пользовательский" режим
systemPromptTextarea.addEventListener('input', () => {
    selectedPresetName = 'Пользовательский';
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
});

// Сохранение нового пресета
savePresetBtn.addEventListener('click', () => {
    const name = newPresetNameInput.value.trim();
    const prompt = systemPromptTextarea.value.trim();
    
    if (!name) {
        alert('Введите имя для нового пресета');
        newPresetNameInput.focus();
        return;
    }
    
    if (!prompt) {
        alert('Введите текст System Prompt');
        systemPromptTextarea.focus();
        return;
    }
    
    createCustomPreset(name, prompt);
    newPresetNameInput.value = '';
    
    // Показать уведомление
    alert(`Пресет "${name}" сохранён!`);
});

// Enter в поле имени пресета = сохранить
newPresetNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        savePresetBtn.click();
    }
});

function updatePromptStatus() {
    promptStatus.innerHTML = `📝 Текущий промпт: <strong>${currentPresetName}</strong>`;
    // Сохранить в localStorage
    localStorage.setItem('goragent_system_prompt', currentSystemPrompt);
    localStorage.setItem('goragent_preset_name', currentPresetName);
}

// ===== Функции =====

/**
 * Показать приветственное сообщение
 */
function showWelcomeMessage() {
    const welcomeText = `Привет! 👋 Я **GorAgent** — ваш ИИ-ассистент!

Нажмите на **⚙️ шестерёнку** в правом верхнем углу, чтобы изменить мой **System Prompt** и увидеть, как меняется моё поведение.

Попробуйте разные режимы: **Кальянщик**, **Пират**, **Поэт** или **Программист**!

Напишите что-нибудь, чтобы начать диалог! ✨`;
    
    addMessage(welcomeText, 'agent', true);
}

/**
 * Обработка отправки сообщения
 */
async function handleSend() {
    const text = inputEl.value.trim();

    // Валидация
    if (!text || isWaitingForResponse) return;

    if (text.length > MAX_MESSAGE_LENGTH) {
        addMessage(`Сообщение слишком длинное. Максимум ${MAX_MESSAGE_LENGTH} символов.`, 'error');
        return;
    }

    // Проверяем на подтверждение минутного напоминания
    if (pendingMinuteReminder && (text.toLowerCase().includes('да') || text.toLowerCase().includes('подтвердить') || text.toLowerCase().includes('yes') || text.toLowerCase().includes('confirm'))) {
        // Создаём подтверждённое минутное напоминание
        const reminder = createReminder(pendingMinuteReminder.title, pendingMinuteReminder.description, pendingMinuteReminder.interval);

        // Добавить сообщение пользователя
        addMessage(text, 'user');
        conversationHistory.push({ role: 'user', content: text });

        // Добавить ответ агента
        const response = `✅ Напоминание создано!\n\n🔔 **${reminder.title}**\n📝 ${reminder.description}\n⏰ Интервал: ${getIntervalLabel(reminder.interval)}\n\nСледующее уведомление: ${new Date(reminder.nextTrigger).toLocaleString('ru-RU')}`;

        addMessage(response, 'assistant');
        conversationHistory.push({ role: 'assistant', content: response });

        // Очищаем pending состояние
        pendingMinuteReminder = null;

        // Обновляем UI напоминаний
        updateRemindersUI();

        // Очистить поле ввода
        inputEl.value = '';
        inputEl.style.height = 'auto';

        return;
    }

    // Проверяем на отмену минутного напоминания
    if (pendingMinuteReminder && (text.toLowerCase().includes('нет') || text.toLowerCase().includes('отмена') || text.toLowerCase().includes('no') || text.toLowerCase().includes('cancel'))) {
        // Добавить сообщение пользователя
        addMessage(text, 'user');
        conversationHistory.push({ role: 'user', content: text });

        const cancelResponse = '❌ Создание напоминания отменено.';
        addMessage(cancelResponse, 'assistant');
        conversationHistory.push({ role: 'assistant', content: cancelResponse });

        // Очищаем pending состояние
        pendingMinuteReminder = null;

        // Очистить поле ввода
        inputEl.value = '';
        inputEl.style.height = 'auto';

        return;
    }

    // Проверяем, является ли сообщение запросом на создание напоминания
    const reminderData = parseReminderRequest(text);
    if (reminderData) {
        // Предупреждение о слишком частых напоминаниях
        if (reminderData.interval === 'every-minute') {
            // Сохраняем данные для подтверждения
            pendingMinuteReminder = reminderData;

            addMessage(text, 'user');
            conversationHistory.push({ role: 'user', content: text });

            const warningResponse = `⚠️ **Предупреждение!**\n\nВы хотите получать напоминания каждую минуту. Это очень частый интервал!\n\nВы уверены? Напишите "да" или "подтвердить" для создания, или "нет" для отмены.`;

            addMessage(warningResponse, 'assistant');
            conversationHistory.push({ role: 'assistant', content: warningResponse });

            // Очистить поле ввода
            inputEl.value = '';
            inputEl.style.height = 'auto';

            return;
        }

        // Создаём напоминание и отвечаем пользователю
        const reminder = createReminder(reminderData.title, reminderData.description, reminderData.interval);

        // Добавить сообщение пользователя
        addMessage(text, 'user');
        conversationHistory.push({ role: 'user', content: text });

        // Добавить ответ агента
        const response = `✅ Напоминание создано!\n\n🔔 **${reminder.title}**\n📝 ${reminder.description}\n⏰ Интервал: ${getIntervalLabel(reminder.interval)}\n\nСледующее уведомление: ${new Date(reminder.nextTrigger).toLocaleString('ru-RU')}`;

        addMessage(response, 'assistant');
        conversationHistory.push({ role: 'assistant', content: response });

        // Обновляем UI напоминаний
        updateRemindersUI();

        // Очистить поле ввода
        inputEl.value = '';
        inputEl.style.height = 'auto';

        return;
    }

    // Добавить сообщение пользователя
    addMessage(text, 'user');
    conversationHistory.push({ role: 'user', content: text });

    // Очистить поле ввода
    inputEl.value = '';
    inputEl.style.height = 'auto';

    // Отправить запрос к API
    await sendToApi(text);
}

/**
 * Создание элемента сообщения (для уведомлений)
 */
function createMessageElement({ role, content, timestamp }) {
    const messageEl = document.createElement('div');
    messageEl.className = `message ${role === 'user' ? 'user' : 'assistant'}`;

    const contentEl = document.createElement('div');
    contentEl.className = 'message-content';
    contentEl.innerHTML = formatMessage(content);

    const metaEl = document.createElement('div');
    metaEl.className = 'message-meta';

    const senderName = role === 'user' ? 'Вы' : 'GorAgent';
    const messageTime = timestamp ? new Date(timestamp) : new Date();
    const time = messageTime.toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit'
    });

    metaEl.innerHTML = `
        <span class="message-sender">${senderName}</span>
        <span>•</span>
        <span>${time}</span>
    `;

    messageEl.appendChild(contentEl);
    messageEl.appendChild(metaEl);

    return messageEl;
}

/**
 * Добавить сообщение в чат
 */
function addMessage(text, sender, isWelcome = false) {
    const messageEl = document.createElement('div');
    messageEl.className = `message ${sender}${isWelcome ? ' welcome' : ''}`;
    
    const contentEl = document.createElement('div');
    contentEl.className = 'message-content';
    contentEl.innerHTML = formatMessage(text);
    
    const metaEl = document.createElement('div');
    metaEl.className = 'message-meta';
    
    const senderName = sender === 'user' ? 'Вы' : 'GorAgent';
    const time = new Date().toLocaleTimeString('ru-RU', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    metaEl.innerHTML = `
        <span class="message-sender">${senderName}</span>
        <span>•</span>
        <span>${time}</span>
    `;
    
    messageEl.appendChild(contentEl);
    messageEl.appendChild(metaEl);
    chatEl.appendChild(messageEl);
    
    // Скролл к новому сообщению
    scrollToBottom();
    
    // Сохранить в localStorage
    saveConversationToStorage();
}

/**
 * Форматирование текста сообщения (Markdown-подобное)
 */
function formatMessage(text) {
    // Сначала обрабатываем details блоки (до экранирования HTML)
    let formatted = text;
    
    // Обработка <details> блоков с JSON
    formatted = formatted.replace(/<details>\n?([\s\S]*?)\n?<\/details>/g, (match, content) => {
        // Обрабатываем содержимое details отдельно
        let detailsContent = content
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        
        // Код блоки внутри details
        detailsContent = detailsContent.replace(/```(\w*)\n?([\s\S]*?)```/g, (m, lang, code) => {
            return `<pre><code>${code.trim()}</code></pre>`;
        });
        
        // Жирный текст
        detailsContent = detailsContent.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        
        // Переносы
        detailsContent = detailsContent.replace(/\n/g, '<br>');
        
        return `<details class="json-details"><summary>📄 Показать сырой JSON</summary><div class="details-content">${detailsContent}</div></details>`;
    });
    
    // Экранировать HTML (для остального текста)
    // Пропускаем уже обработанные details
    const detailsBlocks = [];
    formatted = formatted.replace(/<details class="json-details">[\s\S]*?<\/details>/g, (match) => {
        detailsBlocks.push(match);
        return `__DETAILS_BLOCK_${detailsBlocks.length - 1}__`;
    });
    
    formatted = formatted
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    
    // Код блоки ```
    formatted = formatted.replace(/```(\w*)\n?([\s\S]*?)```/g, (match, lang, code) => {
        return `<pre><code>${code.trim()}</code></pre>`;
    });
    
    // Inline код `code`
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Жирный текст **text**
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // Курсив *text*
    formatted = formatted.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    
    // Ссылки [text](url)
    formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    
    // Горизонтальный разделитель ---
    formatted = formatted.replace(/\n---\n/g, '<hr>');
    
    // Переносы строк
    formatted = formatted.replace(/\n/g, '<br>');
    
    // Восстанавливаем details блоки
    detailsBlocks.forEach((block, i) => {
        formatted = formatted.replace(`__DETAILS_BLOCK_${i}__`, block);
    });
    
    return formatted;
}

/**
 * Отправка запроса к API
 */
async function sendToApi(message) {
    isWaitingForResponse = true;
    setUILoading(true);
    
    try {
        // Определяем эндпоинт в зависимости от провайдера
        const endpoint = API_ENDPOINTS[currentApiProvider];
        
        // Формируем запрос с System Prompt и Temperature
        console.log('Отправляем temperature:', currentTemperature);
        console.log('API провайдер:', currentApiProvider);
        
        // Используем историю с учётом сжатия
        const historyForApi = getHistoryForApi();
        
        const requestBody = {
            message,
            history: historyForApi, // История с учётом сжатия
            systemPrompt: currentSystemPrompt, // Передаём текущий System Prompt
            temperature: currentTemperature, // Передаём текущий Temperature
            maxTokens: currentMaxTokens // Передаём текущий Max Tokens
        };
        
        // Если используется OpenRouter, добавляем модель
        if (currentApiProvider === 'openrouter') {
            requestBody.model = currentOpenRouterModel;
        }
        
        // Логируем запрос в консоль браузера
        const providerColor = currentApiProvider === 'openai' ? '#4CAF50' : '#9C27B0';
        const providerName = currentApiProvider === 'openai' ? 'OpenAI' : 'OpenRouter';
        
        console.log(`%c═══════════════════════════════════════════════════════`, `color: ${providerColor}`);
        console.log(`%c📤 ЗАПРОС К ${providerName}`, `color: ${providerColor}; font-weight: bold; font-size: 14px`);
        console.log(`%c═══════════════════════════════════════════════════════`, `color: ${providerColor}`);
        console.log('Эндпоинт:', endpoint);
        if (currentApiProvider === 'openrouter') {
            console.log('Модель:', currentOpenRouterModel);
        }
        console.log('Структура запроса:');
        console.log(requestBody);
        console.log(`%c───────────────────────────────────────────────────────`, `color: ${providerColor}`);
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Ошибка сервера: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Извлекаем метаданные
        const meta = data._meta || {};
        const responseTime = meta.responseTime || 0;
        const tokens = meta.tokens || {};
        const cost = meta.cost || 0;
        const model = meta.model || '';
        
        // Логируем ответ в консоль браузера
        console.log('%c═══════════════════════════════════════════════════════', 'color: #2196F3');
        console.log(`%c📥 ОТВЕТ ОТ ${providerName}`, 'color: #2196F3; font-weight: bold; font-size: 14px');
        console.log('%c═══════════════════════════════════════════════════════', 'color: #2196F3');
        console.log('Сырой JSON ответ:');
        console.log(data);
        console.log('%c───────────────────────────────────────────────────────', 'color: #2196F3');
        console.log('Распарсенные поля:');
        console.log('  message:', data.message);
        console.log('  answer:', data.answer);
        console.log('  _meta:', meta);
        console.log('%c═══════════════════════════════════════════════════════', 'color: #2196F3');
        
        // Ответ приходит в формате { message: "...", answer: "..." }
        const agentReply = data.answer || data.reply || 'Не удалось получить ответ.';
        
        // Форматируем JSON для красивого отображения (без _meta для чистоты)
        const displayData = { message: data.message, answer: data.answer };
        const jsonString = JSON.stringify(displayData, null, 2);
        
        // Формируем строку с метаданными
        const formatTime = (ms) => {
            if (ms < 1000) return `${ms}ms`;
            return `${(ms / 1000).toFixed(2)}s`;
        };
        
        const formatCost = (cost) => {
            if (cost < 0.0001) return `$${cost.toFixed(8)}`;
            if (cost < 0.01) return `$${cost.toFixed(6)}`;
            return `$${cost.toFixed(4)}`;
        };
        
        // Создаём компактный блок метаданных с детализацией токенов
        const promptTokens = tokens.prompt || 0;
        const completionTokens = tokens.completion || 0;
        const totalTokens = tokens.total || 0;
        const metaInfo = `⏱️ **${formatTime(responseTime)}** | 🔢 Токены: **${promptTokens}** prompt + **${completionTokens}** completion = **${totalTokens}** total | 💰 **${formatCost(cost)}** | 🤖 ${model}`;
        
        // Показываем ответ с метаданными
        const jsonMessage = `${agentReply}\n\n---\n\n${metaInfo}\n\n<details>\n**Сырой JSON:**\n\`\`\`json\n${jsonString}\n\`\`\`\n</details>`;
        
        // Добавить ответ агента
        addMessage(jsonMessage, 'agent');
        conversationHistory.push({ role: 'assistant', content: agentReply });
        
        // Обновляем статистику
        updateCompressionStats();
        
        // Проверяем нужно ли сжимать историю
        if (compressionEnabled && conversationHistory.length >= compressionThreshold) {
            console.log('%c📊 Достигнут порог сжатия!', 'color: #f59e0b; font-weight: bold');
            // Небольшая задержка перед сжатием для UX
            setTimeout(() => compressHistory(), 1000);
        }
        
    } catch (error) {
        console.error('API Error:', error);
        addMessage(`Произошла ошибка: ${error.message}. Попробуйте позже.`, 'error');
    } finally {
        isWaitingForResponse = false;
        setUILoading(false);
    }
}

/**
 * Управление UI во время загрузки
 */
function setUILoading(isLoading) {
    sendBtn.disabled = isLoading;
    typingEl.hidden = !isLoading;
    
    if (isLoading) {
        scrollToBottom();
    }
}

/**
 * Скролл к низу чата
 */
function scrollToBottom() {
    requestAnimationFrame(() => {
        chatEl.scrollTop = chatEl.scrollHeight;
    });
}

/**
 * Авто-ресайз textarea
 */
function setupTextareaAutoResize() {
    inputEl.addEventListener('input', () => {
        inputEl.style.height = 'auto';
        inputEl.style.height = Math.min(inputEl.scrollHeight, 150) + 'px';
    });
}

/**
 * Сохранение истории в localStorage
 */
function saveConversationToStorage() {
    try {
        const messages = Array.from(chatEl.children).map(el => ({
            sender: el.classList.contains('user') ? 'user' : 
                    el.classList.contains('error') ? 'error' : 'agent',
            content: el.querySelector('.message-content')?.textContent || '',
            isWelcome: el.classList.contains('welcome')
        }));
        localStorage.setItem('goragent_history', JSON.stringify(messages));
        localStorage.setItem('goragent_conversation', JSON.stringify(conversationHistory));
    } catch (e) {
        console.warn('Не удалось сохранить историю:', e);
    }
}

/**
 * Загрузка истории из localStorage
 */
function loadConversationFromStorage() {
    try {
        const saved = localStorage.getItem('goragent_conversation');
        if (saved) {
            conversationHistory = JSON.parse(saved);
        }
    } catch (e) {
        console.warn('Не удалось загрузить историю:', e);
        conversationHistory = [];
    }
}

/**
 * Восстановление сообщений из истории
 */
function restoreMessagesFromHistory() {
    try {
        const saved = localStorage.getItem('goragent_history');
        if (saved) {
            const messages = JSON.parse(saved);
            messages.forEach(msg => {
                if (msg.sender !== 'error') {
                    const messageEl = document.createElement('div');
                    messageEl.className = `message ${msg.sender}${msg.isWelcome ? ' welcome' : ''}`;
                    
                    const contentEl = document.createElement('div');
                    contentEl.className = 'message-content';
                    contentEl.innerHTML = formatMessage(msg.content);
                    
                    messageEl.appendChild(contentEl);
                    chatEl.appendChild(messageEl);
                }
            });
            scrollToBottom();
        }
    } catch (e) {
        console.warn('Не удалось восстановить сообщения:', e);
        showWelcomeMessage();
    }
}

/**
 * Очистка истории чата (можно вызвать из консоли)
 */
function clearChat() {
    chatEl.innerHTML = '';
    conversationHistory = [];

    // Очищаем pending напоминание
    pendingMinuteReminder = null;

    // Очищаем данные сжатия
    compressionSummary = null;
    compressionStats = {
        totalMessages: 0,
        compressedTokens: 0,
        summaryTokens: 0,
        compressions: []
    };

    localStorage.removeItem('goragent_history');
    localStorage.removeItem('goragent_conversation');
    localStorage.removeItem('goragent_compression_summary');
    localStorage.removeItem('goragent_compression_stats');
    
    // Обновляем UI статистики
    updateCompressionStats();
    renderCompressionHistory();
    
    showWelcomeMessage();
}

// ===== Функции сжатия истории =====

/**
 * Оценка количества токенов (приблизительно)
 */
function estimateTokens(text) {
    if (!text) return 0;
    return Math.ceil(text.length / 3.5);
}

/**
 * Подсчёт токенов во всей истории
 */
function calculateHistoryTokens(history) {
    return history.reduce((total, msg) => total + estimateTokens(msg.content), 0);
}

/**
 * Обновление статистики сжатия
 */
function updateCompressionStats() {
    // Подсчёт текущих сообщений
    const currentHistoryTokens = calculateHistoryTokens(conversationHistory);
    const summaryTokens = compressionSummary ? estimateTokens(compressionSummary.summary) : 0;
    
    // Общее кол-во сообщений (текущие + сжатые)
    const totalMessages = conversationHistory.length + (compressionSummary?.originalCount || 0);
    
    // Оригинальные токены = токены сжатых сообщений + токены текущих сообщений
    // (сколько бы мы отправили БЕЗ сжатия)
    const originalTokens = compressionStats.compressedTokens + currentHistoryTokens;
    
    // Текущие токены = резюме + текущие сообщения
    // (сколько мы реально отправляем)
    const currentTokens = summaryTokens + currentHistoryTokens;
    
    // Сэкономлено = разница между тем что было бы и тем что есть
    // = сжатые токены - токены резюме
    const savedTokens = Math.max(0, compressionStats.compressedTokens - summaryTokens);
    
    compressionStats.totalMessages = totalMessages;
    compressionStats.summaryTokens = summaryTokens;

    // Обновляем UI
    const statMessages = document.getElementById('stat-messages');
    const statOriginalTokens = document.getElementById('stat-original-tokens');
    const statCurrentTokens = document.getElementById('stat-current-tokens');
    const statSavedTokens = document.getElementById('stat-saved-tokens');

    if (statMessages) statMessages.textContent = totalMessages;
    if (statOriginalTokens) statOriginalTokens.textContent = originalTokens;
    if (statCurrentTokens) statCurrentTokens.textContent = currentTokens;
    
    const savingsPercent = compressionStats.compressedTokens > 0 
        ? ((savedTokens / compressionStats.compressedTokens) * 100).toFixed(0) 
        : 0;
    if (statSavedTokens) statSavedTokens.textContent = `${savedTokens} (${savingsPercent}%)`;
}

/**
 * Сжатие истории диалога
 */
async function compressHistory(force = false) {
    // Проверяем нужно ли сжимать
    if (!compressionEnabled && !force) return false;
    if (conversationHistory.length < compressionThreshold && !force) return false;
    
    console.log('%c🗜️ Начинаем сжатие истории...', 'color: #8b5cf6; font-weight: bold');
    
    try {
        // Показываем индикатор сжатия
        showCompressionIndicator(true);
        
        // Берём сообщения для сжатия (все кроме последних 2-3)
        const keepRecent = 3;
        const toCompress = conversationHistory.slice(0, -keepRecent);
        const toKeep = conversationHistory.slice(-keepRecent);
        
        if (toCompress.length === 0) {
            console.log('%c🗜️ Недостаточно сообщений для сжатия', 'color: #f59e0b');
            showCompressionIndicator(false);
            return false;
        }
        
        // Если уже есть summary, добавляем его к сжимаемым данным
        const historyToSend = compressionSummary 
            ? [{ role: 'system', content: `Предыдущее резюме:\n${compressionSummary.summary}` }, ...toCompress]
            : toCompress;
        
        // Подсчитываем токены сжимаемых сообщений
        const tokensBeforeCompression = calculateHistoryTokens(toCompress);
        
        // Отправляем запрос на сжатие
        const response = await fetch('/api/compress-history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                history: historyToSend,
                provider: currentApiProvider,
                model: currentApiProvider === 'openrouter' ? currentOpenRouterModel : null
            })
        });
        
        if (!response.ok) {
            throw new Error('Ошибка при сжатии истории');
        }
        
        const result = await response.json();
        
if (result.success) {
            // Сохраняем новое summary
            compressionSummary = {
                summary: result.summary,
                originalCount: (compressionSummary?.originalCount || 0) + toCompress.length,
                timestamp: new Date().toISOString()
            };

            // Обновляем историю - оставляем только недавние сообщения
            conversationHistory = toKeep;
            
            // Накапливаем токены сжатых сообщений
            compressionStats.compressedTokens += tokensBeforeCompression;

            // Добавляем запись о сжатии
            compressionStats.compressions.push({
                time: new Date().toLocaleTimeString('ru-RU'),
                messagesBefore: toCompress.length,
                tokensBefore: tokensBeforeCompression,
                tokensAfter: result.summaryTokens,
                saved: result.tokensSaved
            });
            
            // Обновляем статистику
            updateCompressionStats();
            
            // Обновляем историю сжатий в UI
            renderCompressionHistory();
            
            // Логируем результат
            console.log('%c✅ История сжата!', 'color: #10b981; font-weight: bold');
            console.log('Резюме:', result.summary);
            console.log(`Токенов сэкономлено: ${result.tokensSaved} (${result.compressionRatio}%)`);
            
            // Сохраняем в localStorage
            saveCompressionData();
            
            // Показываем уведомление в чате
            addMessage(
                `🗜️ **История сжата!**\n\n` +
                `📊 Сжато сообщений: **${toCompress.length}**\n` +
                `💾 Сэкономлено токенов: **${result.tokensSaved}** (${result.compressionRatio}%)\n\n` +
                `_Контекст разговора сохранён в резюме._`,
                'agent'
            );
            
            showCompressionIndicator(false);
            return true;
        }
    } catch (error) {
        console.error('Ошибка сжатия:', error);
        addMessage(`⚠️ Ошибка при сжатии истории: ${error.message}`, 'error');
    }
    
    showCompressionIndicator(false);
    return false;
}

/**
 * Показать/скрыть индикатор сжатия
 */
function showCompressionIndicator(show) {
    let indicator = document.getElementById('compression-indicator');
    
    if (show && !indicator) {
        indicator = document.createElement('div');
        indicator.id = 'compression-indicator';
        indicator.className = 'compression-indicator';
        indicator.innerHTML = `
            <div class="compression-indicator-content">
                <div class="compression-spinner"></div>
                <span>Сжимаем историю...</span>
            </div>
        `;
        document.body.appendChild(indicator);
    } else if (!show && indicator) {
        indicator.remove();
    }
}

/**
 * Отрисовка истории сжатий
 */
function renderCompressionHistory() {
    const container = document.getElementById('compression-history');
    const itemsContainer = document.getElementById('compression-history-items');
    
    if (!container || !itemsContainer) return;
    
    if (compressionStats.compressions.length === 0) {
        container.hidden = true;
        return;
    }
    
    container.hidden = false;
    itemsContainer.innerHTML = compressionStats.compressions.map((c, i) => `
        <div class="history-item">
            <span class="history-time">${c.time}</span>
            <span class="history-detail">${c.messagesBefore} сообщ. → ${c.saved} токенов сэкономлено</span>
        </div>
    `).join('');
}

/**
 * Сохранение данных сжатия в localStorage
 */
function saveCompressionData() {
    try {
        localStorage.setItem('goragent_compression_enabled', compressionEnabled.toString());
        localStorage.setItem('goragent_compression_threshold', compressionThreshold.toString());
        localStorage.setItem('goragent_compression_summary', JSON.stringify(compressionSummary));
        localStorage.setItem('goragent_compression_stats', JSON.stringify(compressionStats));
    } catch (e) {
        console.warn('Не удалось сохранить данные сжатия:', e);
    }
}

/**
 * Загрузка данных сжатия из localStorage
 */
function loadCompressionData() {
    try {
        const enabled = localStorage.getItem('goragent_compression_enabled');
        const threshold = localStorage.getItem('goragent_compression_threshold');
        const summary = localStorage.getItem('goragent_compression_summary');
        const stats = localStorage.getItem('goragent_compression_stats');

        if (enabled !== null) compressionEnabled = enabled === 'true';
        if (threshold !== null) compressionThreshold = parseInt(threshold) || 10;
        if (summary) compressionSummary = JSON.parse(summary);
        if (stats) {
            const loadedStats = JSON.parse(stats);
            // Миграция со старой структуры на новую
            compressionStats = {
                totalMessages: loadedStats.totalMessages || 0,
                compressedTokens: loadedStats.compressedTokens || loadedStats.originalTokens || 0,
                summaryTokens: loadedStats.summaryTokens || 0,
                compressions: loadedStats.compressions || []
            };
        }
        
        // Обновляем UI
        const enabledCheckbox = document.getElementById('compression-enabled');
        const thresholdInput = document.getElementById('compression-threshold');
        const settingsDiv = document.getElementById('compression-settings');
        
        if (enabledCheckbox) enabledCheckbox.checked = compressionEnabled;
        if (thresholdInput) thresholdInput.value = compressionThreshold;
        if (settingsDiv) settingsDiv.classList.toggle('active', compressionEnabled);
        
        updateCompressionStats();
        renderCompressionHistory();
        
        console.log('Загружены настройки сжатия:', { compressionEnabled, compressionThreshold, hasSummary: !!compressionSummary });
    } catch (e) {
        console.warn('Не удалось загрузить данные сжатия:', e);
    }
}

/**
 * Инициализация обработчиков сжатия
 */
function initCompressionHandlers() {
    const enabledCheckbox = document.getElementById('compression-enabled');
    const thresholdInput = document.getElementById('compression-threshold');
    const manualCompressBtn = document.getElementById('manual-compress-btn');
    const settingsDiv = document.getElementById('compression-settings');
    
    if (enabledCheckbox) {
        enabledCheckbox.addEventListener('change', (e) => {
            compressionEnabled = e.target.checked;
            if (settingsDiv) settingsDiv.classList.toggle('active', compressionEnabled);
            saveCompressionData();
            
            console.log('%c⚙️ Сжатие ' + (compressionEnabled ? 'включено' : 'выключено'), 
                       'color: #6366f1; font-weight: bold');
        });
    }
    
    if (thresholdInput) {
        thresholdInput.addEventListener('change', (e) => {
            compressionThreshold = Math.max(4, Math.min(30, parseInt(e.target.value) || 10));
            e.target.value = compressionThreshold;
            saveCompressionData();
            
            console.log('%c⚙️ Порог сжатия: ' + compressionThreshold + ' сообщений', 
                       'color: #6366f1');
        });
    }
    
    if (manualCompressBtn) {
        manualCompressBtn.addEventListener('click', async () => {
            if (conversationHistory.length < 4) {
                addMessage('⚠️ Недостаточно сообщений для сжатия (минимум 4)', 'error');
                return;
            }
            
            manualCompressBtn.disabled = true;
            manualCompressBtn.textContent = '⏳ Сжимаем...';
            
            await compressHistory(true);
            
            manualCompressBtn.disabled = false;
            manualCompressBtn.textContent = '🗜️ Сжать историю сейчас';
        });
    }
    
    // Загружаем сохранённые данные
    loadCompressionData();
}

/**
 * Инициализация обработчиков напоминаний
 */
function initReminderHandlers() {
    const titleInput = document.getElementById('reminder-title');
    const descriptionInput = document.getElementById('reminder-description');
    const intervalSelect = document.getElementById('reminder-interval');
    const createBtn = document.getElementById('create-reminder-btn');
    const remindersList = document.getElementById('reminders-list');
    const remindersCount = document.getElementById('reminders-count');
    const notificationsList = document.getElementById('notifications-list');
    const recentNotifications = document.getElementById('recent-notifications');

    // Обработчик создания напоминания
    if (createBtn) {
        createBtn.addEventListener('click', () => {
            const title = titleInput?.value?.trim();
            const description = descriptionInput?.value?.trim();
            const interval = intervalSelect?.value;

            if (!title || !description) {
                addMessage('⚠️ Пожалуйста, заполните название и описание напоминания', 'error');
                return;
            }

            const reminder = createReminder(title, description, interval);

            // Очищаем форму
            if (titleInput) titleInput.value = '';
            if (descriptionInput) descriptionInput.value = '';

            // Обновляем UI
            updateRemindersUI();

            addMessage(`✅ Создано напоминание "${reminder.title}"`, 'success');
        });
    }

    // Обработчик кнопки тестирования
    const testBtn = document.getElementById('test-reminders-btn');
    if (testBtn) {
        testBtn.addEventListener('click', async () => {
            console.log('🧪 Запуск ручной проверки напоминаний...');
            testBtn.disabled = true;
            testBtn.textContent = '⏳ Проверяем...';

            try {
                await checkReminders();
                addMessage('✅ Ручная проверка напоминаний выполнена. Проверьте консоль для деталей.', 'info');
            } catch (error) {
                console.error('Ошибка при ручной проверке:', error);
                addMessage('❌ Ошибка при проверке напоминаний', 'error');
            }

            testBtn.disabled = false;
            testBtn.textContent = '🧪 Проверить сейчас';
        });
    }

    // Обработчик кнопки "Удалить все"
    const clearAllBtn = document.getElementById('clear-all-reminders-btn');
    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', () => {
            clearAllReminders();
        });
    }

    // Обработчик клавиши Enter в полях ввода
    [titleInput, descriptionInput].forEach(input => {
        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    createBtn?.click();
                }
            });
        }
    });

    // Инициализация UI
    updateRemindersUI();
}

/**
 * Обновление UI напоминаний
 */
function updateRemindersUI() {
    console.log('🔄 Обновление UI напоминаний, всего напоминаний:', reminders.length);

    const remindersList = document.getElementById('reminders-list');
    const remindersCount = document.getElementById('reminders-count');
    const notificationsList = document.getElementById('notifications-list');
    const recentNotifications = document.getElementById('recent-notifications');

    console.log('📋 Найден remindersList:', !!remindersList, 'remindersCount:', !!remindersCount);

    if (!remindersList || !remindersCount) {
        console.error('❌ Не найдены элементы DOM для напоминаний!');
        return;
    }

    // Обновляем счетчик напоминаний
    remindersCount.textContent = reminders.length;

    // Показываем/скрываем кнопку "Удалить все"
    const clearAllBtn = document.getElementById('clear-all-reminders-btn');
    if (clearAllBtn) {
        clearAllBtn.style.display = reminders.length > 0 ? 'inline-block' : 'none';
    }

    // Обновляем список напоминаний
    remindersList.innerHTML = '';

    if (reminders.length === 0) {
        console.log('📭 Нет активных напоминаний, показываем заглушку');
        remindersList.innerHTML = '<div class="no-reminders">У вас пока нет активных напоминаний</div>';
    } else {
        console.log('📝 Есть активные напоминания, создаем элементы');
        // Сортируем напоминания по времени следующего срабатывания
        const sortedReminders = [...reminders].sort((a, b) => a.nextTrigger - b.nextTrigger);
        console.log('📋 Отсортированные напоминания:', sortedReminders.map(r => ({title: r.title, nextTrigger: new Date(r.nextTrigger).toLocaleString()})));

        sortedReminders.forEach((reminder, index) => {
            console.log(`📌 Создание элемента для напоминания ${index + 1}:`, reminder.title);
            const reminderEl = createReminderElement(reminder);
            if (reminderEl) {
                console.log(`✅ Элемент создан, добавляем в DOM`);
                remindersList.appendChild(reminderEl);
            } else {
                console.error(`❌ Не удалось создать элемент для напоминания:`, reminder.title);
            }
        });

        console.log('🎉 Все элементы добавлены в DOM');
    }

    // Обновляем список уведомлений
    if (notificationsList && recentNotifications) {
        notificationsList.innerHTML = '';

        if (reminderNotifications.length > 0) {
            reminderNotifications.slice(0, 10).forEach(notification => {
                const notificationEl = createNotificationElement(notification);
                notificationsList.appendChild(notificationEl);
            });
            recentNotifications.hidden = false;
        } else {
            recentNotifications.hidden = true;
        }
    }
}

/**
 * Создание элемента напоминания
 */
function createReminderElement(reminder) {
    console.log('🏗️ Создание элемента для напоминания:', reminder.title);

    if (!reminder || !reminder.title) {
        console.error('❌ Напоминание повреждено:', reminder);
        return null;
    }

    const div = document.createElement('div');
    div.className = 'reminder-item';

    const now = Date.now();
    const nextTriggerDate = new Date(reminder.nextTrigger);
    const timeString = nextTriggerDate.toLocaleString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit'
    });

    // Вычисляем время до следующего срабатывания
    const timeUntil = reminder.nextTrigger - now;
    let timeUntilString = '';
    if (timeUntil > 0) {
        const minutes = Math.floor(timeUntil / (1000 * 60));
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) {
            timeUntilString = `через ${days} д.`;
        } else if (hours > 0) {
            timeUntilString = `через ${hours} ч.`;
        } else if (minutes > 0) {
            timeUntilString = `через ${minutes} мин.`;
        } else {
            timeUntilString = 'скоро';
        }
    } else {
        timeUntilString = 'просрочено';
    }

    const intervalLabels = {
        'every-minute': 'Каждую минуту',
        'every-15-min': 'Каждые 15 мин',
        'every-30-min': 'Каждые 30 мин',
        'hourly': 'Каждый час',
        'daily': 'Ежедневно'
    };

    div.innerHTML = `
        <div class="reminder-info">
            <span class="reminder-title">${reminder.title}</span>
            <span class="reminder-description">${reminder.description}</span>
            <div class="reminder-meta">
                <span class="reminder-interval">${intervalLabels[reminder.interval] || reminder.interval}</span>
                <span class="reminder-next-trigger">Следующее: ${timeString} (${timeUntilString})</span>
            </div>
        </div>
        <div class="reminder-actions">
            <button class="delete-reminder-btn" data-reminder-id="${reminder.id}" title="Удалить напоминание">
                🗑️
            </button>
        </div>
    `;

    // Обработчик удаления
    const deleteBtn = div.querySelector('.delete-reminder-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const reminderId = e.target.dataset.reminderId;
            if (confirm('Удалить это напоминание?')) {
                deleteReminder(reminderId);
                updateRemindersUI();
                addMessage('🗑️ Напоминание удалено', 'success');
            }
        });
    }

    return div;
}

/**
 * Создание элемента уведомления
 */
function createNotificationElement(notification) {
    const div = document.createElement('div');
    div.className = 'notification-item';

    const timestamp = new Date(notification.timestamp).toLocaleString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: 'short'
    });

    div.innerHTML = `
        <span class="notification-title">${notification.title}</span>
        <span class="notification-summary">${notification.summary}</span>
        <span class="notification-timestamp">${timestamp}</span>
    `;

    return div;
}

/**
 * Получение истории для отправки в API (с учётом сжатия)
 */
function getHistoryForApi() {
    let history = [];
    
    // Если есть сжатое резюме, добавляем его первым
    if (compressionSummary) {
        history.push({
            role: 'system',
            content: `[КОНТЕКСТ ПРЕДЫДУЩЕГО РАЗГОВОРА]\n${compressionSummary.summary}\n[КОНЕЦ КОНТЕКСТА]`
        });
    }
    
    // Добавляем текущую историю (последние сообщения)
    history = history.concat(conversationHistory.slice(-20));
    
    return history;
}

// ===== ФУНКЦИИ НАПОМИНАНИЙ =====

/**
 * Структура напоминания:
 * {
 *   id: string,           // Уникальный ID
 *   title: string,        // Заголовок напоминания
 *   description: string,  // Описание
 *   interval: string,     // Интервал: 'daily', 'hourly', 'every-30-min', 'every-15-min'
 *   nextTrigger: number,  // Timestamp следующего срабатывания
 *   created: number,      // Timestamp создания
 *   lastTriggered: number // Timestamp последнего срабатывания
 * }
 */

/**
 * Создание нового напоминания
 */
function createReminder(title, description, interval) {
    console.log('🏭 Начинаем создание напоминания:', {title, description, interval});

    const now = Date.now();
    const nextTriggerTime = calculateNextTrigger(interval, now);

    const reminder = {
        id: `reminder_${now}_${Math.random().toString(36).substr(2, 9)}`,
        title: title.trim(),
        description: description.trim(),
        interval: interval,
        nextTrigger: nextTriggerTime,
        created: now,
        lastTriggered: null
    };

    reminders.push(reminder);
    saveRemindersToStorage();
    startReminderChecker();

    console.log('🔔 Создано напоминание:', {
        title: reminder.title,
        interval: reminder.interval,
        nextTrigger: new Date(reminder.nextTrigger).toLocaleString(),
        timeUntilTrigger: Math.round((reminder.nextTrigger - now) / 1000) + ' сек'
    });

    // Для тестирования: сразу проверим, не пора ли сработать
    if (reminder.nextTrigger <= now + 1000) { // Если должно сработать в ближайшую секунду
        console.log('⚡ Новое напоминание срабатывает немедленно для тестирования');
        setTimeout(() => checkReminders(), 100); // Проверим через 100мс
    }

    return reminder;
}

/**
 * Вычисление следующего времени срабатывания
 */
function calculateNextTrigger(interval, fromTime = Date.now()) {
    const now = new Date(fromTime);

    switch (interval) {
        case 'every-minute':
            // Следующая минута
            const nextMinute = new Date(now);
            nextMinute.setMinutes(nextMinute.getMinutes() + 1);
            nextMinute.setSeconds(0, 0);
            return nextMinute.getTime();

        case 'every-15-min':
            // Следующие 15 минут
            const next15 = new Date(now);
            const currentMinutes = next15.getMinutes();
            const nextQuarter = Math.ceil(currentMinutes / 15) * 15;
            next15.setMinutes(nextQuarter, 0, 0);
            if (nextQuarter === 0 && currentMinutes >= 45) {
                next15.setHours(next15.getHours() + 1);
            }
            return next15.getTime();

        case 'every-30-min':
            // Следующие 30 минут
            const next30 = new Date(now);
            const minutes = next30.getMinutes();
            const nextSlot = Math.ceil(minutes / 30) * 30;
            next30.setMinutes(nextSlot, 0, 0);
            if (nextSlot === 0 && minutes >= 30) {
                next30.setHours(next30.getHours() + 1);
            }
            return next30.getTime();

        case 'hourly':
            // Следующий час
            const nextHour = new Date(now);
            nextHour.setHours(nextHour.getHours() + 1);
            nextHour.setMinutes(0, 0, 0);
            return nextHour.getTime();

        case 'daily':
            // Следующий день в 9:00 утра
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(9, 0, 0, 0);
            return tomorrow.getTime();

        default:
            return fromTime + (60 * 60 * 1000); // По умолчанию через час
    }
}

/**
 * Удаление напоминания
 */
function deleteReminder(reminderId) {
    const index = reminders.findIndex(r => r.id === reminderId);
    if (index !== -1) {
        reminders.splice(index, 1);
        saveRemindersToStorage();
        console.log('Удалено напоминание:', reminderId);
        updateRemindersUI();
    }
}

/**
 * Удаление всех напоминаний
 */
function clearAllReminders() {
    if (reminders.length === 0) return;

    if (confirm(`Удалить все ${reminders.length} напоминаний? Это действие нельзя отменить.`)) {
        reminders = [];
        reminderNotifications = [];
        saveRemindersToStorage();
        saveReminderNotificationsToStorage();
        stopReminderChecker();
        updateRemindersUI();
        console.log('Удалены все напоминания');
        addMessage('🗑️ Все напоминания удалены', 'info');
    }
}

/**
 * Получение активных напоминаний
 */
function getActiveReminders() {
    return reminders.filter(r => r.nextTrigger > Date.now());
}

/**
 * Добавление уведомления в историю чата
 */
function addReminderNotification(reminder, summary) {
    console.log('💬 Добавление уведомления в чат:', reminder.title, 'с текстом:', summary.substring(0, 50) + '...');

    const notification = {
        id: `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        reminderId: reminder.id,
        title: reminder.title,
        summary: summary,
        timestamp: Date.now()
    };

    reminderNotifications.unshift(notification); // Добавляем в начало массива

    // Ограничиваем историю уведомлений (максимум 50)
    if (reminderNotifications.length > 50) {
        reminderNotifications = reminderNotifications.slice(0, 50);
    }

    saveReminderNotificationsToStorage();

    // Добавляем сообщение в чат
    const messageContent = `🔔 **Напоминание:** ${reminder.title}\n\n${summary}`;
    console.log('📨 Создание сообщения в чате:', messageContent.substring(0, 100) + '...');

    const messageDiv = createMessageElement({
        role: 'assistant',
        content: messageContent,
        timestamp: new Date().toISOString()
    });

    console.log('✅ Элемент сообщения создан, добавляем в чат');
    chatEl.appendChild(messageDiv);
    chatEl.scrollTop = chatEl.scrollHeight;
    console.log('🎉 Уведомление добавлено в чат успешно');

    console.log('Добавлено уведомление о напоминании:', notification);
}

/**
 * Обновление времени следующего срабатывания напоминания
 */
function updateReminderTrigger(reminder) {
    reminder.lastTriggered = Date.now();
    reminder.nextTrigger = calculateNextTrigger(reminder.interval, Date.now());
    saveRemindersToStorage();
}

/**
 * Проверка напоминаний и генерация уведомлений
 */
async function checkReminders() {
    // Если нет напоминаний, не выполнять проверку
    if (reminders.length === 0) {
        console.log('🔍 Проверка напоминаний пропущена: нет активных напоминаний');
        return;
    }

    const now = Date.now();
    const dueReminders = reminders.filter(r => r.nextTrigger <= now);

    console.log('🔍 Проверка напоминаний:', new Date(now).toLocaleTimeString(), ', найдено:', dueReminders.length);

    for (const reminder of dueReminders) {
        try {
            console.log('📢 Срабатывание напоминания:', reminder.title, 'интервал:', reminder.interval);
            // Генерируем summary с помощью AI
            const summary = await generateReminderSummary(reminder);
            console.log('📝 Сгенерировано уведомление:', summary.substring(0, 50) + '...');
            addReminderNotification(reminder, summary);
            updateReminderTrigger(reminder);
            console.log('✅ Напоминание обработано, следующее срабатывание:', new Date(reminder.nextTrigger).toLocaleTimeString());
        } catch (error) {
            console.error('❌ Ошибка при обработке напоминания:', error);
            // В случае ошибки используем fallback сообщение
            const fallbackSummary = `⏰ Время для: ${reminder.description}`;
            console.log('🔄 Используем fallback уведомление:', fallbackSummary);
            addReminderNotification(reminder, fallbackSummary);
            updateReminderTrigger(reminder);
        }
    }
}

/**
 * Проверяет, содержит ли объект данные о погоде
 */
function hasWeatherData(obj) {
    if (!obj || typeof obj !== 'object') return false;

    const weatherIndicators = [
        'temperature', 'temp', 'weather', 'description', 'humidity', 'wind',
        'pressure', 'visibility', 'clouds', 'main', 'name', 'sys', 'coord'
    ];

    return weatherIndicators.some(indicator => indicator in obj) ||
           (obj.weather && Array.isArray(obj.weather)) ||
           (obj.main && typeof obj.main === 'object');
}

/**
 * Извлекает данные о погоде из ответа MCP
 */
function extractWeatherData(data) {
    console.log('🔧 Извлекаем данные погоды из ответа:', data);

    // Если данные уже в правильном формате
    if (data.temperature || data.weather || data.temp || data.description) {
        return data;
    }

    // Если есть вложенные данные
    if (data.result && hasWeatherData(data.result)) {
        return data.result;
    }

    // Если данные в массиве weather (OpenWeatherMap формат)
    if (data.weather && Array.isArray(data.weather) && data.weather.length > 0) {
        return {
            ...data,
            weather: data.weather[0].description,
            temperature: data.main?.temp,
            humidity: data.main?.humidity,
            wind: data.wind?.speed,
            pressure: data.main?.pressure
        };
    }

    // Возвращаем как есть, если не можем распарсить
    console.log('⚠️ Возвращаем данные как есть, без дополнительной обработки');
    return data;
}

/**
 * Выполнение MCP инструмента через API
 */
async function executeMCPToolAPI(toolName, args) {
    try {
        const response = await fetch('/api/mcp/execute', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                toolName: toolName,
                arguments: args
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data.result;
    } catch (error) {
        console.error('Ошибка выполнения MCP инструмента:', error);
        throw error;
    }
}

/**
 * Получение данных о погоде через MCP
 */
async function getWeatherData(location) {
    try {
        // Пробуем разные варианты названия инструмента погоды
        const weatherTools = ['get_weather', 'weather', 'getWeather'];

        for (const toolName of weatherTools) {
            try {
                // Пробуем разные варианты параметров для разных MCP инструментов
                const paramVariants = [
                    { city: location },      // city parameter
                    { q: location },         // q parameter (OpenWeatherMap)
                    { location: location },  // location parameter
                    { query: location },     // query parameter
                    { place: location },     // place parameter
                    { name: location }       // name parameter
                ];

                for (const params of paramVariants) {
                    try {
                        console.log(`🔍 Пробуем инструмент ${toolName} с параметрами:`, params);
                        const result = await executeMCPToolAPI(toolName, params);
                        console.log(`📊 Результат от ${toolName}:`, result);

                        // Проверяем различные форматы ответа
                        if (result) {
                            console.log(`🔍 Анализируем ответ от ${toolName}:`, JSON.stringify(result, null, 2));

                            // Если это успешный ответ с данными погоды - возвращаем их
                            if (hasWeatherData(result)) {
                                console.log(`✅ Найдены данные погоды в ответе ${toolName}!`);
                                return extractWeatherData(result);
                            }

                            // Если success: true - возвращаем result
                            if (result.success === true) {
                                console.log(`✅ Успешный ответ success: true от ${toolName}`);
                                const data = result.result || result;
                                if (hasWeatherData(data)) {
                                    return extractWeatherData(data);
                                }
                            }

                            // Если success: false но есть данные погоды
                            if (result.success === false && hasWeatherData(result)) {
                                console.log(`⚠️ Ответ success: false, но найдены данные погоды от ${toolName}`);
                                return extractWeatherData(result);
                            }

                            // Если success: false с ошибкой - пропускаем
                            if (result.success === false && result.error) {
                                console.log(`⚠️ Ошибка от ${toolName}: ${result.error}`);
                                continue;
                            }

                            // Если пришел просто объект без success/result - проверяем на данные погоды
                            if (typeof result === 'object' && !('success' in result) && !('result' in result)) {
                                if (hasWeatherData(result)) {
                                    console.log(`✅ Найдены данные погоды в объекте от ${toolName}`);
                                    return extractWeatherData(result);
                                }
                            }
                        } else {
                            console.log(`⚠️ Пустой ответ от ${toolName} с параметрами ${JSON.stringify(params)}`);
                        }
                    } catch (error) {
                        console.log(`❌ Параметры ${JSON.stringify(params)} не подошли для ${toolName}:`, error.message);
                    }
                }
            } catch (error) {
                console.log(`Инструмент ${toolName} не найден, пробуем следующий...`);
            }
        }

        // Если ни один инструмент не найден, возвращаем null
        return null;
    } catch (error) {
        console.error('Ошибка получения данных о погоде:', error);
        return null;
    }
}

/**
 * Генерация summary для напоминания с помощью AI и MCP данных
 */
async function generateReminderSummary(reminder) {
    console.log('🤖 Генерация уведомления для напоминания:', reminder.title, reminder.description);

    const lowerDescription = reminder.description.toLowerCase();

    // Проверяем, содержит ли описание запрос о погоде
    const weatherKeywords = ['погод', 'weather', 'температур', 'temperature', 'дожд', 'rain', 'снег', 'snow'];
    const hasWeatherKeyword = weatherKeywords.some(keyword => lowerDescription.includes(keyword));

    let weatherData = null;
    let location = null;

    if (hasWeatherKeyword) {
        // Извлекаем название локации из описания
        // Ищем паттерны типа "в Шерегеше", "in London", "погода в Москве", "weather for Paris"
        const locationPatterns = [
            /(?:в|во?|погод[ау]\s+в)\s+([А-Яа-яЁё][а-яё\s]*[а-яё])/i,  // русский: "в Шерегеше", "погода в Москве"
            /(?:at|in|for)\s+([A-Za-z][a-z\s]*[a-z])/i,               // английский: "in London", "for Paris"
            /(?:weather\s+(?:in|at|for)\s+)([A-Za-z][a-z\s]*[a-z])/i, // "weather in London"
        ];

        for (const pattern of locationPatterns) {
            const match = reminder.description.match(pattern);
            if (match && match[1]) {
                let rawLocation = match[1].trim();
                console.log(`🌤️ Найден сырой текст локации: "${rawLocation}"`);

                // Убираем лишние слова типа "городе", "районе" и т.д.
                location = rawLocation.replace(/^(городе?|районе?|области|крае?|регионе?|обл\.?|г\.?)\s+/i, '');
                console.log(`🌤️ Очищенная локация: "${location}"`);
                break;
            }
        }

        if (location) {
            console.log(`🌤️ Обнаружена погода в описании, извлекаем локацию: "${location}"`);
            weatherData = await getWeatherData(location);
            console.log(`🌤️ Результат получения погоды для "${location}":`, weatherData);
        } else {
            console.log(`🌤️ Обнаружена погода в описании, но не удалось извлечь локацию из: "${reminder.description}"`);
        }
    }

    let prompt = `Создай краткое информационное сообщение для напоминания "${reminder.title}".
    Описание напоминания: ${reminder.description}

    Создай полезное и актуальное сообщение на основе описания напоминания.
    Будь кратким, но информативным. Используй подходящие эмодзи.

    Примеры:
    - Для "погода в Шерегеше": "☀️ Сегодня в Шерегеше солнечно, температура +15°C, ветер слабый. Идеальная погода для катания!"
    - Для "новости технологий": "📰 Сегодня в мире технологий: Apple представила новые MacBook, Google улучшил поиск..."`;

    // Если есть данные о погоде, добавляем их в промпт
    if (weatherData) {
        prompt += `\n\nДОСТУПНЫЕ ДАННЫЕ О ПОГОДЕ для ${location}:\n${JSON.stringify(weatherData, null, 2)}\n\nИспользуй эти реальные данные для создания точного прогноза погоды!`;
    }

    // Если это погодное напоминание, но данных нет, добавляем инструкцию
    if (hasWeatherKeyword && !weatherData) {
        prompt += `\n\nЭто напоминание о погоде, но реальные данные временно недоступны. Создай правдоподобный прогноз на основе типичной погоды для этого региона.`;
    }

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7,
                max_tokens: 200
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('📡 Ответ от AI API:', data);

        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error('Некорректный формат ответа от AI API');
        }

        const content = data.choices[0].message.content;
        if (!content) {
            throw new Error('Пустой ответ от AI API');
        }

        console.log('📝 Содержимое ответа AI:', content.substring(0, 100) + '...');
        return content.trim();
    } catch (error) {
        console.error('Ошибка при генерации summary:', error);
        // Возвращаем базовое сообщение в случае ошибки
        return `📅 ${reminder.title}: ${reminder.description}`;
    }
}

/**
 * Запуск проверки напоминаний
 */
function startReminderChecker() {
    if (reminderInterval) {
        clearInterval(reminderInterval);
    }

    if (reminders.length > 0) {
        reminderInterval = setInterval(checkReminders, REMINDER_CHECK_INTERVAL);
        console.log('✅ Запущена проверка напоминаний, интервал:', REMINDER_CHECK_INTERVAL + 'мс');
        console.log('📋 Активные напоминания:', reminders.length);
    } else {
        console.log('⚠️ Нет активных напоминаний, проверка не запущена');
    }
}

/**
 * Остановка проверки напоминаний
 */
function stopReminderChecker() {
    if (reminderInterval) {
        clearInterval(reminderInterval);
        reminderInterval = null;
        console.log('Остановлена проверка напоминаний');
    }
}

/**
 * Сохранение напоминаний в localStorage
 */
function saveRemindersToStorage() {
    try {
        localStorage.setItem('goragent_reminders', JSON.stringify(reminders));
    } catch (error) {
        console.error('Ошибка сохранения напоминаний:', error);
    }
}

/**
 * Загрузка напоминаний из localStorage
 */
function loadRemindersFromStorage() {
    try {
        const saved = localStorage.getItem('goragent_reminders');
        if (saved) {
            const loadedReminders = JSON.parse(saved);

            // Валидация и фильтрация напоминаний
            reminders = loadedReminders.filter(reminder => {
                // Проверяем обязательные поля
                if (!reminder.id || !reminder.title || !reminder.description || !reminder.interval) {
                    console.warn('Удалено поврежденное напоминание:', reminder);
                    return false;
                }

                // Проверяем корректность интервала
                const validIntervals = ['every-minute', 'every-15-min', 'every-30-min', 'hourly', 'daily'];
                if (!validIntervals.includes(reminder.interval)) {
                    console.warn('Удалено напоминание с некорректным интервалом:', reminder);
                    return false;
                }

                // Проверяем корректность времени
                if (!reminder.nextTrigger || isNaN(reminder.nextTrigger)) {
                    console.warn('Удалено напоминание с некорректным временем:', reminder);
                    return false;
                }

                return true;
            });

            console.log(`Загружены напоминания: ${reminders.length} (отфильтровано: ${loadedReminders.length - reminders.length})`);
        }
    } catch (error) {
        console.error('Ошибка загрузки напоминаний:', error);
        reminders = [];
    }
}

/**
 * Сохранение истории уведомлений в localStorage
 */
function saveReminderNotificationsToStorage() {
    try {
        localStorage.setItem('goragent_reminder_notifications', JSON.stringify(reminderNotifications));
    } catch (error) {
        console.error('Ошибка сохранения уведомлений:', error);
    }
}

/**
 * Загрузка истории уведомлений из localStorage
 */
function loadReminderNotificationsFromStorage() {
    try {
        const saved = localStorage.getItem('goragent_reminder_notifications');
        if (saved) {
            reminderNotifications = JSON.parse(saved);
            console.log('Загружены уведомления:', reminderNotifications.length);
        }
    } catch (error) {
        console.error('Ошибка загрузки уведомлений:', error);
        reminderNotifications = [];
    }
}

/**
 * Показать историю уведомлений при загрузке чата
 */
function showReminderNotificationsOnLoad() {
    // Показываем последние 5 уведомлений при открытии чата
    const recentNotifications = reminderNotifications.slice(0, 5);

    if (recentNotifications.length > 0) {
        // Добавляем разделитель
        const separatorDiv = document.createElement('div');
        separatorDiv.className = 'notification-separator';
        separatorDiv.innerHTML = '<div class="separator-line"></div><span class="separator-text">📅 Последние напоминания</span><div class="separator-line"></div>';
        chatEl.appendChild(separatorDiv);

        // Добавляем уведомления
        for (const notification of recentNotifications.reverse()) {
            const messageDiv = createMessageElement({
                role: 'assistant',
                content: `🔔 **Напоминание:** ${notification.title}\n\n${notification.summary}`,
                timestamp: new Date(notification.timestamp).toISOString()
            });
            chatEl.appendChild(messageDiv);
        }

        // Прокручиваем к последнему сообщению
        setTimeout(() => {
            chatEl.scrollTop = chatEl.scrollHeight;
        }, 100);
    }
}

// Экспорт для использования из консоли
window.clearChat = clearChat;
window.compressHistory = compressHistory;
window.compressionStats = compressionStats;

/**
 * Распознавание запросов на создание напоминаний в тексте
 */
function parseReminderRequest(text) {
    const lowerText = text.toLowerCase();

    // Ключевые слова для распознавания
    const reminderKeywords = ['напоминай', 'напомни', 'напоминание', 'remind', 'reminder'];
    const intervalKeywords = {
        'every-minute': ['каждую минуту', 'каждые минуту', 'каждой минуты', 'every minute', 'per minute'],
        'every-15-min': ['каждые 15 минут', 'каждые четверть часа', 'каждые пятнадцать минут', 'every 15 minutes'],
        'every-30-min': ['каждые 30 минут', 'каждые полчаса', 'every 30 minutes'],
        'hourly': ['каждый час', 'ежечасно', 'hourly', 'every hour'],
        'daily': ['каждый день', 'ежедневно', 'каждое утро', 'каждый вечер', 'daily', 'every day']
    };

    // Проверяем, содержит ли текст ключевые слова для напоминаний
    const hasReminderKeyword = reminderKeywords.some(keyword => lowerText.includes(keyword));
    if (!hasReminderKeyword) return null;

    // Определяем интервал
    let detectedInterval = 'daily'; // По умолчанию ежедневно
    for (const [interval, keywords] of Object.entries(intervalKeywords)) {
        if (keywords.some(keyword => lowerText.includes(keyword))) {
            detectedInterval = interval;
            break;
        }
    }

    // Извлекаем описание напоминания
    let description = text;

    // Убираем слова типа "напоминай мне" в начале
    description = description.replace(/^(напоминай\s+мне|напомни\s+мне|создай\s+напоминание)\s+/i, '');

    // Убираем информацию об интервале из описания
    for (const keywords of Object.values(intervalKeywords)) {
        for (const keyword of keywords) {
            description = description.replace(new RegExp(keyword, 'gi'), '').trim();
        }
    }

    // Создаём название на основе описания (первые 30 символов)
    const title = description.length > 30 ? description.substring(0, 27) + '...' : description;

    return {
        title: title,
        description: description,
        interval: detectedInterval
    };
}

/**
 * Получение читаемого названия интервала
 */
function getIntervalLabel(interval) {
    const labels = {
        'every-minute': 'Каждую минуту',
        'every-15-min': 'Каждые 15 минут',
        'every-30-min': 'Каждые 30 минут',
        'hourly': 'Каждый час',
        'daily': 'Ежедневно'
    };
    return labels[interval] || interval;
}

// Функция для полного сканирования localStorage на предмет напоминаний
window.scanAllLocalStorage = () => {
    console.log('🔍 Полное сканирование localStorage на предмет напоминаний...');

    const allKeys = Object.keys(localStorage);
    console.log('Все ключи в localStorage:', allKeys);

    const reminderKeys = allKeys.filter(key =>
        key.includes('reminder') ||
        key.includes('goragent') ||
        key.includes('remind')
    );

    console.log('Ключи, связанные с напоминаниями:', reminderKeys);

    reminderKeys.forEach(key => {
        try {
            const value = localStorage.getItem(key);
            console.log(`\n🔑 Ключ: ${key}`);
            console.log(`📄 Значение: ${value}`);

            if (value) {
                try {
                    const parsed = JSON.parse(value);
                    console.log(`📊 Распарсено:`, parsed);

                    if (Array.isArray(parsed)) {
                        console.log(`📋 Массив из ${parsed.length} элементов`);
                        parsed.forEach((item, i) => {
                            if (item && typeof item === 'object') {
                                console.log(`  ${i+1}. ${item.title || item.id || 'без названия'} (${item.interval || 'без интервала'})`);
                            }
                        });
                    }
                } catch (parseError) {
                    console.log(`❌ Не JSON: ${parseError.message}`);
                }
            }
        } catch (error) {
            console.error(`💥 Ошибка чтения ключа ${key}:`, error);
        }
    });

    return reminderKeys;
};

// Функция для просмотра всех данных напоминаний в localStorage
window.inspectReminderStorage = () => {
    console.log('🔍 Проверка данных напоминаний в localStorage...');

    try {
        const remindersData = localStorage.getItem('goragent_reminders');
        const notificationsData = localStorage.getItem('goragent_reminder_notifications');

        console.log('Raw reminders data:', remindersData);
        console.log('Raw notifications data:', notificationsData);

        if (remindersData) {
            const parsed = JSON.parse(remindersData);
            console.log('Parsed reminders:', parsed);
            console.log('Reminders in memory:', reminders);
        }

        if (notificationsData) {
            const parsed = JSON.parse(notificationsData);
            console.log('Parsed notifications:', parsed);
            console.log('Notifications in memory:', reminderNotifications);
        }
    } catch (error) {
        console.error('Ошибка при проверке localStorage:', error);
    }
};

// Функция для принудительной очистки всех данных напоминаний
window.forceClearAllReminderData = () => {
    console.log('💥 Принудительная очистка всех данных напоминаний...');

    if (confirm('Это удалит ВСЕ данные напоминаний из localStorage и памяти. Продолжить?')) {
        // Остановить все процессы
        stopReminderChecker();

        // Очистить память
        reminders = [];
        reminderNotifications = [];
        pendingMinuteReminder = null;

        // Очистить localStorage - основные ключи
        localStorage.removeItem('goragent_reminders');
        localStorage.removeItem('goragent_reminder_notifications');

        // Обновить UI
        updateRemindersUI();

        console.log('✅ Все данные напоминаний принудительно очищены');
        addMessage('💥 Все данные напоминаний принудительно очищены', 'info');
    }
};

// Функция для полного уничтожения всех данных напоминаний (включая старые ключи)
window.nukeAllReminders = () => {
    console.log('💣 ПОЛНОЕ УНИЧТОЖЕНИЕ всех данных напоминаний...');

    if (confirm('Это удалит ВСЕ ключи, связанные с напоминаниями, из localStorage и памяти. Это действие необратимо! Продолжить?')) {
        // Остановить все процессы
        stopReminderChecker();

        // Очистить все возможные интервалы
        for (let i = 1; i < 10000; i++) {
            clearInterval(i);
            clearTimeout(i);
        }

        // Очистить память
        reminders = [];
        reminderNotifications = [];
        pendingMinuteReminder = null;

        // Найти и удалить все ключи, связанные с напоминаниями
        const allKeys = Object.keys(localStorage);
        const reminderRelatedKeys = allKeys.filter(key =>
            key.includes('reminder') ||
            key.includes('remind') ||
            key.includes('goragent') ||
            key.includes('notification') ||
            key.includes('alarm') ||
            key.includes('timer')
        );

        console.log('Найдены связанные ключи для удаления:', reminderRelatedKeys);

        reminderRelatedKeys.forEach(key => {
            localStorage.removeItem(key);
            console.log(`🗑️ Удален ключ: ${key}`);
        });

        // Также очистить любые другие потенциальные ключи
        const potentialKeys = [
            'goragent_reminders',
            'goragent_reminder_notifications',
            'reminders',
            'reminder_data',
            'reminder_storage',
            'alarm_data',
            'timer_data'
        ];

        potentialKeys.forEach(key => {
            if (localStorage.getItem(key)) {
                localStorage.removeItem(key);
                console.log(`🗑️ Удален дополнительный ключ: ${key}`);
            }
        });

        // Обновить UI
        updateRemindersUI();

        console.log('💣 ПОЛНОЕ УНИЧТОЖЕНИЕ ЗАВЕРШЕНО');
        console.log(`Удалено ${reminderRelatedKeys.length} связанных ключей`);

        addMessage('💣 Все данные напоминаний полностью уничтожены', 'info');
    }
};

// Функция для полной остановки всех процессов напоминаний
window.stopAllReminders = () => {
    console.log('🛑 Полная остановка всех процессов напоминаний...');

    // Остановить основной интервал проверки
    stopReminderChecker();

    // Остановить все возможные интервалы (на случай утечек)
    for (let i = 1; i < 10000; i++) {
        clearInterval(i);
        clearTimeout(i);
    }

    // Очистить все напоминания
    reminders = [];
    reminderNotifications = [];
    pendingMinuteReminder = null;

    // Очистить localStorage
    saveRemindersToStorage();
    saveReminderNotificationsToStorage();

    // Обновить UI
    updateRemindersUI();

    console.log('✅ Все процессы напоминаний остановлены, все интервалы очищены');
    addMessage('🛑 Все напоминания и автоматические процессы остановлены', 'info');
};

// Экспорт функций напоминаний
window.createReminder = createReminder;
window.deleteReminder = deleteReminder;
window.clearAllReminders = clearAllReminders;
window.stopAllReminders = stopAllReminders;
window.forceClearAllReminderData = forceClearAllReminderData;
window.nukeAllReminders = nukeAllReminders;
window.scanAllLocalStorage = scanAllLocalStorage;
window.inspectReminderStorage = inspectReminderStorage;
window.getActiveReminders = getActiveReminders;
window.parseReminderRequest = parseReminderRequest;

// Отладочные функции
window.checkRemindersNow = checkReminders;
window.showReminderDebug = () => {
    console.log('📊 Отладка напоминаний:');
    console.log('Всего напоминаний в памяти:', reminders.length);
    console.log('Интервал проверки активен:', !!reminderInterval);
    console.log('ID интервала:', reminderInterval);
    console.log('Ожидает подтверждения минутного напоминания:', !!pendingMinuteReminder);

    // Проверить localStorage
    try {
        const storageData = localStorage.getItem('goragent_reminders');
        if (storageData) {
            const parsed = JSON.parse(storageData);
            console.log('Напоминаний в localStorage:', parsed.length);
            if (parsed.length !== reminders.length) {
                console.warn('⚠️ Несоответствие: в localStorage', parsed.length, 'в памяти', reminders.length);
            }
        } else {
            console.log('localStorage пуст');
        }
    } catch (error) {
        console.error('Ошибка чтения localStorage:', error);
    }

    if (reminders.length > 0) {
        console.log('Список напоминаний в памяти:');
        reminders.forEach((r, i) => {
            const nextTime = new Date(r.nextTrigger);
            const isPast = r.nextTrigger < Date.now();
            console.log(`${i+1}. "${r.title}" (${r.interval}) - ${isPast ? 'ПРОСРОЧЕНО' : 'активно'} - следующее: ${nextTime.toLocaleString()}`);
        });
    } else {
        console.log('Активных напоминаний в памяти нет');
    }
};

// Тестовая функция для проверки MCP
window.testMCPWeather = async (city) => {
    console.log(`🧪 Тестируем получение погоды для города: ${city}`);
    try {
        const result = await getWeatherData(city);
        console.log('Результат:', result);
        return result;
    } catch (error) {
        console.error('Ошибка:', error);
    }
};

// Тестовая функция для проверки MCP инструментов напрямую
window.testMCPTool = async (toolName, params) => {
    console.log(`🧪 Тестируем инструмент ${toolName} с параметрами:`, params);
    try {
        const result = await executeMCPToolAPI(toolName, params);
        console.log('Результат:', result);
        return result;
    } catch (error) {
        console.error('Ошибка:', error);
    }
};

// Специальная функция для тестирования get_weather с city параметром
window.testWeatherCity = async (city) => {
    console.log(`🌤️ Тестируем get_weather для города: ${city} с параметром city`);
    try {
        const result = await testMCPTool('get_weather', { city: city });
        console.log('Результат для города', city, ':', result);

        // Пробуем обработать результат как в основном коде
        if (result) {
            console.log('🔍 Анализируем результат...');

            if (result.success === true) {
                console.log('✅ success: true - данные получены');
                return result.result || result;
            }

            if (result.temperature !== undefined || result.weather !== undefined ||
                result.description !== undefined || result.temp !== undefined) {
                console.log('✅ Найдены поля погоды напрямую');
                return result;
            }

            console.log('⚠️ Данные не распознаны в стандартном формате');
        }

        return result;
    } catch (error) {
        console.error('Ошибка тестирования:', error);
    }
};

// Функция для тестирования извлечения города из текста
window.testCityExtraction = (text) => {
    console.log(`🧪 Тестируем извлечение города из текста: "${text}"`);

    // Извлекаем название локации из описания (копия логики из generateReminderSummary)
    const locationPatterns = [
        /(?:в|во?|погод[ау]\s+в)\s+([А-Яа-яЁё][а-яё\s]*[а-яё])/i,  // русский: "в Шерегеше", "погода в Москве"
        /(?:at|in|for)\s+([A-Za-z][a-z\s]*[a-z])/i,               // английский: "in London", "for Paris"
        /(?:weather\s+(?:in|at|for)\s+)([A-Za-z][a-z\s]*[a-z])/i, // "weather in London"
    ];

    let location = null;
    for (const pattern of locationPatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
            let rawLocation = match[1].trim();
            console.log(`📍 Найден сырой текст: "${rawLocation}"`);

            // Убираем лишние слова типа "городе", "районе" и т.д.
            location = rawLocation.replace(/^(городе?|районе?|области|крае?|регионе?|обл\.?|г\.?)\s+/i, '');
            console.log(`✅ Очищенная локация: "${location}"`);
            break;
        }
    }

    if (!location) {
        console.log('❌ Не удалось извлечь название города');
    }

    return location;
};

// Тестовая функция для создания тестового уведомления
window.testReminderNotification = (title = 'Тестовое напоминание', summary = 'Это тестовое уведомление о напоминании') => {
    console.log('🧪 Создание тестового уведомления в чате');

    const testReminder = {
        id: 'test_reminder',
        title: title,
        description: 'Тестовое описание'
    };

    addReminderNotification(testReminder, summary);
    console.log('✅ Тестовое уведомление добавлено в чат');
};

// Тестовая функция для принудительного обновления UI напоминаний
window.forceUpdateRemindersUI = () => {
    console.log('🔄 Принудительное обновление UI напоминаний');
    updateRemindersUI();
    console.log('✅ UI обновлено');
};

// Тестовая функция для создания тестового напоминания и проверки UI
window.testCreateReminderUI = (title = 'Тестовое напоминание', interval = 'every-15-min') => {
    console.log('🧪 Создание тестового напоминания и проверка UI');

    const reminder = createReminder(title, `Тестовое напоминание "${title}"`, interval);
    console.log('📝 Напоминание создано:', reminder);

    // Принудительное обновление UI
    setTimeout(() => {
        console.log('🔄 Обновление UI через 1 секунду...');
        updateRemindersUI();
    }, 1000);

    return reminder;
};

// Функция для тестирования погоды с выводом полного ответа MCP
window.testWeatherRaw = async (city) => {
    console.log(`🧪 Тестируем получение погоды для "${city}" с выводом полного ответа MCP`);

    try {
        const response = await fetch('/api/mcp/execute', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                toolName: 'get_weather',
                arguments: { city: city }
            })
        });

        const data = await response.json();
        console.log('📡 Полный ответ от MCP сервера:');
        console.log(JSON.stringify(data, null, 2));

        if (data.result) {
            console.log('📊 Данные result:');
            console.log(JSON.stringify(data.result, null, 2));

            // Проверяем, есть ли данные погоды
            if (hasWeatherData(data.result)) {
                console.log('✅ Данные содержат информацию о погоде!');
                console.log('Погода будет показана пользователю');
            } else {
                console.log('⚠️ Данные не распознаны как погода');
            }
        } else {
            console.log('❌ Нет поля result в ответе');
        }

        return data;
    } catch (error) {
        console.error('Ошибка тестирования:', error);
    }
};

