import { Worker } from 'bullmq';
import { chunkDocument } from './chunker';
import { embedChunksStrict } from './embedder';
import { parsePDFFromBuffer } from './parser';
import type { DocumentJobData } from './queue';
import { createRedisConnection } from './redis';
import { saveChunks, updateParseStatus } from './repository';
import { notifyDocumentComplete } from './waiters';

const worker = new Worker<DocumentJobData>(
    'document-processing',
    async (job) => {
        const { documentId, fileBase64 } = job.data;

        await updateParseStatus(documentId, 'processing');

        const buffer = Buffer.from(fileBase64, 'base64');
        const doc = await parsePDFFromBuffer(buffer);
        const chunks = await chunkDocument(doc);
        const embedded = await embedChunksStrict(chunks);

        await saveChunks(documentId, embedded);
        await updateParseStatus(documentId, 'ready');
        notifyDocumentComplete(documentId, 'ready');

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

worker.on('completed', (job, result) => {
    console.log(
        `Document ${result.documentId}: ${result.chunks} chunks saved by job ${job.id}`,
    );
});

worker.on('failed', async (job, err) => {
    const documentId = job?.data.documentId;
    console.error(`Document job ${job?.id ?? 'unknown'} failed:`, err);

    if (!documentId) return;
    if (job.attemptsMade < (job.opts.attempts ?? 1)) return;

    try {
        await updateParseStatus(documentId, 'failed', err.message);
        notifyDocumentComplete(documentId, 'failed', err.message);
    } catch (statusError) {
        console.error(`Failed to mark document ${documentId} as failed:`, statusError);
    }
});

const shutdown = async () => {
    await worker.close();
    process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

console.log('Document worker started');
