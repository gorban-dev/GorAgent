/**
 * GorAgent — ИИ Чат на базе OpenAI API
 * Фронтенд логика
 */

// ===== Конфигурация =====
const MODEL_NAME = 'gpt-4.1-mini';
const API_ENDPOINT = '/api/chat';
const MAX_MESSAGE_LENGTH = 3000;

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

// Пользовательские пресеты (загружаются из localStorage)
let customPresets = {};

// DOM элементы для пользовательских пресетов
const newPresetNameInput = document.getElementById('new-preset-name');
const savePresetBtn = document.getElementById('save-preset-btn');
const customPresetsSection = document.getElementById('custom-presets-section');
const customPresetsContainer = document.getElementById('custom-presets');

// ===== Инициализация =====
document.addEventListener('DOMContentLoaded', () => {
    // Установить название модели
    if (modelNameEl) {
        modelNameEl.textContent = MODEL_NAME;
    }
    
    // Загрузить историю из localStorage
    loadConversationFromStorage();
    
    // Загрузить сохранённый System Prompt
    loadSystemPromptFromStorage();
    
    // Загрузить пользовательские пресеты
    loadCustomPresets();
    
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
        
        // Обновляем UI слайдера
        const slider = document.getElementById('temperature-slider');
        const valueDisplay = document.getElementById('temperature-value');
        if (slider) slider.value = currentTemperature;
        if (valueDisplay) valueDisplay.textContent = currentTemperature.toFixed(1);
        
        console.log('Загруженный temperature:', currentTemperature);
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
    
    // Установить текущее значение temperature
    const slider = document.getElementById('temperature-slider');
    const valueDisplay = document.getElementById('temperature-value');
    if (slider) slider.value = currentTemperature;
    if (valueDisplay) valueDisplay.textContent = currentTemperature.toFixed(1);
    
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
    const newTemperature = slider ? parseFloat(slider.value) : currentTemperature;
    
    console.log('Слайдер найден:', !!slider);
    console.log('Значение слайдера:', slider?.value);
    console.log('Новый temperature:', newTemperature);
    
    if (newPrompt) {
        currentSystemPrompt = newPrompt;
        currentPresetName = selectedPresetName;
        currentTemperature = newTemperature;
        updatePromptStatus();
        
        // Сохраняем temperature
        localStorage.setItem('goragent_temperature', currentTemperature.toString());
        
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
        console.log('Новый System Prompt:');
        console.log(currentSystemPrompt);
        console.log('%c═══════════════════════════════════════════════════════', 'color: #FF9800');
        
        // Показать уведомление
        addMessage(`✅ **Настройки обновлены!**\n\nРежим: **${currentPresetName}**\nTemperature: **${currentTemperature}**\n\n🔄 История чата очищена. Начните новый диалог!`, 'agent');
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
    // Экранировать HTML
    let formatted = text
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
    
    // Переносы строк
    formatted = formatted.replace(/\n/g, '<br>');
    
    return formatted;
}

/**
 * Отправка запроса к API
 */
async function sendToApi(message) {
    isWaitingForResponse = true;
    setUILoading(true);
    
    try {
        // Формируем запрос с System Prompt и Temperature
        console.log('Отправляем temperature:', currentTemperature);
        const requestBody = {
            message,
            history: conversationHistory.slice(-20), // Последние 20 сообщений для контекста
            systemPrompt: currentSystemPrompt, // Передаём текущий System Prompt
            temperature: currentTemperature // Передаём текущий Temperature
        };
        
        // Логируем запрос в консоль браузера
        console.log('%c═══════════════════════════════════════════════════════', 'color: #4CAF50');
        console.log('%c📤 ЗАПРОС К СЕРВЕРУ', 'color: #4CAF50; font-weight: bold; font-size: 14px');
        console.log('%c═══════════════════════════════════════════════════════', 'color: #4CAF50');
        console.log('Структура запроса:');
        console.log(requestBody);
        console.log('%c───────────────────────────────────────────────────────', 'color: #4CAF50');
        
        const response = await fetch(API_ENDPOINT, {
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
        
        // Логируем ответ в консоль браузера
        console.log('%c═══════════════════════════════════════════════════════', 'color: #2196F3');
        console.log('%c📥 ОТВЕТ ОТ СЕРВЕРА', 'color: #2196F3; font-weight: bold; font-size: 14px');
        console.log('%c═══════════════════════════════════════════════════════', 'color: #2196F3');
        console.log('Сырой JSON ответ:');
        console.log(data);
        console.log('%c───────────────────────────────────────────────────────', 'color: #2196F3');
        console.log('Распарсенные поля:');
        console.log('  message:', data.message);
        console.log('  answer:', data.answer);
        console.log('%c═══════════════════════════════════════════════════════', 'color: #2196F3');
        
        // Ответ приходит в формате { message: "...", answer: "..." }
        const agentReply = data.answer || data.reply || 'Не удалось получить ответ.';
        
        // Форматируем JSON для красивого отображения
        const jsonString = JSON.stringify(data, null, 2);
        
        // Показываем сырой JSON ответ
        const jsonMessage = `**Ответ в формате JSON:**\n\`\`\`json\n${jsonString}\n\`\`\`\n\n**Человекочитаемый ответ на сообщение:**\n${agentReply}`;
        
        // Добавить ответ агента
        addMessage(jsonMessage, 'agent');
        conversationHistory.push({ role: 'assistant', content: agentReply });
        
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
    localStorage.removeItem('goragent_history');
    localStorage.removeItem('goragent_conversation');
    showWelcomeMessage();
}

// Экспорт для использования из консоли
window.clearChat = clearChat;

