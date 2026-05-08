import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    handleSessionGet,
    type GetSessionDeps,
    type SessionRow,
    type SessionDocumentRow,
} from '../apps/web/lib/session-get';

// ── Console suppression ────────────────────────────────────────────────────

const originalConsole = { log: console.log, error: console.error };

before(() => {
    console.log = () => {};
    console.error = () => {};
});

after(() => {
    console.log = originalConsole.log;
    console.error = originalConsole.error;
});

// ── Mock factory helpers ───────────────────────────────────────────────────

function makeSession(overrides?: Partial<SessionRow>): SessionRow {
    return {
        session_id: 'sess-001',
        user_id: 'user-abc',
        document_ids: ['doc-1', 'doc-2'],
        created_at: '2025-01-01T00:00:00Z',
        ...overrides,
    };
}

function createDeps(options?: {
    authError?: { message: string } | null;
    user?: { id: string } | null;
    session?: SessionRow | null;
    sessionError?: { message: string; code?: string } | null;
    documents?: SessionDocumentRow[];
    docsError?: { message: string } | null;
}): GetSessionDeps {
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
                                        : { id: 'user-abc' },
                            },
                            error: options?.authError ?? null,
                        };
                    },
                },
                from(_table: string) {
                    return {
                        select(_columns: string) {
                            return {
                                eq(_col: string, _val: string) {
                                    return {
                                        async single() {
                                            const session =
                                                options && 'session' in options
                                                    ? options.session
                                                    : makeSession();
                                            return {
                                                data: session ?? null,
                                                error: options?.sessionError ?? null,
                                            };
                                        },
                                    };
                                },
                                async in(_col: string, _vals: string[]) {
                                    return {
                                        data: options?.documents ?? [],
                                        error: options?.docsError ?? null,
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

function makeRequest(sessionId = 'sess-001'): Request {
    return new Request(`http://localhost/api/sessions/${sessionId}`, {
        method: 'GET',
    });
}

async function readJson(response: Response) {
    return (await response.json()) as Record<string, unknown>;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('handleSessionGet', () => {
    it('returns 200 with session and documents on success', async () => {
        const session = makeSession();
        const docs: SessionDocumentRow[] = [
            { document_id: 'doc-1', title: 'Notes.pdf', file_type: 'application/pdf', parse_status: 'ready' },
            { document_id: 'doc-2', title: 'Slides.pptx', file_type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', parse_status: 'ready' },
        ];
        const deps = createDeps({ session, documents: docs });

        const res = await handleSessionGet(makeRequest(), 'sess-001', deps);

        assert.equal(res.status, 200);
        const body = await readJson(res);
        assert.deepEqual(body.session, session);
        assert.deepEqual(body.documents, docs);
    });

    it('returns 401 when no authenticated user is found', async () => {
        const deps = createDeps({ user: null });

        const res = await handleSessionGet(makeRequest(), 'sess-001', deps);

        assert.equal(res.status, 401);
        assert.deepEqual(await readJson(res), { message: 'Unauthorized' });
    });

    it('returns 401 when auth returns an error', async () => {
        const deps = createDeps({ authError: { message: 'session expired' } });

        const res = await handleSessionGet(makeRequest(), 'sess-001', deps);

        assert.equal(res.status, 401);
        assert.deepEqual(await readJson(res), { message: 'Unauthorized' });
    });

    it('returns 404 when session is not found (PGRST116)', async () => {
        const deps = createDeps({
            session: null,
            sessionError: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' },
        });

        const res = await handleSessionGet(makeRequest(), 'missing-id', deps);

        assert.equal(res.status, 404);
        assert.deepEqual(await readJson(res), { message: 'Session not found' });
    });

    it('returns 404 when session data is null without error', async () => {
        const deps = createDeps({ session: null, sessionError: null });

        const res = await handleSessionGet(makeRequest(), 'missing-id', deps);

        assert.equal(res.status, 404);
        assert.deepEqual(await readJson(res), { message: 'Session not found' });
    });

    it('returns 500 when the session query fails with a non-404 error', async () => {
        const deps = createDeps({
            session: null,
            sessionError: { message: 'connection timeout', code: '57014' },
        });

        const res = await handleSessionGet(makeRequest(), 'sess-001', deps);

        assert.equal(res.status, 500);
        assert.deepEqual(await readJson(res), { message: 'connection timeout' });
    });

    it('returns 500 when the documents query fails', async () => {
        const deps = createDeps({
            docsError: { message: 'relation does not exist' },
        });

        const res = await handleSessionGet(makeRequest(), 'sess-001', deps);

        assert.equal(res.status, 500);
        assert.deepEqual(await readJson(res), { message: 'relation does not exist' });
    });

    it('returns an empty documents array when session has no documents', async () => {
        const session = makeSession({ document_ids: [] });
        const deps = createDeps({ session, documents: [] });

        const res = await handleSessionGet(makeRequest(), 'sess-001', deps);

        assert.equal(res.status, 200);
        const body = await readJson(res);
        assert.ok(Array.isArray(body.documents));
        assert.equal((body.documents as SessionDocumentRow[]).length, 0);
    });

    it('includes all session fields in the response', async () => {
        const session = makeSession({
            session_id: 'sess-xyz',
            user_id: 'user-qrs',
            document_ids: ['doc-a'],
            created_at: '2025-06-01T12:00:00Z',
        });
        const deps = createDeps({ session });

        const res = await handleSessionGet(makeRequest('sess-xyz'), 'sess-xyz', deps);

        assert.equal(res.status, 200);
        const body = await readJson(res);
        const returnedSession = body.session as SessionRow;
        assert.equal(returnedSession.session_id, 'sess-xyz');
        assert.equal(returnedSession.user_id, 'user-qrs');
        assert.deepEqual(returnedSession.document_ids, ['doc-a']);
        assert.equal(returnedSession.created_at, '2025-06-01T12:00:00Z');
    });

    it('returns null documents as an empty array', async () => {
        const deps = createDeps({ documents: undefined });

        const res = await handleSessionGet(makeRequest(), 'sess-001', deps);

        assert.equal(res.status, 200);
        const body = await readJson(res);
        assert.ok(Array.isArray(body.documents));
    });
});