import { describe, it, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { performWebSearch } from '../apps/web/lib/web-agent';

describe('performWebSearch', () => {
    afterEach(() => {
        mock.restoreAll();
        // Clean up environment to avoid leaking state between tests
        delete process.env.TAVILY_API_KEY;
    });

    it('returns an error notification if TAVILY_API_KEY is missing', async () => {
        const result = await performWebSearch('latest advancements in biology');
        assert.match(result, /TAVILY_API_KEY environment variable is missing/);
    });

    it('formats a successful search payload for the LLM correctly', async () => {
        process.env.TAVILY_API_KEY = 'tvly-test-key';
        
        mock.method(global, 'fetch', async () => {
            return {
                ok: true,
                json: async () => ({
                    answer: 'AlphaFold 3 was recently announced, predicting the structure of all life molecules.',
                    results: [
                        { 
                            title: 'AlphaFold 3 Announcement', 
                            url: 'https://deepmind.google/technologies/alphafold/', 
                            content: 'Google DeepMind and Isomorphic Labs introduce AlphaFold 3.' 
                        }
                    ]
                })
            };
        });

        const result = await performWebSearch('alphafold 3');
        
        // Assert LLM-friendly formatting
        assert.match(result, /Web Search Results for "alphafold 3"/);
        assert.match(result, /Summary: AlphaFold 3 was recently announced/);
        assert.match(result, /1\. AlphaFold 3 Announcement \(https:\/\/deepmind\.google\/technologies\/alphafold\/\)/);
        assert.match(result, /Snippet: Google DeepMind and Isomorphic Labs/);
    });

    it('returns a fallback notification if the search API fails', async () => {
        process.env.TAVILY_API_KEY = 'tvly-test-key';
        
        mock.method(global, 'fetch', async () => {
            return {
                ok: false,
                text: async () => 'Rate limit exceeded'
            };
        });

        const result = await performWebSearch('alphafold 3');
        assert.match(result, /The web search failed with a server error/);
    });

    it('returns a fallback notification if the fetch request aborts due to timeout', async () => {
        process.env.TAVILY_API_KEY = 'tvly-test-key';
        
        mock.method(global, 'fetch', async () => {
            const error = new Error('The operation was aborted');
            error.name = 'AbortError';
            throw error;
        });

        const result = await performWebSearch('alphafold 3');
        assert.match(result, /The web search timed out/);
    });
});
