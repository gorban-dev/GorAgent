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
    
    // Если история пуста, показать приветственное сообщение
    if (conversationHistory.length === 0) {
        showWelcomeMessage();
    } else {
        // Восстановить сообщения из истории
        restoreMessagesFromHistory();
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

// Экспорт для использования из консоли
window.clearChat = clearChat;
window.compressHistory = compressHistory;
window.compressionStats = compressionStats;

