import { NextRequest } from 'next/server';
import { handleSessionCreate } from '@/lib/session-create';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
    return handleSessionCreate(req, {
        createSupabaseClient: createClient,
        generateSessionId: () => crypto.randomUUID(),
    });
}