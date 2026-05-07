type Resolver = (result: { status: 'ready' | 'failed'; error?: string }) => void;

export const waiters = new Map<string, Resolver>();

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