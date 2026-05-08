import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { EmbeddedChunk } from './embedder';

export type ParseStatus = 'pending' | 'processing' | 'ready' | 'failed';

let serviceClient: SupabaseClient | undefined;

function getServiceClient() {
    if (serviceClient) return serviceClient;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error(
            'Supabase service credentials are missing. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
        );
    }

    serviceClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    });

    return serviceClient;
}

export async function createDocument(params: {
    id: string;
    userId: string;
    title: string;
    fileType: string;
}) {
    const { error } = await getServiceClient().from('documents').insert({
        document_id: params.id,
        user_id: params.userId,
        title: params.title,
        file_type: params.fileType,
        parse_status: 'pending',
    });

    if (error) {
        throw new Error(`createDocument failed: ${error.message}`);
    }
}

export async function updateParseStatus(
    documentId: string,
    status: ParseStatus,
    errorMessage?: string,
) {
    const { error } = await getServiceClient()
        .from('documents')
        .update({
            parse_status: status,
            error_message: errorMessage ?? null,
        })
        .eq('document_id', documentId);

    if (error) {
        throw new Error(`updateParseStatus failed: ${error.message}`);
    }
}

export async function saveChunks(documentId: string, chunks: EmbeddedChunk[]) {
    if (chunks.length === 0) return;

    const rows = chunks.map((chunk) => ({
        document_id: documentId,
        chunk_index: chunk.chunkIndex,
        content: chunk.content,
        heading: chunk.heading,
        key_terms: chunk.keyTerms,
        embedding: chunk.embedding,
    }));

    const { error } = await getServiceClient().from('document_chunks').insert(rows);

    if (error) {
        throw new Error(`saveChunks failed: ${error.message}`);
    }
}
