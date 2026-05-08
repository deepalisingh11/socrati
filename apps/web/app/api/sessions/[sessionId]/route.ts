import { NextRequest } from 'next/server';
import { handleSessionGet, type GetSessionDeps } from '@/lib/session-get';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ sessionId: string }> },
) {
    const { sessionId } = await params;
    // The Supabase ssr client satisfies GetSupabaseClientLike at runtime; the cast
    // avoids TypeScript's type-instantiation depth limit on complex query builder generics.
    return handleSessionGet(req, sessionId, {
        createSupabaseClient: createClient as unknown as GetSessionDeps['createSupabaseClient'],
    });
}