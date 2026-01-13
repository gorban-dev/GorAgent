/**
 * Тестовый скрипт для Document Indexer
 * Использование: node test-document-indexer.js
 */

const DocumentIndexer = require('./document-indexer');

// Примеры документов для тестирования
const sampleDocuments = [
    {
        content: `# Введение в машинное обучение

Машинное обучение (Machine Learning, ML) — это подраздел искусственного интеллекта, который изучает алгоритмы и статистические модели, позволяющие компьютерам выполнять задачи без явных инструкций.

## Типы машинного обучения

### 1. Обучение с учителем (Supervised Learning)
Модель обучается на размеченных данных, где каждый пример имеет входные данные и ожидаемый выход.

Примеры применения:
- Классификация изображений
- Распознавание речи
- Прогнозирование цен

### 2. Обучение без учителя (Unsupervised Learning)
Модель находит паттерны в неразмеченных данных.

Примеры применения:
- Кластеризация клиентов
- Обнаружение аномалий
- Сжатие данных

### 3. Обучение с подкреплением (Reinforcement Learning)
Модель учится через взаимодействие со средой, получая награды за правильные действия.

Примеры применения:
- Игровые AI
- Робототехника
- Автономные транспортные средства`,
        metadata: {
            name: 'ML-Introduction.md',
            type: 'markdown',
            category: 'education'
        }
    },
    {
        content: `# Эмбеддинги в NLP

Эмбеддинги — это векторное представление слов, предложений или документов в многомерном пространстве. Они позволяют моделям машинного обучения работать с текстом, преобразуя его в числовые векторы.

## История развития эмбеддингов

### Word2Vec (2013)
Первая популярная модель для создания word embeddings. Использует два подхода:
- CBOW (Continuous Bag of Words) - предсказывает слово по контексту
- Skip-gram - предсказывает контекст по слову

### GloVe (2014)
Global Vectors for Word Representation. Эмбеддинги на основе глобальной статистики совместной встречаемости слов.

### FastText (2016)
Расширение Word2Vec, которое учитывает морфологию слов. Разбивает слова на n-граммы.

### BERT (2018)
Bidirectional Encoder Representations from Transformers. Контекстные эмбеддинги, которые учитывают окружение слова.

### OpenAI Embeddings (2022)
Современные эмбеддинги для различных задач:
- text-embedding-ada-002
- text-embedding-3-small
- text-embedding-3-large

## Применение эмбеддингов

1. **Семантический поиск** - поиск по смыслу, а не по ключевым словам
2. **Кластеризация документов** - группировка похожих текстов
3. **Рекомендательные системы** - рекомендации на основе сходства
4. **Классификация текста** - определение категории текста
5. **RAG (Retrieval-Augmented Generation)** - улучшение ответов LLM контекстом

## Метрики сходства

Для сравнения эмбеддингов используют:
- **Косинусное сходство** - угол между векторами
- **Евклидово расстояние** - расстояние в пространстве
- **Скалярное произведение** - прямое произведение векторов`,
        metadata: {
            name: 'Embeddings-Guide.md',
            type: 'markdown',
            category: 'nlp'
        }
    },
    {
        content: `# Neural Networks Basics

Neural networks are computing systems inspired by biological neural networks. They consist of interconnected nodes (neurons) organized in layers.

## Architecture

### Input Layer
Receives the initial data for processing.

### Hidden Layers
Intermediate layers that transform the input into something that the output layer can use.

### Output Layer
Produces the final prediction or classification.

## Activation Functions

Common activation functions:
- **ReLU** (Rectified Linear Unit): f(x) = max(0, x)
- **Sigmoid**: f(x) = 1 / (1 + e^(-x))
- **Tanh**: f(x) = (e^x - e^(-x)) / (e^x + e^(-x))
- **Softmax**: Used for multi-class classification

## Training Process

1. **Forward Propagation**: Input data flows through the network
2. **Loss Calculation**: Compare prediction with actual value
3. **Backpropagation**: Calculate gradients of the loss
4. **Weight Update**: Adjust weights using optimization algorithm

## Common Architectures

- **CNN** (Convolutional Neural Networks) - for images
- **RNN** (Recurrent Neural Networks) - for sequences
- **LSTM** (Long Short-Term Memory) - improved RNN
- **Transformer** - attention-based architecture`,
        metadata: {
            name: 'Neural-Networks-Basics.md',
            type: 'markdown',
            category: 'deep-learning'
        }
    }
];

async function runTests() {
    console.log('\n' + '='.repeat(60));
    console.log('DOCUMENT INDEXER — ТЕСТИРОВАНИЕ');
    console.log('='.repeat(60) + '\n');

    // Создаем экземпляр indexer
    const indexer = new DocumentIndexer({
        chunkSize: 300,  // Меньший размер для тестирования
        chunkOverlap: 30,
        indexPath: './test-document-index.json'
    });

    console.log('📋 Настройки:');
    console.log(`  Размер чанка: ${indexer.chunkSize} токенов`);
    console.log(`  Перекрытие: ${indexer.chunkOverlap} токенов`);
    console.log(`  Модель эмбеддингов: ${indexer.model}\n`);

    try {
        // Тест 1: Обработка документов
        console.log('\n' + '─'.repeat(60));
        console.log('ТЕСТ 1: Обработка документов');
        console.log('─'.repeat(60));

        for (const doc of sampleDocuments) {
            console.log(`\n📄 Обработка: ${doc.metadata.name}`);
            const result = await indexer.processDocument(doc.content, doc.metadata);
            console.log(`✅ Создано ${result.chunks.length} чанков, использовано ${result.totalTokens} токенов`);
        }

        // Тест 2: Статистика
        console.log('\n' + '─'.repeat(60));
        console.log('ТЕСТ 2: Статистика индекса');
        console.log('─'.repeat(60));

        const stats = indexer.getStats();
        console.log('\n📊 Статистика:');
        console.log(`  Документов: ${stats.totalDocuments}`);
        console.log(`  Чанков: ${stats.totalChunks}`);
        console.log(`  Средний размер чанка: ${stats.avgChunkSize} токенов`);
        console.log(`  Размер индекса: ${(stats.indexSize / 1024).toFixed(2)} KB`);

        // Тест 3: Сохранение индекса
        console.log('\n' + '─'.repeat(60));
        console.log('ТЕСТ 3: Сохранение индекса');
        console.log('─'.repeat(60));

        const saveResult = await indexer.saveIndex();
        console.log(`\n💾 Индекс сохранен: ${saveResult.path}`);
        console.log(`  Размер файла: ${(saveResult.size / 1024).toFixed(2)} KB`);

        // Тест 4: Семантический поиск
        console.log('\n' + '─'.repeat(60));
        console.log('ТЕСТ 4: Семантический поиск');
        console.log('─'.repeat(60));

        const queries = [
            'что такое машинное обучение',
            'как работают нейронные сети',
            'векторное представление слов',
            'supervised learning examples'
        ];

        for (const query of queries) {
            console.log(`\n🔍 Запрос: "${query}"`);
            const searchResult = await indexer.search(query, 3);
            
            console.log(`📊 Найдено ${searchResult.results.length} результатов:\n`);
            
            searchResult.results.forEach((result, i) => {
                console.log(`  ${i + 1}. Документ: ${result.chunk.metadata.documentName}`);
                console.log(`     Сходство: ${(result.similarity * 100).toFixed(1)}%`);
                console.log(`     Текст: ${result.chunk.text.substring(0, 100)}...`);
                console.log('');
            });
        }

        // Тест 5: Загрузка индекса
        console.log('\n' + '─'.repeat(60));
        console.log('ТЕСТ 5: Загрузка индекса');
        console.log('─'.repeat(60));

        // Создаем новый экземпляр для проверки загрузки
        const indexer2 = new DocumentIndexer({
            indexPath: './test-document-index.json'
        });

        const loadResult = await indexer2.loadIndex();
        console.log(`\n📂 Индекс загружен: ${loadResult.path}`);
        console.log(`  Документов: ${loadResult.documents}`);
        console.log(`  Чанков: ${loadResult.chunks}`);

        // Проверяем что поиск работает после загрузки
        console.log('\n🔍 Проверка поиска после загрузки...');
        const testSearch = await indexer2.search('neural networks', 2);
        console.log(`✅ Найдено ${testSearch.results.length} результатов`);

        // Тест 6: Список документов
        console.log('\n' + '─'.repeat(60));
        console.log('ТЕСТ 6: Список документов');
        console.log('─'.repeat(60));

        const documents = indexer.getDocuments();
        console.log(`\n📚 Всего документов: ${documents.length}\n`);
        
        documents.forEach((doc, i) => {
            console.log(`  ${i + 1}. ${doc.name}`);
            console.log(`     Чанков: ${doc.chunksCount}`);
            console.log(`     Токенов: ${doc.totalTokens}`);
            console.log(`     Категория: ${doc.metadata.category || 'N/A'}`);
            console.log('');
        });

        console.log('\n' + '='.repeat(60));
        console.log('✅ ВСЕ ТЕСТЫ ПРОЙДЕНЫ УСПЕШНО');
        console.log('='.repeat(60) + '\n');

    } catch (error) {
        console.error('\n❌ ОШИБКА:', error.message);
        console.error('\nДетали:', error);
        process.exit(1);
    }
}

// Запуск тестов
if (require.main === module) {
    runTests().catch(error => {
        console.error('Критическая ошибка:', error);
        process.exit(1);
    });
}

module.exports = { runTests };



