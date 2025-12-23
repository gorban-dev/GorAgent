/**
 * Document Indexer — система для индексации документов с эмбеддингами
 * Реализует разбивку текста на чанки + генерацию эмбеддингов через OpenAI API
 */

require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');

class DocumentIndexer {
    constructor(options = {}) {
        this.apiKey = options.apiKey || process.env.OPENAI_API_KEY;
        this.model = options.model || 'text-embedding-3-small'; // или text-embedding-ada-002
        this.chunkSize = options.chunkSize || 500; // размер чанка в токенах (примерно)
        this.chunkOverlap = options.chunkOverlap || 50; // перекрытие между чанками
        this.indexPath = options.indexPath || './document-index.json';
        this.index = {
            documents: [],
            chunks: [],
            metadata: {
                model: this.model,
                chunkSize: this.chunkSize,
                chunkOverlap: this.chunkOverlap,
                created: null,
                updated: null,
                totalDocuments: 0,
                totalChunks: 0
            }
        };
    }

    /**
     * Оценка количества токенов (приблизительная)
     */
    estimateTokens(text) {
        // Приблизительная оценка: ~4 символа = 1 токен
        return Math.ceil(text.length / 3.5);
    }

    /**
     * Разбивка текста на чанки с перекрытием
     */
    chunkText(text, metadata = {}) {
        const chunks = [];
        const words = text.split(/\s+/);
        
        // Примерно 4 символа на токен, среднее слово ~5 символов
        const wordsPerChunk = Math.floor(this.chunkSize * 3.5 / 5);
        const overlapWords = Math.floor(this.chunkOverlap * 3.5 / 5);
        
        let currentPosition = 0;
        let chunkIndex = 0;

        while (currentPosition < words.length) {
            const endPosition = Math.min(currentPosition + wordsPerChunk, words.length);
            const chunkWords = words.slice(currentPosition, endPosition);
            const chunkText = chunkWords.join(' ');
            
            if (chunkText.trim().length > 0) {
                chunks.push({
                    id: `chunk_${Date.now()}_${chunkIndex}`,
                    text: chunkText,
                    tokens: this.estimateTokens(chunkText),
                    position: chunkIndex,
                    startWord: currentPosition,
                    endWord: endPosition,
                    metadata: {
                        ...metadata,
                        documentId: metadata.documentId || null,
                        documentName: metadata.documentName || 'Unknown'
                    }
                });
                chunkIndex++;
            }
            
            // Следующий чанк начинается с учетом перекрытия
            currentPosition = endPosition - overlapWords;
            
            // Защита от бесконечного цикла
            if (currentPosition >= words.length - overlapWords) {
                break;
            }
        }

        return chunks;
    }

    /**
     * Генерация эмбеддинга через OpenAI API
     */
    async generateEmbedding(text) {
        if (!this.apiKey) {
            throw new Error('OpenAI API key не настроен');
        }

        try {
            const response = await fetch('https://api.openai.com/v1/embeddings', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: this.model,
                    input: text
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
            }

            const data = await response.json();
            return {
                embedding: data.data[0].embedding,
                model: data.model,
                usage: data.usage
            };
        } catch (error) {
            console.error('Ошибка генерации эмбеддинга:', error);
            throw error;
        }
    }

    /**
     * Обработка одного документа: чанкинг + генерация эмбеддингов
     */
    async processDocument(content, metadata = {}) {
        console.log(`\n[Indexer] Обработка документа: ${metadata.name || 'Unknown'}`);
        
        const documentId = `doc_${Date.now()}`;
        const documentMetadata = {
            documentId,
            documentName: metadata.name || 'Unknown',
            documentType: metadata.type || 'text',
            ...metadata
        };

        // Шаг 1: Разбивка на чанки
        console.log('[Indexer] Разбивка на чанки...');
        const chunks = this.chunkText(content, documentMetadata);
        console.log(`[Indexer] Создано ${chunks.length} чанков`);

        // Шаг 2: Генерация эмбеддингов для каждого чанка
        console.log('[Indexer] Генерация эмбеддингов...');
        const processedChunks = [];
        let totalTokensUsed = 0;

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            console.log(`[Indexer] Обработка чанка ${i + 1}/${chunks.length}...`);
            
            try {
                const embeddingResult = await this.generateEmbedding(chunk.text);
                
                processedChunks.push({
                    ...chunk,
                    embedding: embeddingResult.embedding,
                    embeddingModel: embeddingResult.model,
                    tokensUsed: embeddingResult.usage.total_tokens
                });

                totalTokensUsed += embeddingResult.usage.total_tokens;
                
                // Небольшая задержка между запросами
                if (i < chunks.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            } catch (error) {
                console.error(`[Indexer] Ошибка обработки чанка ${i + 1}:`, error.message);
                // Добавляем чанк без эмбеддинга
                processedChunks.push({
                    ...chunk,
                    embedding: null,
                    error: error.message
                });
            }
        }

        // Добавляем документ в индекс
        const document = {
            id: documentId,
            name: documentMetadata.documentName,
            type: documentMetadata.documentType,
            metadata: documentMetadata,
            chunksCount: processedChunks.length,
            totalTokens: totalTokensUsed,
            processedAt: new Date().toISOString()
        };

        this.index.documents.push(document);
        this.index.chunks.push(...processedChunks);
        
        // Обновляем метаданные индекса
        this.index.metadata.totalDocuments = this.index.documents.length;
        this.index.metadata.totalChunks = this.index.chunks.length;
        this.index.metadata.updated = new Date().toISOString();
        if (!this.index.metadata.created) {
            this.index.metadata.created = this.index.metadata.updated;
        }

        console.log(`[Indexer] Документ обработан: ${processedChunks.length} чанков, ${totalTokensUsed} токенов`);

        return {
            document,
            chunks: processedChunks,
            totalTokens: totalTokensUsed
        };
    }

    /**
     * Обработка нескольких документов
     */
    async processDocuments(documents) {
        const results = [];
        
        for (const doc of documents) {
            try {
                const result = await this.processDocument(doc.content, doc.metadata);
                results.push({
                    success: true,
                    ...result
                });
            } catch (error) {
                console.error(`[Indexer] Ошибка обработки документа ${doc.metadata?.name}:`, error);
                results.push({
                    success: false,
                    error: error.message,
                    document: doc.metadata
                });
            }
        }

        return results;
    }

    /**
     * Сохранение индекса в файл
     */
    async saveIndex(filepath = null) {
        const savePath = filepath || this.indexPath;
        
        try {
            console.log(`[Indexer] Сохранение индекса в ${savePath}...`);
            
            // Создаем директорию если не существует
            const dir = path.dirname(savePath);
            await fs.mkdir(dir, { recursive: true });
            
            // Сохраняем индекс
            await fs.writeFile(
                savePath,
                JSON.stringify(this.index, null, 2),
                'utf-8'
            );
            
            const stats = await fs.stat(savePath);
            console.log(`[Indexer] Индекс сохранен: ${(stats.size / 1024).toFixed(2)} KB`);
            
            return {
                success: true,
                path: savePath,
                size: stats.size,
                documents: this.index.metadata.totalDocuments,
                chunks: this.index.metadata.totalChunks
            };
        } catch (error) {
            console.error('[Indexer] Ошибка сохранения индекса:', error);
            throw error;
        }
    }

    /**
     * Загрузка индекса из файла
     */
    async loadIndex(filepath = null) {
        const loadPath = filepath || this.indexPath;
        
        try {
            console.log(`[Indexer] Загрузка индекса из ${loadPath}...`);
            const data = await fs.readFile(loadPath, 'utf-8');
            this.index = JSON.parse(data);
            
            console.log(`[Indexer] Индекс загружен: ${this.index.metadata.totalDocuments} документов, ${this.index.metadata.totalChunks} чанков`);
            
            return {
                success: true,
                path: loadPath,
                documents: this.index.metadata.totalDocuments,
                chunks: this.index.metadata.totalChunks
            };
        } catch (error) {
            console.error('[Indexer] Ошибка загрузки индекса:', error);
            throw error;
        }
    }

    /**
     * Поиск похожих чанков по эмбеддингу запроса
     */
    async search(query, topK = 5) {
        console.log(`[Indexer] Поиск по запросу: "${query}"`);
        
        // Генерируем эмбеддинг для запроса
        const queryEmbedding = await this.generateEmbedding(query);
        
        // Вычисляем косинусное сходство со всеми чанками
        const scores = this.index.chunks
            .filter(chunk => chunk.embedding) // Только чанки с эмбеддингами
            .map(chunk => ({
                chunk,
                similarity: this.cosineSimilarity(queryEmbedding.embedding, chunk.embedding)
            }))
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, topK);

        console.log(`[Indexer] Найдено ${scores.length} релевантных чанков`);
        
        return {
            query,
            results: scores,
            tokensUsed: queryEmbedding.usage.total_tokens
        };
    }

    /**
     * Вычисление косинусного сходства между двумя векторами
     */
    cosineSimilarity(vecA, vecB) {
        if (!vecA || !vecB || vecA.length !== vecB.length) {
            return 0;
        }

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }

        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    /**
     * Получение статистики индекса
     */
    getStats() {
        return {
            ...this.index.metadata,
            indexSize: this.index.chunks.reduce((sum, chunk) => {
                return sum + (chunk.embedding ? chunk.embedding.length * 4 : 0); // примерно 4 байта на float
            }, 0),
            avgChunkSize: this.index.chunks.length > 0
                ? Math.round(this.index.chunks.reduce((sum, c) => sum + c.tokens, 0) / this.index.chunks.length)
                : 0
        };
    }

    /**
     * Очистка индекса
     */
    clearIndex() {
        this.index = {
            documents: [],
            chunks: [],
            metadata: {
                model: this.model,
                chunkSize: this.chunkSize,
                chunkOverlap: this.chunkOverlap,
                created: null,
                updated: null,
                totalDocuments: 0,
                totalChunks: 0
            }
        };
        console.log('[Indexer] Индекс очищен');
    }

    /**
     * Получение всех документов
     */
    getDocuments() {
        return this.index.documents;
    }

    /**
     * Получение чанков документа
     */
    getDocumentChunks(documentId) {
        return this.index.chunks.filter(chunk => chunk.metadata.documentId === documentId);
    }
}

module.exports = DocumentIndexer;

