import { NextRequest } from 'next/server';
import { handleDocumentList } from '@/lib/document-list';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
    return handleDocumentList(req, { createSupabaseClient: createClient });
}
