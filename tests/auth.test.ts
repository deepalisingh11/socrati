import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    handleSignOut,
    handleSessionExpiry,
    handleAuthCallback,
    getInitials,
    getShortName,
} from '../apps/web/lib/auth';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSignOutDeps(options?: { signOutError?: { message: string } | null }) {
    const redirects: string[] = [];
    const logs: string[] = [];
    return {
        deps: {
            async signOut() { return { error: options?.signOutError ?? null }; },
            redirect(path: string) { redirects.push(path); },
            log(msg: string) { logs.push(msg); },
        },
        redirects,
        logs,
    };
}

function makeCallbackDeps(options?: {
    user?: { email?: string } | null;
    exchangeError?: { message: string } | null;
    allowedDomains?: string[];
}) {
    const signOuts: number[] = [];
    return {
        deps: {
            async exchangeCodeForSession(_code: string) {
                if (options?.exchangeError) {
                    return { data: { user: null }, error: options.exchangeError };
                }
                return {
                    data: { user: options?.user !== undefined ? options.user : { email: 'student@umass.edu' } },
                    error: null,
                };
            },
            async signOut() { signOuts.push(1); },
            isAllowedDomain(email: string) {
                const domains = options?.allowedDomains ?? ['umass.edu'];
                const domain = email.split('@')[1]?.toLowerCase();
                return domains.includes(domain ?? '');
            },
        },
        signOuts,
    };
}

// ── handleSignOut ─────────────────────────────────────────────────────────────

describe('handleSignOut', () => {
    it('redirects to /auth on success', async () => {
        const { deps, redirects } = makeSignOutDeps();
        await handleSignOut(deps);
        assert.deepEqual(redirects, ['/auth']);
    });

    it('emits initiated and successful log lines on success', async () => {
        const { deps, logs } = makeSignOutDeps();
        await handleSignOut(deps);
        assert.ok(logs.some(l => l.includes('[auth]') && l.includes('sign out initiated')));
        assert.ok(logs.some(l => l.includes('[auth]') && l.includes('sign out successful')));
    });

    it('logs the error message and does not log successful when signOut fails', async () => {
        const { deps, logs } = makeSignOutDeps({ signOutError: { message: 'network timeout' } });
        await handleSignOut(deps);
        assert.ok(logs.some(l => l.includes('[auth]') && l.includes('sign out error') && l.includes('network timeout')));
        assert.ok(!logs.some(l => l.includes('sign out successful')));
    });

    it('still redirects to /auth even when signOut fails', async () => {
        const { deps, redirects } = makeSignOutDeps({ signOutError: { message: 'fail' } });
        await handleSignOut(deps);
        assert.deepEqual(redirects, ['/auth']);
    });

    it('redirects to exactly /auth — no trailing slash or query string', async () => {
        const { deps, redirects } = makeSignOutDeps();
        await handleSignOut(deps);
        assert.equal(redirects[0], '/auth');
    });

    it('calls signOut exactly once', async () => {
        let count = 0;
        const { deps } = makeSignOutDeps();
        const original = deps.signOut;
        deps.signOut = async () => { count++; return original(); };
        await handleSignOut(deps);
        assert.equal(count, 1);
    });

    it('does not redirect more than once', async () => {
        const { deps, redirects } = makeSignOutDeps();
        await handleSignOut(deps);
        assert.equal(redirects.length, 1);
    });

    it('signOut executes before redirect', async () => {
        const order: string[] = [];
        await handleSignOut({
            async signOut() { order.push('signOut'); return { error: null }; },
            redirect(p) { order.push(`redirect:${p}`); },
            log() {},
        });
        assert.deepEqual(order, ['signOut', 'redirect:/auth']);
    });

    it('all log lines carry the [auth] prefix', async () => {
        const { deps, logs } = makeSignOutDeps();
        await handleSignOut(deps);
        assert.ok(logs.length > 0);
        assert.ok(logs.every(l => l.startsWith('[auth]')));
    });
});

// ── handleSessionExpiry ───────────────────────────────────────────────────────

describe('handleSessionExpiry', () => {
    it('redirects to /auth with a session-expired error param', () => {
        const redirects: string[] = [];
        handleSessionExpiry({ redirect: p => redirects.push(p), log: () => {} });
        assert.equal(redirects.length, 1);
        assert.ok(redirects[0]?.startsWith('/auth?error='));
    });

    it('decoded error param contains "Session expired"', () => {
        const redirects: string[] = [];
        handleSessionExpiry({ redirect: p => redirects.push(p), log: () => {} });
        const decoded = decodeURIComponent(redirects[0] ?? '');
        assert.ok(decoded.includes('Session expired'));
    });

    it('logs a [auth] prefixed expiry message', () => {
        const logs: string[] = [];
        handleSessionExpiry({ redirect: () => {}, log: m => logs.push(m) });
        assert.ok(logs.length > 0);
        assert.ok(logs.every(l => l.startsWith('[auth]')));
        assert.ok(logs.some(l => l.includes('session expired')));
    });

    it('redirects exactly once', () => {
        const redirects: string[] = [];
        handleSessionExpiry({ redirect: p => redirects.push(p), log: () => {} });
        assert.equal(redirects.length, 1);
    });

    it('error query param round-trips through encodeURIComponent', () => {
        const redirects: string[] = [];
        handleSessionExpiry({ redirect: p => redirects.push(p), log: () => {} });
        const url = new URL(redirects[0] ?? '', 'http://x');
        const errorParam = url.searchParams.get('error') ?? '';
        assert.ok(errorParam.length > 0);
        assert.ok(errorParam.includes('Session expired'));
    });
});

// ── handleAuthCallback ────────────────────────────────────────────────────────

describe('handleAuthCallback', () => {
    it('redirects to origin/auth?error=... when error param is present', async () => {
        const { deps } = makeCallbackDeps();
        const dest = await handleAuthCallback(
            { error: 'access_denied', origin: 'https://app.test' },
            deps,
        );
        assert.ok(dest.startsWith('https://app.test/auth?error='));
        assert.ok(dest.includes('access_denied'));
    });

    it('redirects to /auth?error=missing_code when code is absent', async () => {
        const { deps } = makeCallbackDeps();
        const dest = await handleAuthCallback({ origin: 'https://app.test' }, deps);
        assert.equal(dest, 'https://app.test/auth?error=missing_code');
    });

    it('redirects to /session/new by default after successful exchange', async () => {
        const { deps } = makeCallbackDeps();
        const dest = await handleAuthCallback(
            { code: 'abc', origin: 'https://app.test' },
            deps,
        );
        assert.equal(dest, 'https://app.test/session/new');
    });

    it('honours the next param after successful exchange', async () => {
        const { deps } = makeCallbackDeps();
        const dest = await handleAuthCallback(
            { code: 'abc', next: '/progress', origin: 'https://app.test' },
            deps,
        );
        assert.equal(dest, 'https://app.test/progress');
    });

    it('redirects to /auth?error=... when code exchange fails', async () => {
        const { deps } = makeCallbackDeps({ exchangeError: { message: 'token expired' } });
        const dest = await handleAuthCallback(
            { code: 'bad', origin: 'https://app.test' },
            deps,
        );
        assert.ok(dest.startsWith('https://app.test/auth?error='));
        assert.ok(decodeURIComponent(dest).includes('token expired'));
    });

    it('calls signOut and redirects to /auth/restricted for disallowed domain', async () => {
        const { deps, signOuts } = makeCallbackDeps({
            user: { email: 'hacker@gmail.com' },
        });
        const dest = await handleAuthCallback(
            { code: 'abc', origin: 'https://app.test' },
            deps,
        );
        assert.equal(dest, 'https://app.test/auth/restricted');
        assert.equal(signOuts.length, 1);
    });

    it('does not call signOut for allowed domain', async () => {
        const { deps, signOuts } = makeCallbackDeps();
        await handleAuthCallback({ code: 'abc', origin: 'https://app.test' }, deps);
        assert.equal(signOuts.length, 0);
    });

    it('redirects to /auth/restricted when user email is empty', async () => {
        const { deps } = makeCallbackDeps({ user: { email: '' } });
        const dest = await handleAuthCallback(
            { code: 'abc', origin: 'https://app.test' },
            deps,
        );
        assert.equal(dest, 'https://app.test/auth/restricted');
    });

    it('redirects to /auth/restricted when user is null after exchange', async () => {
        const { deps } = makeCallbackDeps({ user: null });
        const dest = await handleAuthCallback(
            { code: 'abc', origin: 'https://app.test' },
            deps,
        );
        assert.equal(dest, 'https://app.test/auth/restricted');
    });

    it('error param takes precedence over code', async () => {
        const { deps } = makeCallbackDeps();
        const dest = await handleAuthCallback(
            { code: 'abc', error: 'oauth_error', origin: 'https://app.test' },
            deps,
        );
        assert.ok(dest.includes('oauth_error'));
        assert.ok(!dest.includes('session/new'));
    });
});

// ── getInitials ───────────────────────────────────────────────────────────────

describe('getInitials', () => {
    it('returns first two letters uppercased for a single name', () => {
        assert.equal(getInitials('deepali'), 'DE');
    });

    it('returns first-letter + last-letter for two names', () => {
        assert.equal(getInitials('Sagnik Chatterjee'), 'SC');
    });

    it('uses first and last word only for three-part names', () => {
        assert.equal(getInitials('J K Rowling'), 'JR');
    });

    it('handles leading/trailing whitespace', () => {
        assert.equal(getInitials('  Alice Bob  '), 'AB');
    });

    it('uppercases regardless of input case', () => {
        assert.equal(getInitials('alice bob'), 'AB');
    });

    it('returns empty string for empty input', () => {
        assert.equal(getInitials(''), '');
    });

    it('returns empty string for whitespace-only input', () => {
        assert.equal(getInitials('   '), '');
    });
});

// ── getShortName ──────────────────────────────────────────────────────────────

describe('getShortName', () => {
    it('formats two-part name as "First L."', () => {
        assert.equal(getShortName('Sagnik Chatterjee'), 'Sagnik C.');
    });

    it('returns single name unchanged', () => {
        assert.equal(getShortName('Deepali'), 'Deepali');
    });

    it('uses first and last word for three-part names', () => {
        assert.equal(getShortName('Mary Jane Watson'), 'Mary W.');
    });

    it('preserves original casing of first name', () => {
        assert.equal(getShortName('alice bob'), 'alice b.');
    });
});