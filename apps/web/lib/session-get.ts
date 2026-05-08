import { logSessionError, logSessionEvent } from './session-logger';

type SupabaseError = { message: string; code?: string };

type SupabaseUser = { id: string };

export type SessionRow = {
    session_id: string;
    user_id: string;
    document_ids: string[];
    created_at: string;
};

export type SessionDocumentRow = {
    document_id: string;
    title: string;
    file_type: string;
    parse_status: string;
};

type SessionQueryResult = PromiseLike<{
    data: SessionRow | null;
    error: SupabaseError | null;
}>;

type DocumentsQueryResult = PromiseLike<{
    data: SessionDocumentRow[] | null;
    error: SupabaseError | null;
}>;

type GetSupabaseClientLike = {
    auth: {
        getUser(): Promise<{
            data: { user: SupabaseUser | null };
            error?: SupabaseError | null;
        }>;
    };
    from(table: string): {
        select(columns: string): {
            eq(column: string, value: string): {
                single(): SessionQueryResult;
            };
            in(column: string, values: string[]): DocumentsQueryResult;
        };
    };
};

export type GetSessionDeps = {
    createSupabaseClient(): Promise<GetSupabaseClientLike>;
};

export async function handleSessionGet(
    _req: Request,
    sessionId: string,
    deps: GetSessionDeps,
) {
    const startedAt = Date.now();
    logSessionEvent('get', 'request received', { sessionId });

    const supabase = await deps.createSupabaseClient();
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        logSessionEvent('get', 'unauthorized request', {
            sessionId,
            hasAuthError: Boolean(authError),
        });
        return Response.json({ message: 'Unauthorized' }, { status: 401 });
    }

    logSessionEvent('get', 'fetching session', { sessionId, userId: user.id });

    const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .select('session_id, user_id, document_ids, created_at')
        .eq('session_id', sessionId)
        .single();

    if (sessionError) {
        // PGRST116 = no rows found with .single() — treat as 404
        if (sessionError.code === 'PGRST116') {
            logSessionEvent('get', 'session not found', { sessionId });
            return Response.json({ message: 'Session not found' }, { status: 404 });
        }
        logSessionError('get', 'session query failed', sessionError, { sessionId });
        return Response.json({ message: sessionError.message }, { status: 500 });
    }

    if (!session) {
        logSessionEvent('get', 'session not found', { sessionId });
        return Response.json({ message: 'Session not found' }, { status: 404 });
    }

    if (session.document_ids.length === 0) {
        logSessionEvent('get', 'session has no documents', { sessionId });
        return Response.json({ session, documents: [] });
    }

    logSessionEvent('get', 'fetching session documents', {
        sessionId,
        documentCount: session.document_ids.length,
    });

    const { data: documents, error: docsError } = await supabase
        .from('documents')
        .select('document_id, title, file_type, parse_status')
        .in('document_id', session.document_ids);

    if (docsError) {
        logSessionError('get', 'documents query failed', docsError, {
            sessionId,
            documentCount: session.document_ids.length,
        });
        return Response.json({ message: docsError.message }, { status: 500 });
    }

    logSessionEvent('get', 'session fetched', {
        sessionId,
        userId: user.id,
        documentCount: documents?.length ?? 0,
        elapsedMs: Date.now() - startedAt,
    });

    return Response.json({ session, documents: documents ?? [] });
}