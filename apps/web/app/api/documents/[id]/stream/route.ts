import { NextRequest } from 'next/server';

// GET /api/documents/[id]/stream
//
// Keeps an SSE connection open until the BullMQ parse→chunk→embed
// pipeline completes for this document, then pushes one event and closes.
//
// Your BullMQ worker (in packages/core or a separate worker process) should
// call notifyDocumentComplete(documentId, status, error?) when the job finishes.
// This route bridges that signal to the waiting browser.
//
// The simplest approach at your scale: use a shared in-memory Map of
// resolve callbacks. Works fine for a single-process Next.js server.
// For multi-process / edge deployments, swap this for Redis pub/sub.

type Resolver = (result: { status: 'ready' | 'failed'; error?: string }) => void;

// Module-level map — persists across requests in the same process
const waiters = new Map<string, Resolver>();

// Called by your BullMQ worker when a job finishes.
// Import this in your worker: import { notifyDocumentComplete } from '@/app/api/documents/[id]/stream/route'
export function notifyDocumentComplete(
    documentId: string,
    status: 'ready' | 'failed',
    error?: string,
) {
    const resolve = waiters.get(documentId);
    if (resolve) {
        resolve({ status, error });
        waiters.delete(documentId);
    }
}

export async function GET(
    _req: NextRequest,
    { params }: { params: { id: string } },
) {
    const { id: documentId } = params;

    const stream = new ReadableStream({
        start(controller) {
            const encoder = new TextEncoder();

            // Send SSE headers comment to keep connection alive
            controller.enqueue(encoder.encode(': connected\n\n'));

            // Register a resolver — the BullMQ worker will call notifyDocumentComplete()
            // which resolves this promise and sends the final event
            const timeout = setTimeout(() => {
                // Safety net: if job takes > 5 min, send failure and close
                const data = JSON.stringify({ status: 'failed', error: 'Processing timed out' });
                controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                controller.close();
                waiters.delete(documentId);
            }, 5 * 60 * 1000);

            waiters.set(documentId, ({ status, error }) => {
                clearTimeout(timeout);
                const data = JSON.stringify({ status, ...(error ? { error } : {}) });
                controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                controller.close();
            });
        },
        cancel() {
            // Browser closed the connection before job finished
            waiters.delete(documentId);
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}