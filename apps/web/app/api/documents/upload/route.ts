import { NextRequest } from 'next/server';
import { handleDocumentUpload } from '@/lib/document-upload';
import { getDocumentQueue, getDocumentQueueHealth } from '@/lib/queue';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  return handleDocumentUpload(req, {
    createSupabaseClient: createClient,
    getDocumentQueue,
    getDocumentQueueHealth,
    generateDocumentId: crypto.randomUUID,
  });
}
