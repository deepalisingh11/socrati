// ── Sign-out ─────────────────────────────────────────────────────────────────

export type SignOutDeps = {
    signOut: () => Promise<{ error: { message: string } | null }>;
    redirect: (path: string) => void;
    log: (msg: string) => void;
};

export async function handleSignOut(deps: SignOutDeps): Promise<void> {
    deps.log('[auth] sign out initiated');
    const { error } = await deps.signOut();
    if (error) {
        deps.log(`[auth] sign out error: ${error.message}`);
    } else {
        deps.log('[auth] sign out successful');
    }
    deps.redirect('/auth');
}

export function handleSessionExpiry(deps: Pick<SignOutDeps, 'redirect' | 'log'>): void {
    deps.log('[auth] session expired — redirecting to /auth');
    deps.redirect('/auth?error=' + encodeURIComponent('Session expired. Please sign in again.'));
}

// ── Auth callback ─────────────────────────────────────────────────────────────

export type AuthCallbackParams = {
    code?: string | null;
    error?: string | null;
    next?: string | null;
    origin: string;
};

export type AuthCallbackDeps = {
    exchangeCodeForSession: (code: string) => Promise<{
        data: { user: { email?: string } | null };
        error: { message: string } | null;
    }>;
    signOut: () => Promise<void>;
    isAllowedDomain: (email: string) => boolean;
};

export async function handleAuthCallback(
    params: AuthCallbackParams,
    deps: AuthCallbackDeps,
): Promise<string> {
    const { code, error, next = '/session/new', origin } = params;

    if (error) return `${origin}/auth?error=${encodeURIComponent(error)}`;
    if (!code) return `${origin}/auth?error=missing_code`;

    const { data, error: exchangeError } = await deps.exchangeCodeForSession(code);

    if (exchangeError) {
        return `${origin}/auth?error=${encodeURIComponent(exchangeError.message)}`;
    }

    const email = data.user?.email ?? '';
    if (!deps.isAllowedDomain(email)) {
        await deps.signOut();
        return `${origin}/auth/restricted`;
    }

    return `${origin}${next}`;
}

// ── Display helpers ───────────────────────────────────────────────────────────

export function getInitials(name: string): string {
    const parts = name.trim().split(/\s+/);
    const first = parts[0] ?? '';
    const last = parts[parts.length - 1] ?? '';
    if (parts.length === 1) return first.slice(0, 2).toUpperCase();
    return ((first[0] ?? '') + (last[0] ?? '')).toUpperCase();
}

export function getShortName(displayName: string): string {
    const parts = displayName.split(' ');
    if (parts.length === 1) return parts[0] ?? '';
    const lastInitial = (parts[parts.length - 1] ?? '')[0] ?? '';
    return `${parts[0]} ${lastInitial}.`;
}