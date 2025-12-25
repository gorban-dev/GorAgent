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

async function testRAG(question, compareMode = true, compareThreshold = false, similarityThreshold = 0.7) {
    console.log('\n' + '─'.repeat(60));
    console.log(`ВОПРОС: ${question}`);
    console.log(`Порог релевантности: ${similarityThreshold} (${(similarityThreshold * 100).toFixed(0)}%)`);
    console.log('─'.repeat(60));

    try {
        const response = await fetch(`${API_BASE}/api/document-indexer/rag`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question,
                topK: 3,
                compareMode,
                compareThreshold,
                similarityThreshold,
                provider: 'openai'
            })
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error);
        }

        console.log('\n🤖 ОТВЕТ С RAG (с фильтром):');
        console.log(data.rag.answer);

        if (compareThreshold && data.ragNoFilter) {
            console.log('\n⚠️ ОТВЕТ С RAG (без фильтра):');
            console.log(data.ragNoFilter.answer);
        }

        if (compareMode && data.noRag) {
            console.log('\n💭 ОТВЕТ БЕЗ RAG:');
            console.log(data.noRag.answer);
        }

        console.log('\n📊 МЕТРИКИ:');
        console.log(`  Найдено чанков: ${data.rag.totalFound}`);
        console.log(`  После фильтра (≥${(similarityThreshold * 100).toFixed(0)}%): ${data.rag.afterFilter}`);
        console.log(`  Отфильтровано: ${data.rag.totalFound - data.rag.afterFilter}`);
        console.log(`  Размер контекста: ${data.rag.contextLength} символов`);
        console.log(`  Время выполнения: ${data.metadata.totalTime}ms`);

        console.log('\n📚 РЕЛЕВАНТНЫЕ ЧАНКИ:');
        data.rag.chunks.forEach((chunk, i) => {
            const quality = chunk.similarity >= 0.8 ? '✅ Высокая' : 
                           chunk.similarity >= 0.7 ? '🟡 Средняя' : '⚠️ Низкая';
            console.log(`  ${i + 1}. ${chunk.document} (${(chunk.similarity * 100).toFixed(1)}% - ${quality})`);
            console.log(`     ${chunk.text.substring(0, 100)}...`);
        });

        // Анализ фильтрации
        if (data.rag.totalFound > data.rag.afterFilter) {
            console.log('\n🎯 АНАЛИЗ ФИЛЬТРАЦИИ:');
            console.log(`  ✅ Отфильтровано ${data.rag.totalFound - data.rag.afterFilter} нерелевантных чанков`);
            
            const avgSimilarity = data.rag.chunks.reduce((sum, c) => sum + c.similarity, 0) / data.rag.chunks.length;
            console.log(`  📈 Средняя релевантность: ${(avgSimilarity * 100).toFixed(1)}%`);
            
            if (avgSimilarity >= 0.8) {
                console.log('  ✅ Используются только высококачественные чанки');
            }
        } else {
            console.log('\n📊 Все найденные чанки прошли фильтр релевантности');
        }

        return data;

    } catch (error) {
        console.error('\n❌ ОШИБКА:', error.message);
        return null;
    }
}

async function runTests() {
    console.log('\n' + '='.repeat(60));
    console.log('RAG С ФИЛЬТРАЦИЕЙ — ТЕСТИРОВАНИЕ');
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

    // Тест 1: Стандартный RAG с фильтрацией
    console.log('\n' + '='.repeat(60));
    console.log('ТЕСТ 1: RAG с фильтром (порог 0.7)');
    console.log('='.repeat(60));
    await testRAG(testQuestions[0].question, false, false, 0.7);
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Тест 2: Сравнение С фильтром vs БЕЗ фильтра
    console.log('\n' + '='.repeat(60));
    console.log('ТЕСТ 2: Сравнение - С фильтром vs БЕЗ фильтра');
    console.log('='.repeat(60));
    await testRAG(testQuestions[1].question, false, true, 0.7);
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Тест 3: Высокий порог (только топовые результаты)
    console.log('\n' + '='.repeat(60));
    console.log('ТЕСТ 3: Высокий порог фильтрации (0.85)');
    console.log('='.repeat(60));
    await testRAG(testQuestions[2].question, false, false, 0.85);
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Тест 4: Низкий порог (больше результатов)
    console.log('\n' + '='.repeat(60));
    console.log('ТЕСТ 4: Низкий порог фильтрации (0.5)');
    console.log('='.repeat(60));
    await testRAG(testQuestions[0].question, false, false, 0.5);

    console.log('\n' + '='.repeat(60));
    console.log('✅ ТЕСТИРОВАНИЕ ЗАВЕРШЕНО');
    console.log('='.repeat(60));
    console.log('\n💡 Выводы:');
    console.log('   1. Фильтрация отсеивает нерелевантные чанки');
    console.log('   2. Порог 0.7-0.8 оптимален для большинства случаев');
    console.log('   3. Высокий порог (0.85+) = только топовые результаты');
    console.log('   4. Низкий порог (0.5-0.6) = больше контекста, но с шумом');
    console.log('\n🌐 Откройте веб-интерфейс для визуального сравнения:');
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

