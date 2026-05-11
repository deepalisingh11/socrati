import { describe, it, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { generateQuiz, submitQuiz } from '../apps/web/lib/quiz';
import ws from 'ws';
(global as any).WebSocket = ws;

// ── Shared fake env ────────────────────────────────────────────────────────────

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fake.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'fake-anon-key';
process.env.GROQ_API_KEY = 'fake-groq-key';

// ── Shared mock data ───────────────────────────────────────────────────────────

const FAKE_CHUNKS = [
    { content: 'Mitosis is cell division that produces two identical daughter cells.', chunk_index: 0 },
    { content: 'Meiosis produces four genetically distinct haploid cells.', chunk_index: 1 },
];

const FAKE_QUESTIONS = [
    {
        question_id: 'q1',
        quiz_id: 'quiz-1',
        type: 'multiple_choice',
        question: 'What does mitosis produce?',
        options: ['Two identical cells', 'Four distinct cells', 'One cell', 'Three cells'],
        correct_answer: 'Two identical cells',
        explanation: 'Mitosis produces two identical daughter cells.',
        user_answer: null,
        is_correct: null,
    },
    {
        question_id: 'q2',
        quiz_id: 'quiz-1',
        type: 'true_false',
        question: 'Meiosis produces two cells.',
        options: ['True', 'False'],
        correct_answer: 'False',
        explanation: 'Meiosis produces four haploid cells.',
        user_answer: null,
        is_correct: null,
    },
    {
        question_id: 'q3',
        quiz_id: 'quiz-1',
        type: 'short_answer',
        question: 'How many cells does meiosis produce?',
        correct_answer: 'four',
        explanation: 'Meiosis produces four genetically distinct haploid cells.',
        user_answer: null,
        is_correct: null,
    },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Builds a mock fetch that handles Supabase REST calls for generateQuiz */
function mockFetchForGenerate(groqQuestions: object[]) {
    return mock.method(global, 'fetch', async (url: string | URL | Request, options: any) => {
        const urlString = url.toString();
        const body = options?.body ? JSON.parse(options.body) : null;

        // Supabase: fetch chunks
        if (urlString.includes('/rest/v1/document_chunks')) {
            return new Response(JSON.stringify(FAKE_CHUNKS), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Groq: generate questions
        if (urlString.includes('api.groq.com')) {
            return new Response(
                JSON.stringify({
                    choices: [
                        {
                            message: {
                                content: JSON.stringify({ questions: groqQuestions }),
                            },
                        },
                    ],
                }),
                { status: 200, headers: { 'Content-Type': 'application/json' } },
            );
        }

        // Supabase: insert quiz row
        if (urlString.includes('/rest/v1/quizzes') && body) {
            return new Response(JSON.stringify({ quiz_id: 'quiz-1' }), {
                status: 201,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Supabase: insert quiz_questions
        if (urlString.includes('/rest/v1/quiz_questions')) {
            return new Response(JSON.stringify(FAKE_QUESTIONS), {
                status: 201,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        throw new Error(`Unexpected fetch call: ${urlString}`);
    });
}

// ── generateQuiz tests ─────────────────────────────────────────────────────────

describe('generateQuiz', () => {
    afterEach(() => {
        mock.restoreAll();
    });

    it('returns a quizId and questions on success', async () => {
        mockFetchForGenerate(FAKE_QUESTIONS);

        const result = await generateQuiz({
            documentId: 'doc-1',
            userId: 'user-1',
            questionCount: 5,
            accessToken: 'fake-token',
        });

        assert.ok(result.quizId, 'should return a quizId');
        assert.ok(Array.isArray(result.questions), 'questions should be an array');
    });

    it('throws if no chunks are found for the document', async () => {
        mock.method(global, 'fetch', async (url: string | URL | Request) => {
            if (url.toString().includes('/rest/v1/document_chunks')) {
                return new Response(JSON.stringify([]), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            throw new Error(`Unexpected fetch: ${url}`);
        });

        await assert.rejects(
            () =>
                generateQuiz({
                    documentId: 'doc-empty',
                    userId: 'user-1',
                    questionCount: 5,
                    accessToken: 'fake-token',
                }),
            /No content found/,
        );
    });

    it('throws if Groq returns invalid JSON', async () => {
        mock.method(global, 'fetch', async (url: string | URL | Request) => {
            if (url.toString().includes('/rest/v1/document_chunks')) {
                return new Response(JSON.stringify(FAKE_CHUNKS), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            if (url.toString().includes('api.groq.com')) {
                return new Response(
                    JSON.stringify({
                        choices: [{ message: { content: 'not valid json at all' } }],
                    }),
                    { status: 200, headers: { 'Content-Type': 'application/json' } },
                );
            }
            throw new Error(`Unexpected fetch: ${url}`);
        });

        await assert.rejects(
            () =>
                generateQuiz({
                    documentId: 'doc-1',
                    userId: 'user-1',
                    questionCount: 5,
                    accessToken: 'fake-token',
                }),
            /invalid JSON/,
        );
    });

    it('throws if Groq API returns an error status', async () => {
        mock.method(global, 'fetch', async (url: string | URL | Request) => {
            if (url.toString().includes('/rest/v1/document_chunks')) {
                return new Response(JSON.stringify(FAKE_CHUNKS), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            if (url.toString().includes('api.groq.com')) {
                return new Response('rate limit exceeded', { status: 429 });
            }
            throw new Error(`Unexpected fetch: ${url}`);
        });

        await assert.rejects(
            () =>
                generateQuiz({
                    documentId: 'doc-1',
                    userId: 'user-1',
                    questionCount: 5,
                    accessToken: 'fake-token',
                }),
            /Groq API error/,
        );
    });
});

// ── submitQuiz tests ───────────────────────────────────────────────────────────

describe('submitQuiz', () => {
    afterEach(() => {
        mock.restoreAll();
    });

    it('grades correct answers and returns the right score', async () => {
        mock.method(global, 'fetch', async (url: string | URL | Request, options: any) => {
            const urlString = url.toString();

            // Fetch questions
            if (urlString.includes('/rest/v1/quiz_questions') && options?.method !== 'PATCH') {
                return new Response(JSON.stringify(FAKE_QUESTIONS), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }

            // Update quiz_questions (user_answer + is_correct)
            if (urlString.includes('/rest/v1/quiz_questions') && options?.method === 'PATCH') {
                return new Response(JSON.stringify({}), { status: 200 });
            }

            // Update quizzes (score)
            if (urlString.includes('/rest/v1/quizzes') && options?.method === 'PATCH') {
                return new Response(JSON.stringify({}), { status: 200 });
            }

            throw new Error(`Unexpected fetch: ${urlString}`);
        });

        const result = await submitQuiz({
            quizId: 'quiz-1',
            answers: [
                { questionId: 'q1', userAnswer: 'Two identical cells' }, // correct
                { questionId: 'q2', userAnswer: 'False' },               // correct
                { questionId: 'q3', userAnswer: 'four' },                // correct
            ],
            accessToken: 'fake-token',
        });

        assert.equal(result.score, 3);
        assert.equal(result.total, 3);
        assert.equal(result.percentage, 100);
        assert.ok(result.results.every((r) => r.is_correct), 'all should be correct');
    });

    it('marks wrong answers as incorrect', async () => {
        mock.method(global, 'fetch', async (url: string | URL | Request, options: any) => {
            const urlString = url.toString();

            if (urlString.includes('/rest/v1/quiz_questions') && options?.method !== 'PATCH') {
                return new Response(JSON.stringify(FAKE_QUESTIONS), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            if (urlString.includes('/rest/v1/quiz_questions') && options?.method === 'PATCH') {
                return new Response(JSON.stringify({}), { status: 200 });
            }
            if (urlString.includes('/rest/v1/quizzes') && options?.method === 'PATCH') {
                return new Response(JSON.stringify({}), { status: 200 });
            }

            throw new Error(`Unexpected fetch: ${urlString}`);
        });

        const result = await submitQuiz({
            quizId: 'quiz-1',
            answers: [
                { questionId: 'q1', userAnswer: 'Four distinct cells' }, // wrong
                { questionId: 'q2', userAnswer: 'True' },                // wrong
                { questionId: 'q3', userAnswer: 'two' },                 // wrong
            ],
            accessToken: 'fake-token',
        });

        assert.equal(result.score, 0);
        assert.equal(result.percentage, 0);
        assert.ok(result.results.every((r) => !r.is_correct), 'all should be incorrect');
    });

    it('handles partial answers gracefully', async () => {
        mock.method(global, 'fetch', async (url: string | URL | Request, options: any) => {
            const urlString = url.toString();

            if (urlString.includes('/rest/v1/quiz_questions') && options?.method !== 'PATCH') {
                return new Response(JSON.stringify(FAKE_QUESTIONS), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            if (urlString.includes('/rest/v1/quiz_questions') && options?.method === 'PATCH') {
                return new Response(JSON.stringify({}), { status: 200 });
            }
            if (urlString.includes('/rest/v1/quizzes') && options?.method === 'PATCH') {
                return new Response(JSON.stringify({}), { status: 200 });
            }

            throw new Error(`Unexpected fetch: ${urlString}`);
        });

        // Only answer one out of three questions
        const result = await submitQuiz({
            quizId: 'quiz-1',
            answers: [
                { questionId: 'q1', userAnswer: 'Two identical cells' }, // correct
            ],
            accessToken: 'fake-token',
        });

        assert.equal(result.score, 1);
        assert.equal(result.total, 3);
        assert.equal(result.percentage, 33);
    });

    it('is case-insensitive when grading answers', async () => {
        mock.method(global, 'fetch', async (url: string | URL | Request, options: any) => {
            const urlString = url.toString();

            if (urlString.includes('/rest/v1/quiz_questions') && options?.method !== 'PATCH') {
                return new Response(JSON.stringify(FAKE_QUESTIONS), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            if (urlString.includes('/rest/v1/quiz_questions') && options?.method === 'PATCH') {
                return new Response(JSON.stringify({}), { status: 200 });
            }
            if (urlString.includes('/rest/v1/quizzes') && options?.method === 'PATCH') {
                return new Response(JSON.stringify({}), { status: 200 });
            }

            throw new Error(`Unexpected fetch: ${urlString}`);
        });

        const result = await submitQuiz({
            quizId: 'quiz-1',
            answers: [
                { questionId: 'q3', userAnswer: 'FOUR' }, // uppercase, should still match
            ],
            accessToken: 'fake-token',
        });

        const q3Result = result.results.find((r) => r.question_id === 'q3');
        assert.ok(q3Result?.is_correct, 'should be case-insensitive');
    });
});