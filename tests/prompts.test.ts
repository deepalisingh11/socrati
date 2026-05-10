import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildSystemPrompt } from '../apps/web/lib/prompts';

describe('System Prompt Builder', () => {
    it('injects context correctly when provided', () => {
        const context = 'This is a test document excerpt about mitosis.';
        const prompt = buildSystemPrompt(context);
        
        assert.ok(prompt.includes('You are a Socratic tutor.'), 'Should include tutor persona');
        assert.ok(prompt.includes('Here are the most relevant excerpts'), 'Should include context intro');
        assert.ok(prompt.includes(context), 'Should inject the actual context text');
        assert.ok(prompt.includes('Never state the answer outright.'), 'Should include Socratic rules');
    });

    it('handles empty context gracefully', () => {
        const context = '   \n  ';
        const prompt = buildSystemPrompt(context);
        
        assert.ok(prompt.includes('You are a Socratic tutor.'));
        assert.ok(prompt.includes('No relevant document context was found'), 'Should acknowledge empty context');
    });
});
