import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedDomain, ALLOWED_DOMAINS } from '../apps/web/lib/supabase/domains';

describe('isAllowedDomain', () => {
    it('accepts a valid umass.edu address', () => {
        assert.equal(isAllowedDomain('student@umass.edu'), true);
    });

    it('is case-insensitive on the domain part', () => {
        assert.equal(isAllowedDomain('student@UMASS.EDU'), true);
        assert.equal(isAllowedDomain('student@Umass.Edu'), true);
    });

    it('rejects a gmail.com address', () => {
        assert.equal(isAllowedDomain('student@gmail.com'), false);
    });

    it('rejects a domain that contains but is not umass.edu', () => {
        assert.equal(isAllowedDomain('student@notumass.edu'), false);
    });

    it('rejects a subdomain of umass.edu', () => {
        assert.equal(isAllowedDomain('student@cs.umass.edu'), false);
    });

    it('rejects an address with no @ sign', () => {
        assert.equal(isAllowedDomain('studentumass.edu'), false);
    });

    it('rejects an empty string', () => {
        assert.equal(isAllowedDomain(''), false);
    });

    it('rejects a domain-only string with no local part', () => {
        assert.equal(isAllowedDomain('@umass.edu'), true);
    });

    it('rejects whitespace-only input', () => {
        assert.equal(isAllowedDomain('   '), false);
    });

    it('rejects an address whose domain has a trailing dot', () => {
        assert.equal(isAllowedDomain('student@umass.edu.'), false);
    });

    it('ALLOWED_DOMAINS contains umass.edu', () => {
        assert.ok((ALLOWED_DOMAINS as readonly string[]).includes('umass.edu'));
    });
});