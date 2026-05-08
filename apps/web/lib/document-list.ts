import { logDocumentError, logDocumentEvent } from './document-logger';

type SupabaseError = {
    message: string;
};

type SupabaseUser = {
    id: string;
};

export type DocumentRow = {
    document_id: string;
    title: string;
    file_type: string;
    parse_status: string;
    uploaded_at: string;
};

type QueryResult = PromiseLike<{
    data: DocumentRow[] | null;
    error: SupabaseError | null;
}>;

type ListSupabaseClientLike = {
    auth: {
        getUser(): Promise<{
            data: { user: SupabaseUser | null };
            error?: SupabaseError | null;
        }>;
    };
    from(table: string): {
        select(columns: string): {
            order(column: string, options: { ascending: boolean }): QueryResult;
        };
    };
};

export type ListDependencies = {
    createSupabaseClient(): Promise<ListSupabaseClientLike>;
};

export async function handleDocumentList(
    _req: Request,
    deps: ListDependencies,
) {
    const supabase = await deps.createSupabaseClient();
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        logDocumentEvent('list', 'unauthorized request', {
            hasAuthError: Boolean(authError),
            hasUser: Boolean(user),
        });
        return Response.json({ message: 'Unauthorized' }, { status: 401 });
    }

    logDocumentEvent('list', 'fetching documents', { userId: user.id });

    const { data: documents, error: queryError } = await supabase
        .from('documents')
        .select('document_id, title, file_type, parse_status, uploaded_at')
        .order('uploaded_at', { ascending: false });

    if (queryError) {
        logDocumentError('list', 'query failed', queryError, { userId: user.id });
        return Response.json({ message: queryError.message }, { status: 500 });
    }

    logDocumentEvent('list', 'documents fetched', {
        userId: user.id,
        count: documents?.length ?? 0,
    });

    return Response.json({ documents: documents ?? [] });
}
