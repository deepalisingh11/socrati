import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { handleDocumentList, type ListDependencies, type DocumentRow } from '../apps/web/lib/document-list';

const originalConsole = {
    log: console.log,
    error: console.error,
};

before(() => {
    console.log = () => {};
    console.error = () => {};
});

after(() => {
    console.log = originalConsole.log;
    console.error = originalConsole.error;
});

function createListRequest() {
    return new Request('http://localhost/api/documents', { method: 'GET' });
}

function createDeps(options?: {
    authError?: { message: string } | null;
    user?: { id: string } | null;
    documents?: DocumentRow[];
    queryError?: { message: string } | null;
}): ListDependencies {
    return {
        async createSupabaseClient() {
            return {
                auth: {
                    async getUser() {
                        return {
                            data: {
                                user:
                                    options && 'user' in options
                                        ? options.user!
                                        : { id: 'user-123' },
                            },
                            error: options?.authError ?? null,
                        };
                    },
                },
                from(_table: string) {
                    return {
                        select(_columns: string) {
                            return {
                                async order(
                                    _column: string,
                                    _opts: { ascending: boolean },
                                ) {
                                    if (options?.queryError) {
                                        return { data: null, error: options.queryError };
                                    }
                                    return {
                                        data: options?.documents ?? [],
                                        error: null,
                                    };
                                },
                            };
                        },
                    };
                },
            };
        },
    };
}

async function readJson(response: Response) {
    return (await response.json()) as Record<string, unknown>;
}

describe('document list handler', () => {
    it('returns an empty list when the user has no documents', async () => {
        const deps = createDeps();

        const response = await handleDocumentList(createListRequest(), deps);

        assert.equal(response.status, 200);
        assert.deepEqual(await readJson(response), { documents: [] });
    });

    it('returns the authenticated user\'s documents ordered by upload date', async () => {
        const docs: DocumentRow[] = [
            {
                document_id: 'doc-1',
                title: 'Lecture 1.pdf',
                file_type: 'application/pdf',
                parse_status: 'ready',
                uploaded_at: '2025-01-02T10:00:00Z',
            },
            {
                document_id: 'doc-2',
                title: 'Notes.txt',
                file_type: 'text/plain',
                parse_status: 'pending',
                uploaded_at: '2025-01-01T09:00:00Z',
            },
        ];
        const deps = createDeps({ documents: docs });

        const response = await handleDocumentList(createListRequest(), deps);

        assert.equal(response.status, 200);
        const body = await readJson(response);
        assert.deepEqual(body, { documents: docs });
    });

    it('returns 401 when no authenticated user is found', async () => {
        const deps = createDeps({ user: null });

        const response = await handleDocumentList(createListRequest(), deps);

        assert.equal(response.status, 401);
        assert.deepEqual(await readJson(response), { message: 'Unauthorized' });
    });

    it('returns 401 when auth returns an error', async () => {
        const deps = createDeps({ authError: { message: 'session expired' } });

        const response = await handleDocumentList(createListRequest(), deps);

        assert.equal(response.status, 401);
        assert.deepEqual(await readJson(response), { message: 'Unauthorized' });
    });

    it('returns 500 when the database query fails', async () => {
        const deps = createDeps({ queryError: { message: 'connection timeout' } });

        const response = await handleDocumentList(createListRequest(), deps);

        assert.equal(response.status, 500);
        assert.deepEqual(await readJson(response), { message: 'connection timeout' });
    });
});
