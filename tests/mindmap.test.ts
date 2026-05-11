import { after, afterEach, before, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { generateMindMap } from '../apps/web/lib/mindmap';
import ws from 'ws';

(global as any).WebSocket = ws;

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fake.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'fake-anon-key';
process.env.GROQ_API_KEY = 'fake-groq-key';

const originalConsole = { log: console.log, error: console.error };

before(() => {
    console.log = () => {};
    console.error = () => {};
});

after(() => {
    console.log = originalConsole.log;
    console.error = originalConsole.error;
});

const LONG_CHUNKS = Array.from({ length: 16 }, (_, index) => ({
    content: `Photosynthesis topic ${index} explains chloroplasts, light reactions, carbon fixation, glucose production, and plant energy transfer in enough detail for study notes.`,
    chunk_index: index,
    heading: index < 8 ? 'Photosynthesis' : 'Cellular respiration',
    key_terms: index === 0 ? ['chloroplasts', 'light reactions'] : [],
}));

const VALID_GRAPH = {
    nodes: [
        {
            id: 'plant-energy',
            label: 'Plant Energy',
            description: 'The document explains how plants capture and use energy.',
            level: 0,
        },
        {
            id: 'photosynthesis',
            label: 'Photosynthesis',
            description: 'Photosynthesis converts light energy into chemical energy.',
            level: 1,
        },
        {
            id: 'respiration',
            label: 'Cellular Respiration',
            description: 'Respiration releases usable energy from glucose.',
            level: 1,
        },
        {
            id: 'light-reactions',
            label: 'Light Reactions',
            description: 'Light reactions capture energy using chlorophyll.',
            level: 2,
        },
    ],
    edges: [
        { source: 'plant-energy', target: 'photosynthesis' },
        { source: 'plant-energy', target: 'respiration' },
        { source: 'photosynthesis', target: 'light-reactions' },
    ],
};

function mockFetch({
    chunks = LONG_CHUNKS,
    groqContent = JSON.stringify(VALID_GRAPH),
    groqStatus = 200,
}: {
    chunks?: object[];
    groqContent?: string;
    groqStatus?: number;
} = {}) {
    const calls: { url: string; body: any }[] = [];

    mock.method(global, 'fetch', async (url: string | URL | Request, options: any) => {
        const urlString = url.toString();
        const body = options?.body ? JSON.parse(options.body) : null;
        calls.push({ url: urlString, body });

        if (urlString.includes('/rest/v1/document_chunks')) {
            return new Response(JSON.stringify(chunks), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        if (urlString.includes('api.groq.com')) {
            if (groqStatus !== 200) {
                return new Response('rate limit exceeded', { status: groqStatus });
            }

            return new Response(
                JSON.stringify({
                    choices: [{ message: { content: groqContent } }],
                }),
                { status: 200, headers: { 'Content-Type': 'application/json' } },
            );
        }

        throw new Error(`Unexpected fetch call: ${urlString}`);
    });

    return calls;
}

describe('generateMindMap', () => {
    afterEach(() => {
        mock.restoreAll();
    });

    it('returns a React Flow-compatible node-link graph on success', async () => {
        const calls = mockFetch();

        const result = await generateMindMap({
            documentId: 'doc-1',
            accessToken: 'fake-token',
        });

        assert.deepEqual(result, VALID_GRAPH);
        assert.equal(result.warning, undefined);
        assert.ok(result.nodes.every((node) => typeof node.description === 'string'));

        const groqCall = calls.find((call) => call.url.includes('api.groq.com'));
        assert.ok(groqCall, 'Groq should be called for long structured documents');
        assert.equal(groqCall.body.model, 'llama-3.1-8b-instant');
        assert.equal(groqCall.body.response_format.type, 'json_object');
        assert.ok(groqCall.body.messages[0].content.includes('return ONLY valid JSON'));
    });

    it('samples representative chunks instead of sending every chunk', async () => {
        const calls = mockFetch();

        await generateMindMap({
            documentId: 'doc-1',
            accessToken: 'fake-token',
        });

        const groqCall = calls.find((call) => call.url.includes('api.groq.com'));
        const prompt = groqCall?.body.messages[0].content as string;
        const sampledChunkCount = prompt.match(/\[Chunk \d+\]/g)?.length ?? 0;

        assert.ok(prompt.includes('[Chunk 0]'));
        assert.ok(prompt.includes('[Chunk 15]'));
        assert.ok(sampledChunkCount <= 12, 'prompt should cap sampled chunks');
        assert.ok(sampledChunkCount < LONG_CHUNKS.length, 'prompt should omit some chunks');
    });

    it('returns a flat key-term graph with a warning for short documents', async () => {
        mockFetch({
            chunks: [
                {
                    content: 'Brief notes on mitosis and meiosis.',
                    chunk_index: 0,
                    heading: null,
                    key_terms: ['mitosis', 'meiosis'],
                },
            ],
        });

        const result = await generateMindMap({
            documentId: 'doc-short',
            accessToken: 'fake-token',
        });

        assert.match(result.warning ?? '', /too short/);
        assert.deepEqual(result.edges, []);
        const labels = result.nodes.map((node) => node.label);
        assert.ok(labels.includes('Mitosis'));
        assert.ok(labels.includes('Meiosis'));
        assert.ok(result.nodes.every((node) => node.level === 1));
    });

    it('returns a flat key-term graph with a warning when Groq finds no hierarchy', async () => {
        mockFetch({
            groqContent: JSON.stringify({
                nodes: [
                    {
                        id: 'chloroplasts',
                        label: 'Chloroplasts',
                        description: 'Chloroplasts are key plant cell structures.',
                        level: 1,
                    },
                    {
                        id: 'glucose',
                        label: 'Glucose',
                        description: 'Glucose stores chemical energy.',
                        level: 1,
                    },
                ],
                edges: [],
            }),
        });

        const result = await generateMindMap({
            documentId: 'doc-unstructured',
            accessToken: 'fake-token',
        });

        assert.match(result.warning ?? '', /enough clear structure/);
        assert.deepEqual(result.edges, []);
        assert.ok(result.nodes.length > 0);
        assert.ok(result.nodes.every((node) => node.level === 1));
    });

    it('throws if Groq returns invalid JSON', async () => {
        mockFetch({ groqContent: 'not json' });

        await assert.rejects(
            () =>
                generateMindMap({
                    documentId: 'doc-1',
                    accessToken: 'fake-token',
                }),
            /invalid JSON/,
        );
    });

    it('throws if Groq API returns an error status', async () => {
        mockFetch({ groqStatus: 429 });

        await assert.rejects(
            () =>
                generateMindMap({
                    documentId: 'doc-1',
                    accessToken: 'fake-token',
                }),
            /Groq API error/,
        );
    });
});
