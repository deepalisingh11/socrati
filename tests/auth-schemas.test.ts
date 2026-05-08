import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { signupSchema, loginSchema } from '../apps/web/lib/schemas/auth';

// ── signupSchema ──────────────────────────────────────────────────────────────

describe('signupSchema', () => {
    const valid = { name: 'Sagnik Chatterjee', email: 'student@umass.edu', password: 'Password1' };

    it('accepts valid signup data', () => {
        assert.ok(signupSchema.safeParse(valid).success);
    });

    it('rejects a name shorter than 2 characters', () => {
        const r = signupSchema.safeParse({ ...valid, name: 'A' });
        assert.ok(!r.success);
        assert.ok(r.error.issues.some(i => i.path[0] === 'name'));
    });

    it('rejects an email that is not a umass.edu address', () => {
        const r = signupSchema.safeParse({ ...valid, email: 'student@gmail.com' });
        assert.ok(!r.success);
        assert.ok(r.error.issues.some(i => i.path[0] === 'email'));
    });

    it('rejects a malformed email address', () => {
        const r = signupSchema.safeParse({ ...valid, email: 'not-an-email' });
        assert.ok(!r.success);
        assert.ok(r.error.issues.some(i => i.path[0] === 'email'));
    });

    it('rejects a password shorter than 8 characters', () => {
        const r = signupSchema.safeParse({ ...valid, password: 'Pass1' });
        assert.ok(!r.success);
        assert.ok(r.error.issues.some(i => i.path[0] === 'password'));
    });

    it('rejects a password with no uppercase letter', () => {
        const r = signupSchema.safeParse({ ...valid, password: 'password1' });
        assert.ok(!r.success);
        assert.ok(r.error.issues.some(i => i.path[0] === 'password'));
    });

    it('rejects a password with no number', () => {
        const r = signupSchema.safeParse({ ...valid, password: 'PasswordOnly' });
        assert.ok(!r.success);
        assert.ok(r.error.issues.some(i => i.path[0] === 'password'));
    });

    it('rejects when all fields are empty', () => {
        const r = signupSchema.safeParse({ name: '', email: '', password: '' });
        assert.ok(!r.success);
        assert.equal(r.error.issues.length >= 3, true);
    });

    it('rejects a cs.umass.edu subdomain (not in allowed list)', () => {
        const r = signupSchema.safeParse({ ...valid, email: 'student@cs.umass.edu' });
        assert.ok(!r.success);
        assert.ok(r.error.issues.some(i => i.path[0] === 'email'));
    });
});

// ── loginSchema ───────────────────────────────────────────────────────────────

describe('loginSchema', () => {
    const valid = { email: 'student@umass.edu', password: 'anypassword' };

    it('accepts valid login data', () => {
        assert.ok(loginSchema.safeParse(valid).success);
    });

    it('accepts any email domain (login is not domain-restricted)', () => {
        assert.ok(loginSchema.safeParse({ ...valid, email: 'user@gmail.com' }).success);
    });

    it('rejects a malformed email', () => {
        const r = loginSchema.safeParse({ ...valid, email: 'notanemail' });
        assert.ok(!r.success);
        assert.ok(r.error.issues.some(i => i.path[0] === 'email'));
    });

    it('rejects an empty password', () => {
        const r = loginSchema.safeParse({ ...valid, password: '' });
        assert.ok(!r.success);
        assert.ok(r.error.issues.some(i => i.path[0] === 'password'));
    });

    it('rejects an empty email', () => {
        const r = loginSchema.safeParse({ ...valid, email: '' });
        assert.ok(!r.success);
        assert.ok(r.error.issues.some(i => i.path[0] === 'email'));
    });

    it('rejects when both fields are empty', () => {
        const r = loginSchema.safeParse({ email: '', password: '' });
        assert.ok(!r.success);
    });
});