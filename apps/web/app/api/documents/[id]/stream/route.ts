import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type ParseStatus = 'pending' | 'processing' | 'ready' | 'failed';

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id: documentId } = await params;
    const supabase = await createClient();
    let interval: ReturnType<typeof setInterval> | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let closed = false;

    const stream = new ReadableStream({
        start(controller) {
            const encoder = new TextEncoder();

            controller.enqueue(encoder.encode(': connected\n\n'));

            const sendAndClose = (status: 'ready' | 'failed', error?: string) => {
                if (closed) return;
                closed = true;
                if (interval) clearInterval(interval);
                if (timeout) clearTimeout(timeout);

                const data = JSON.stringify({ status, ...(error ? { error } : {}) });
                controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                controller.close();
            };

            const poll = async () => {
                try {
                    const { data, error } = await supabase
                        .from('documents')
                        .select('parse_status, error_message')
                        .eq('document_id', documentId)
                        .single();

                    if (error) {
                        sendAndClose('failed', error.message);
                        return;
                    }

                    const status = data.parse_status as ParseStatus;

                    if (status === 'ready') {
                        sendAndClose('ready');
                    }

                    if (status === 'failed') {
                        sendAndClose('failed', data.error_message ?? 'Processing failed');
                    }
                } catch (err) {
                    const msg = err instanceof Error ? err.message : 'Status check failed';
                    sendAndClose('failed', msg);
                }
            };

            timeout = setTimeout(() => {
                sendAndClose('failed', 'Processing timed out');
            }, 5 * 60 * 1000);

            interval = setInterval(poll, 2_000);
            void poll();
        },
        cancel() {
            closed = true;
            if (interval) clearInterval(interval);
            if (timeout) clearTimeout(timeout);
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
