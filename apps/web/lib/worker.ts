import { Worker } from 'bullmq';
import { chunkDocument } from './chunker';
import { logDocumentError, logDocumentEvent } from './document-logger';
import { embedChunksStrict } from './embedder';
import { loadEnvFiles } from './load-env';
import { parsePDFFromBuffer } from './parser';
import type { DocumentJobData } from './queue';
import { createRedisConnection } from './redis';
import { saveChunksForUser, updateParseStatus } from './repository';
import { notifyDocumentComplete } from './waiters';

loadEnvFiles();

const worker = new Worker<DocumentJobData>(
    'document-processing',
    async (job) => {
        const { documentId, fileBase64, userAccessToken } = job.data;
        const startedAt = Date.now();

        logDocumentEvent('worker', 'job started', {
            documentId,
            jobId: job.id,
            attempt: job.attemptsMade + 1,
            fileName: job.data.fileName,
            fileType: job.data.fileType,
            base64Length: fileBase64.length,
        });

        logDocumentEvent('worker', 'marking processing', { documentId, jobId: job.id });
        await updateParseStatus(documentId, 'processing', undefined, userAccessToken);

        const buffer = Buffer.from(fileBase64, 'base64');
        logDocumentEvent('worker', 'file decoded', {
            documentId,
            jobId: job.id,
            bufferBytes: buffer.byteLength,
        });

        const doc = await parsePDFFromBuffer(buffer);
        logDocumentEvent('worker', 'pdf parsed', {
            documentId,
            jobId: job.id,
            textLength: doc.text.length,
            headingCount: doc.headings.length,
            elapsedMs: Date.now() - startedAt,
        });

        const chunks = await chunkDocument(doc);
        logDocumentEvent('worker', 'document chunked', {
            documentId,
            jobId: job.id,
            chunkCount: chunks.length,
            elapsedMs: Date.now() - startedAt,
        });

        const embedded = await embedChunksStrict(chunks);
        logDocumentEvent('worker', 'chunks embedded', {
            documentId,
            jobId: job.id,
            embeddedCount: embedded.length,
            embeddingDimensions: embedded[0]?.embedding.length ?? 0,
            elapsedMs: Date.now() - startedAt,
        });

        await saveChunksForUser(documentId, embedded, userAccessToken);
        logDocumentEvent('worker', 'chunks saved', {
            documentId,
            jobId: job.id,
            chunkCount: embedded.length,
            elapsedMs: Date.now() - startedAt,
        });

        await updateParseStatus(documentId, 'ready', undefined, userAccessToken);
        notifyDocumentComplete(documentId, 'ready');

        logDocumentEvent('worker', 'job finished', {
            documentId,
            jobId: job.id,
            elapsedMs: Date.now() - startedAt,
        });

        return {
            documentId,
            chunks: embedded.length,
        };
    },
    {
        connection: createRedisConnection(),
        concurrency: Number(process.env.DOCUMENT_WORKER_CONCURRENCY ?? 3),
    },
);

worker.on('active', (job) => {
    logDocumentEvent('worker', 'job active', {
        documentId: job.data.documentId,
        jobId: job.id,
        attemptsMade: job.attemptsMade,
    });
});

worker.on('completed', (job, result) => {
    logDocumentEvent('worker', 'job completed event', {
        documentId: result.documentId,
        jobId: job.id,
        chunkCount: result.chunks,
    });
});

worker.on('failed', async (job, err) => {
    const documentId = job?.data.documentId;
    logDocumentError('worker', 'job failed event', err, {
        documentId,
        jobId: job?.id,
        attemptsMade: job?.attemptsMade,
        configuredAttempts: job?.opts.attempts,
    });

    if (!documentId) return;
    if (job.attemptsMade < (job.opts.attempts ?? 1)) return;

    try {
        await updateParseStatus(
            documentId,
            'failed',
            err.message,
            job.data.userAccessToken,
        );
        notifyDocumentComplete(documentId, 'failed', err.message);
    } catch (statusError) {
        logDocumentError('worker', 'failed to mark document failed', statusError, {
            documentId,
            jobId: job.id,
        });
    }
});

worker.on('error', (err) => {
    logDocumentError('worker', 'worker error event', err);
});

const shutdown = async () => {
    logDocumentEvent('worker', 'shutdown requested');
    await worker.close();
    process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

logDocumentEvent('worker', 'started', {
    concurrency: Number(process.env.DOCUMENT_WORKER_CONCURRENCY ?? 3),
    embeddingMock: process.env.EMBEDDING_MOCK === 'true',
});
