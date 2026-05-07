import { NextRequest } from 'next/server';
import { waiters } from '@/lib/waiters';

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id: documentId } = await params;

    const stream = new ReadableStream({
        start(controller) {
            const encoder = new TextEncoder();

            controller.enqueue(encoder.encode(': connected\n\n'));

            const timeout = setTimeout(() => {
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