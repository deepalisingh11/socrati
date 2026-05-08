import { logDocumentError, logDocumentEvent } from '@/lib/document-logger';
import { getDocumentQueueHealth } from '@/lib/queue';

export const runtime = 'nodejs';

export async function GET() {
    try {
        const health = await getDocumentQueueHealth();
        logDocumentEvent('queue-health', 'checked', health);

        return Response.json({
            ok: health.workerCount > 0,
            ...health,
        });
    } catch (err) {
        logDocumentError('queue-health', 'check failed', err);

        return Response.json(
            {
                ok: false,
                message: err instanceof Error ? err.message : 'Queue health check failed',
            },
            { status: 500 },
        );
    }
}
