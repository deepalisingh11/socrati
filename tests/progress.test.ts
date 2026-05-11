import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { handleProgressGet, type ProgressDependencies } from '../apps/web/lib/progress-handler';

// ── Helpers ────────────────────────────────────────────────────────────────────

function createDeps(options?: {
    session?: { user: { id: string }; access_token: string } | null;
    quizzes?: object[];
    queryError?: { message: string } | null;
}): ProgressDependencies {
    return {
        async createSupabaseClient() {
            return {
                auth: {
                    async getSession() {
                        return {
                            data: {
                                session:
                                    options && 'session' in options
                                        ? options.session!
                                        : { user: { id: 'user-123' }, access_token: 'token' },
                            },
                        };
                    },
                },
                from(_table: string) {
                    return {
                        select(_cols: string) {
                            return {
                                eq(_col: string, _val: string) {
                                    return {
                                        order(_col: string, _opts: object) {
                                            if (options?.queryError) {
                                                return { data: null, error: options.queryError };
                                            }
                                            return {
                                                data: options?.quizzes ?? [],
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
        },
    };
}

async function readJson(res: Response) {
    return (await res.json()) as Record<string, unknown>;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('handleProgressGet', () => {
    it('returns 401 when no session exists', async () => {
        const deps = createDeps({ session: null });
        const res = await handleProgressGet(deps);
        assert.equal(res.status, 401);
        const body = await readJson(res);
        assert.equal(body.error, 'Unauthorized');
    });

    it('returns empty attempts array when user has no quizzes', async () => {
        const deps = createDeps({ quizzes: [] });
        const res = await handleProgressGet(deps);
        assert.equal(res.status, 200);
        const body = await readJson(res);
        assert.deepEqual(body.attempts, []);
    });

    it('returns correctly mapped attempts with document title', async () => {
        const deps = createDeps({
            quizzes: [
                {
                    quiz_id: 'quiz-1',
                    score: 4,
                    question_count: 5,
                    created_at: '2026-05-10T10:00:00Z',
                    document_id: 'doc-1',
                    documents: { title: 'Lecture Notes.pdf' },
                },
            ],
        });

        const res = await handleProgressGet(deps);
        assert.equal(res.status, 200);
        const body = await readJson(res);
        const attempts = body.attempts as any[];
        assert.equal(attempts.length, 1);
        assert.equal(attempts[0].quiz_id, 'quiz-1');
        assert.equal(attempts[0].score, 4);
        assert.equal(attempts[0].question_count, 5);
        assert.equal(attempts[0].document_title, 'Lecture Notes.pdf');
    });

    it('falls back to "Unknown document" when documents is null', async () => {
        const deps = createDeps({
            quizzes: [
                {
                    quiz_id: 'quiz-2',
                    score: 3,
                    question_count: 5,
                    created_at: '2026-05-10T11:00:00Z',
                    document_id: 'doc-2',
                    documents: null,
                },
            ],
        });

        const res = await handleProgressGet(deps);
        const body = await readJson(res);
        const attempts = body.attempts as any[];
        assert.equal(attempts[0].document_title, 'Unknown document');
    });

    it('defaults score to 0 when score is null', async () => {
        const deps = createDeps({
            quizzes: [
                {
                    quiz_id: 'quiz-3',
                    score: null,
                    question_count: 5,
                    created_at: '2026-05-10T12:00:00Z',
                    document_id: 'doc-3',
                    documents: { title: 'Notes.pdf' },
                },
            ],
        });

        const res = await handleProgressGet(deps);
        const body = await readJson(res);
        const attempts = body.attempts as any[];
        assert.equal(attempts[0].score, 0);
    });

    it('returns 500 when the database query fails', async () => {
        const deps = createDeps({ queryError: { message: 'DB connection failed' } });
        const res = await handleProgressGet(deps);
        assert.equal(res.status, 500);
        const body = await readJson(res);
        assert.equal(body.error, 'DB connection failed');
    });

    it('returns multiple attempts in the correct order', async () => {
        const deps = createDeps({
            quizzes: [
                {
                    quiz_id: 'quiz-1',
                    score: 5,
                    question_count: 5,
                    created_at: '2026-05-10T12:00:00Z',
                    document_id: 'doc-1',
                    documents: { title: 'Doc A' },
                },
                {
                    quiz_id: 'quiz-2',
                    score: 2,
                    question_count: 5,
                    created_at: '2026-05-09T12:00:00Z',
                    document_id: 'doc-2',
                    documents: { title: 'Doc B' },
                },
            ],
        });

        const res = await handleProgressGet(deps);
        const body = await readJson(res);
        const attempts = body.attempts as any[];
        assert.equal(attempts.length, 2);
        assert.equal(attempts[0].quiz_id, 'quiz-1');
        assert.equal(attempts[1].quiz_id, 'quiz-2');
    });
});