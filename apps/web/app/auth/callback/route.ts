import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAllowedDomain } from '@/lib/supabase/domains';

// Handles both email-confirmation links and OAuth (Google) redirects.
// Supabase appends ?code=... after the provider redirects back here.
export async function GET(request: NextRequest) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');
    const next = searchParams.get('next') ?? '/session/new';
    const error = searchParams.get('error');

    if (error) {
        return NextResponse.redirect(`${origin}/auth?error=${encodeURIComponent(error)}`);
    }

    if (code) {
        const supabase = await createClient();
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

        if (exchangeError) {
            return NextResponse.redirect(
                `${origin}/auth?error=${encodeURIComponent(exchangeError.message)}`,
            );
        }

        const email = data.user?.email ?? '';
        if (!isAllowedDomain(email)) {
            await supabase.auth.signOut();
            return NextResponse.redirect(`${origin}/auth/restricted`);
        }

        return NextResponse.redirect(`${origin}${next}`);
    }

    return NextResponse.redirect(`${origin}/auth?error=missing_code`);
}