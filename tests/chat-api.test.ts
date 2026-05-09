import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { POST } from '../apps/web/app/api/chat/route';

// Helper to construct a mock POST request
function makeRequest(body: unknown): Request {
    return new Request('http://localhost/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

// Helper to read the ReadableStream from the response into a single string
async function readStreamToString(stream: ReadableStream<Uint8Array> | null): Promise<string> {
    if (!stream) return '';
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let result = '';
    
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        result += decoder.decode(value);
    }
    
    return result.trim(); // Trim any trailing spaces from the chunked stream
}

describe('POST /api/chat', () => {
    it('returns the mock Socratic opening question when message history is empty', async () => {
        const req = makeRequest({ messages: [] });
        const res = await POST(req);

        assert.equal(res.status, 200);
        assert.equal(res.headers.get('Content-Type'), 'text/plain; charset=utf-8');

        const text = await readStreamToString(res.body);
        assert.equal(
            text, 
            "I've looked through your uploaded material. Before we dive in — what topic feels least solid to you right now?"
        );
    });

    it('returns the generic mock response when message history has existing messages', async () => {
        const req = makeRequest({ messages: [{ role: 'user', content: 'I need a hint.' }] });
        const res = await POST(req);

        assert.equal(res.status, 200);

        const text = await readStreamToString(res.body);
        assert.equal(
            text,
            "That's an interesting perspective! To help me understand your thought process better, how does that connect back to the main themes in the document?"
        );
    });
});
