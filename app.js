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

// ===== История сообщений =====
let conversationHistory = [];
let isWaitingForResponse = false;

// ===== Инициализация =====
document.addEventListener('DOMContentLoaded', () => {
    // Установить название модели
    if (modelNameEl) {
        modelNameEl.textContent = MODEL_NAME;
    }
    
    // Загрузить историю из localStorage
    loadConversationFromStorage();
    
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

// ===== Функции =====

/**
 * Показать приветственное сообщение
 */
function showWelcomeMessage() {
    const welcomeText = `Привет! 👋 Я **GorAgent** — ИИ-ассистент на базе модели \`${MODEL_NAME}\`.

Я могу помочь вам с:
• Ответами на вопросы
• Написанием и анализом кода
• Объяснением сложных концепций
• Творческими задачами

Задайте мне любой вопрос!`;
    
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
        // Формируем запрос
        const requestBody = {
            message,
            history: conversationHistory.slice(-20) // Последние 20 сообщений для контекста
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

