import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAllowedDomain } from '@/lib/supabase/domains';
import { handleAuthCallback } from '@/lib/auth';

export async function GET(request: NextRequest) {
    const { searchParams, origin } = new URL(request.url);
    const supabase = await createClient();

    const destination = await handleAuthCallback(
        {
            code: searchParams.get('code'),
            error: searchParams.get('error'),
            next: searchParams.get('next'),
            origin,
        },
        {
            exchangeCodeForSession: (code) => supabase.auth.exchangeCodeForSession(code),
            signOut: async () => { await supabase.auth.signOut(); },
            isAllowedDomain,
        },
    );

    return NextResponse.redirect(destination);
}