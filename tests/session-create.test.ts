import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    handleSessionCreate,
    type CreateSessionDeps,
} from '../apps/web/lib/session-create';

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

type InsertedRow = Record<string, unknown>;

function createDeps(options?: {
    authError?: { message: string } | null;
    user?: { id: string } | null;
    insertError?: { message: string } | null;
    sessionId?: string;
}): {
    deps: CreateSessionDeps;
    inserts: InsertedRow[];
} {
    const inserts: InsertedRow[] = [];

    const deps: CreateSessionDeps = {
        generateSessionId: () => options?.sessionId ?? 'session-uuid-123',
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
                        async insert(row: Record<string, unknown>) {
                            inserts.push(row);
                            return { error: options?.insertError ?? null };
                        },
                    };
                },
            };
        },
    };

    return { deps, inserts };
}

function makeRequest(body: unknown): Request {
    return new Request('http://localhost/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

async function readJson(response: Response) {
    return (await response.json()) as Record<string, unknown>;
}

// ── Tests ──────────────────────────────────────────────────────────────────

const DOC_A = '11111111-0000-0000-0000-000000000001';
const DOC_B = '11111111-0000-0000-0000-000000000002';
const DOC_C = '11111111-0000-0000-0000-000000000003';

describe('handleSessionCreate', () => {
    it('returns 201 with sessionId on success', async () => {
        const { deps } = createDeps({ sessionId: 'sess-001' });

        const res = await handleSessionCreate(
            makeRequest({ documentIds: [DOC_A, DOC_B] }),
            deps,
        );

        assert.equal(res.status, 201);
        assert.deepEqual(await readJson(res), { sessionId: 'sess-001' });
    });

    it('inserts the correct row into the sessions table', async () => {
        const { deps, inserts } = createDeps({
            user: { id: 'user-xyz' },
            sessionId: 'sess-abc',
        });

        await handleSessionCreate(
            makeRequest({ documentIds: [DOC_A, DOC_B] }),
            deps,
        );

        assert.equal(inserts.length, 1);
        assert.deepEqual(inserts[0], {
            session_id: 'sess-abc',
            user_id: 'user-xyz',
            document_ids: [DOC_A, DOC_B],
        });
    });

    it('returns 400 when documentIds is missing', async () => {
        const { deps } = createDeps();

        const res = await handleSessionCreate(makeRequest({}), deps);

        assert.equal(res.status, 400);
        assert.deepEqual(await readJson(res), {
            message: 'documentIds must be a non-empty array',
        });
    });

    it('returns 400 when documentIds is an empty array', async () => {
        const { deps } = createDeps();

        const res = await handleSessionCreate(
            makeRequest({ documentIds: [] }),
            deps,
        );

        assert.equal(res.status, 400);
        assert.deepEqual(await readJson(res), {
            message: 'documentIds must be a non-empty array',
        });
    });

    it('returns 400 when documentIds contains non-string values', async () => {
        const { deps } = createDeps();

        const res = await handleSessionCreate(
            makeRequest({ documentIds: [123, null] }),
            deps,
        );

        assert.equal(res.status, 400);
        assert.deepEqual(await readJson(res), {
            message: 'documentIds must be valid UUIDs',
        });
    });

    it('returns 400 when documentIds contains non-UUID strings', async () => {
        const { deps } = createDeps();

        const res = await handleSessionCreate(
            makeRequest({ documentIds: ['not-a-uuid', 'also-bad'] }),
            deps,
        );

        assert.equal(res.status, 400);
        assert.deepEqual(await readJson(res), {
            message: 'documentIds must be valid UUIDs',
        });
    });

    it('returns 400 when documentIds contains empty strings', async () => {
        const { deps } = createDeps();

        const res = await handleSessionCreate(
            makeRequest({ documentIds: ['  '] }),
            deps,
        );

        assert.equal(res.status, 400);
        assert.deepEqual(await readJson(res), {
            message: 'documentIds must be valid UUIDs',
        });
    });

    it('returns 400 when the request body is not valid JSON', async () => {
        const { deps } = createDeps();
        const req = new Request('http://localhost/api/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: 'not json',
        });

        const res = await handleSessionCreate(req, deps);

        assert.equal(res.status, 400);
        assert.deepEqual(await readJson(res), { message: 'Invalid request body' });
    });

    it('returns 401 when no authenticated user is found', async () => {
        const { deps } = createDeps({ user: null });

        const res = await handleSessionCreate(
            makeRequest({ documentIds: [DOC_A] }),
            deps,
        );

        assert.equal(res.status, 401);
        assert.deepEqual(await readJson(res), { message: 'Unauthorized' });
    });

    it('returns 401 when auth returns an error', async () => {
        const { deps } = createDeps({ authError: { message: 'token expired' } });

        const res = await handleSessionCreate(
            makeRequest({ documentIds: [DOC_A] }),
            deps,
        );

        assert.equal(res.status, 401);
        assert.deepEqual(await readJson(res), { message: 'Unauthorized' });
    });

    it('returns 500 when the database insert fails', async () => {
        const { deps } = createDeps({
            insertError: { message: 'foreign key violation' },
        });

        const res = await handleSessionCreate(
            makeRequest({ documentIds: [DOC_A] }),
            deps,
        );

        assert.equal(res.status, 500);
        assert.deepEqual(await readJson(res), { message: 'foreign key violation' });
    });

    it('does not insert when auth fails', async () => {
        const { deps, inserts } = createDeps({ user: null });

        await handleSessionCreate(makeRequest({ documentIds: ['doc-1'] }), deps);

        assert.equal(inserts.length, 0);
    });

    it('uses the session id from generateSessionId', async () => {
        let called = false;
        const { deps } = createDeps();
        deps.generateSessionId = () => {
            called = true;
            return 'custom-id';
        };

        const res = await handleSessionCreate(
            makeRequest({ documentIds: [DOC_A] }),
            deps,
        );

        assert.ok(called, 'generateSessionId should have been called');
        assert.deepEqual(await readJson(res), { sessionId: 'custom-id' });
    });

    it('accepts a single document id', async () => {
        const { deps, inserts } = createDeps({ sessionId: 'sess-single' });
        const singleId = '11111111-1111-1111-1111-111111111111';

        const res = await handleSessionCreate(
            makeRequest({ documentIds: [singleId] }),
            deps,
        );

        assert.equal(res.status, 201);
        assert.deepEqual(
            (inserts[0] as Record<string, unknown>).document_ids,
            [singleId],
        );
    });

    it('preserves all document ids in the inserted row', async () => {
        const ids = [DOC_A, DOC_B, DOC_C];
        const { deps, inserts } = createDeps();

        await handleSessionCreate(makeRequest({ documentIds: ids }), deps);

        assert.deepEqual(
            (inserts[0] as Record<string, unknown>).document_ids,
            ids,
        );
    });
});