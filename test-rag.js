/**
 * Тестовый скрипт для RAG функционала
 * Использование: node test-rag.js
 */

const API_BASE = 'http://localhost:3000';

// Тестовые вопросы
const testQuestions = [
    {
        question: 'Что такое машинное обучение с учителем?',
        expectedKeywords: ['supervised', 'размеченных', 'классификация']
    },
    {
        question: 'Какие популярные модели эмбеддингов существуют?',
        expectedKeywords: ['word2vec', 'bert', 'glove', 'fasttext']
    },
    {
        question: 'Что такое нейронные сети?',
        expectedKeywords: ['neural', 'neurons', 'layers', 'слои']
    }
];

async function testRAG(question, compareMode = true) {
    console.log('\n' + '─'.repeat(60));
    console.log(`ВОПРОС: ${question}`);
    console.log('─'.repeat(60));

    try {
        const response = await fetch(`${API_BASE}/api/document-indexer/rag`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question,
                topK: 3,
                compareMode,
                provider: 'openai'
            })
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error);
        }

        console.log('\n🤖 ОТВЕТ С RAG:');
        console.log(data.rag.answer);

        if (compareMode && data.noRag) {
            console.log('\n💭 ОТВЕТ БЕЗ RAG:');
            console.log(data.noRag.answer);
        }

        console.log('\n📊 МЕТРИКИ:');
        console.log(`  Использовано чанков: ${data.rag.chunks.length}`);
        console.log(`  Размер контекста: ${data.rag.contextLength} символов`);
        console.log(`  Время выполнения: ${data.metadata.totalTime}ms`);
        console.log(`  Токенов: ${data.rag.tokens?.total_tokens || 'N/A'}`);

        console.log('\n📚 РЕЛЕВАНТНЫЕ ЧАНКИ:');
        data.rag.chunks.forEach((chunk, i) => {
            console.log(`  ${i + 1}. ${chunk.document} (${(chunk.similarity * 100).toFixed(1)}%)`);
            console.log(`     ${chunk.text.substring(0, 100)}...`);
        });

        // Анализ результатов
        if (compareMode && data.noRag) {
            console.log('\n📈 АНАЛИЗ:');
            
            const ragLength = data.rag.answer.length;
            const noRagLength = data.noRag.answer.length;
            
            console.log(`  Длина ответа с RAG: ${ragLength} символов`);
            console.log(`  Длина ответа без RAG: ${noRagLength} символов`);
            console.log(`  Разница: ${Math.abs(ragLength - noRagLength)} символов`);
            
            if (ragLength > noRagLength * 1.2) {
                console.log('  ✅ RAG дал более детальный ответ');
            } else if (ragLength < noRagLength * 0.8) {
                console.log('  ⚠️ RAG дал более краткий ответ');
            } else {
                console.log('  📊 Ответы схожи по длине');
            }
        }

        return data;

    } catch (error) {
        console.error('\n❌ ОШИБКА:', error.message);
        return null;
    }
}

async function runTests() {
    console.log('\n' + '='.repeat(60));
    console.log('RAG ФУНКЦИОНАЛ — ТЕСТИРОВАНИЕ');
    console.log('='.repeat(60));

    // Проверяем наличие документов в индексе
    try {
        const statsResponse = await fetch(`${API_BASE}/api/document-indexer/stats`);
        const stats = await statsResponse.json();
        
        console.log('\n📊 Статистика индекса:');
        console.log(`  Документов: ${stats.totalDocuments}`);
        console.log(`  Чанков: ${stats.totalChunks}`);

        if (stats.totalDocuments === 0) {
            console.log('\n⚠️ Индекс пуст! Сначала добавьте документы.');
            console.log('   Запустите: npm run test:indexer');
            return;
        }

    } catch (error) {
        console.error('\n❌ Не удалось подключиться к серверу');
        console.error('   Убедитесь что сервер запущен: npm start');
        return;
    }

    // Запускаем тесты
    for (const test of testQuestions) {
        await testRAG(test.question, true);
        
        // Небольшая задержка между запросами
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ ТЕСТИРОВАНИЕ ЗАВЕРШЕНО');
    console.log('='.repeat(60));
    console.log('\n💡 Откройте веб-интерфейс для визуального сравнения:');
    console.log('   http://localhost:3000/document-index-demo');
    console.log('\n');
}

// Запуск тестов
if (require.main === module) {
    runTests().catch(error => {
        console.error('Критическая ошибка:', error);
        process.exit(1);
    });
}

module.exports = { testRAG };

