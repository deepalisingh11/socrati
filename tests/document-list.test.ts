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

    it('returns all expected fields for each document', async () => {
        const docs: DocumentRow[] = [
            {
                document_id: 'doc-abc',
                title: 'Slides.pptx',
                file_type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                parse_status: 'ready',
                uploaded_at: '2025-03-01T12:00:00Z',
            },
        ];
        const deps = createDeps({ documents: docs });

        const response = await handleDocumentList(createListRequest(), deps);

        assert.equal(response.status, 200);
        const body = await readJson(response);
        const returned = (body.documents as DocumentRow[])[0];
        assert.equal(returned?.document_id, 'doc-abc');
        assert.equal(returned?.title, 'Slides.pptx');
        assert.equal(returned?.file_type, 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
        assert.equal(returned?.parse_status, 'ready');
        assert.equal(returned?.uploaded_at, '2025-03-01T12:00:00Z');
    });

    it('returns a single document correctly', async () => {
        const docs: DocumentRow[] = [
            {
                document_id: 'only-doc',
                title: 'solo.txt',
                file_type: 'text/plain',
                parse_status: 'processing',
                uploaded_at: '2025-06-01T08:00:00Z',
            },
        ];
        const deps = createDeps({ documents: docs });

        const response = await handleDocumentList(createListRequest(), deps);

        assert.equal(response.status, 200);
        assert.deepEqual(await readJson(response), { documents: docs });
    });

    it('returns documents with all parse statuses preserved', async () => {
        const docs: DocumentRow[] = [
            { document_id: 'd1', title: 'a.pdf', file_type: 'application/pdf', parse_status: 'ready', uploaded_at: '2025-01-04T00:00:00Z' },
            { document_id: 'd2', title: 'b.pdf', file_type: 'application/pdf', parse_status: 'failed', uploaded_at: '2025-01-03T00:00:00Z' },
            { document_id: 'd3', title: 'c.pdf', file_type: 'application/pdf', parse_status: 'processing', uploaded_at: '2025-01-02T00:00:00Z' },
            { document_id: 'd4', title: 'd.pdf', file_type: 'application/pdf', parse_status: 'pending', uploaded_at: '2025-01-01T00:00:00Z' },
        ];
        const deps = createDeps({ documents: docs });

        const response = await handleDocumentList(createListRequest(), deps);

        assert.equal(response.status, 200);
        const body = await readJson(response);
        const returned = body.documents as DocumentRow[];
        assert.equal(returned.length, 4);
        assert.deepEqual(
            returned.map(d => d.parse_status),
            ['ready', 'failed', 'processing', 'pending'],
        );
    });

    it('preserves newest-first ordering returned by the DB', async () => {
        const docs: DocumentRow[] = [
            { document_id: 'newer', title: 'new.pdf', file_type: 'application/pdf', parse_status: 'ready', uploaded_at: '2025-05-02T00:00:00Z' },
            { document_id: 'older', title: 'old.pdf', file_type: 'application/pdf', parse_status: 'ready', uploaded_at: '2025-05-01T00:00:00Z' },
        ];
        const deps = createDeps({ documents: docs });

        const response = await handleDocumentList(createListRequest(), deps);

        assert.equal(response.status, 200);
        const body = await readJson(response);
        const returned = body.documents as DocumentRow[];
        assert.equal(returned[0]?.document_id, 'newer');
        assert.equal(returned[1]?.document_id, 'older');
    });

    it('returns an empty documents array (not null) when the user has no documents', async () => {
        const deps = createDeps({ documents: [] });

        const response = await handleDocumentList(createListRequest(), deps);

        assert.equal(response.status, 200);
        const body = await readJson(response);
        assert.ok(Array.isArray(body.documents));
        assert.equal((body.documents as DocumentRow[]).length, 0);
    });
});
