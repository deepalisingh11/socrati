import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { WebSocketLikeConstructor } from '@supabase/realtime-js';
import WebSocket from 'ws';
import { logDocumentError, logDocumentEvent } from './document-logger';
import type { EmbeddedChunk } from './embedder';
import { loadEnvFiles } from './load-env';

export type ParseStatus = 'pending' | 'processing' | 'ready' | 'failed';

let serviceClient: SupabaseClient | undefined;

const realtimeOptions = {
    transport: WebSocket as unknown as WebSocketLikeConstructor,
};

function getSupabaseUrl() {
    loadEnvFiles();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!supabaseUrl) {
        throw new Error('NEXT_PUBLIC_SUPABASE_URL is missing.');
    }

    return supabaseUrl;
}

function getServiceClient() {
    loadEnvFiles();

    if (serviceClient) return serviceClient;

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
        throw new Error(
            'SUPABASE_SERVICE_ROLE_KEY is missing.',
        );
    }

    serviceClient = createClient(getSupabaseUrl(), serviceRoleKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
        realtime: realtimeOptions,
    });

    return serviceClient;
}

function getUserClient(accessToken: string) {
    loadEnvFiles();

    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!anonKey) {
        throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is missing.');
    }

    return createClient(getSupabaseUrl(), anonKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
        realtime: realtimeOptions,
        global: {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        },
    });
}

function getWriteClient(accessToken?: string) {
    if (accessToken) {
        return getUserClient(accessToken);
    }

    return getServiceClient();
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
    accessToken?: string,
) {
    logDocumentEvent('repository', 'updating parse status', {
        documentId,
        status,
        hasAccessToken: Boolean(accessToken),
    });

    const { error } = await getWriteClient(accessToken)
        .from('documents')
        .update({
            parse_status: status,
            error_message: errorMessage ?? null,
        })
        .eq('document_id', documentId);

    if (error) {
        logDocumentError('repository', 'update parse status failed', error, {
            documentId,
            status,
        });
        throw new Error(`updateParseStatus failed: ${error.message}`);
    }

    logDocumentEvent('repository', 'parse status updated', {
        documentId,
        status,
    });
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

    const { error } = await getWriteClient().from('document_chunks').insert(rows);

    if (error) {
        throw new Error(`saveChunks failed: ${error.message}`);
    }
}

export async function saveChunksForUser(
    documentId: string,
    chunks: EmbeddedChunk[],
    accessToken: string,
) {
    if (chunks.length === 0) return;

    logDocumentEvent('repository', 'saving chunks for user', {
        documentId,
        chunkCount: chunks.length,
        embeddingDimensions: chunks[0]?.embedding.length ?? 0,
    });

    const rows = chunks.map((chunk) => ({
        document_id: documentId,
        chunk_index: chunk.chunkIndex,
        content: chunk.content,
        heading: chunk.heading,
        key_terms: chunk.keyTerms,
        embedding: chunk.embedding,
    }));

    const { error } = await getWriteClient(accessToken)
        .from('document_chunks')
        .insert(rows);

    if (error) {
        logDocumentError('repository', 'save chunks failed', error, {
            documentId,
            chunkCount: chunks.length,
        });
        throw new Error(`saveChunks failed: ${error.message}`);
    }

    logDocumentEvent('repository', 'chunks saved for user', {
        documentId,
        chunkCount: chunks.length,
    });
}
