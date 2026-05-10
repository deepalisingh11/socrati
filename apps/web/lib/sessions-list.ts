import { SupabaseClient } from '@supabase/supabase-js';

export type SessionWithDocs = {
    session_id: string;
    created_at: string;
    titles: string[];
};

export async function fetchUserSessions(
    supabase: SupabaseClient,
    userId: string
): Promise<{ sessions: SessionWithDocs[]; error: string | null }> {
    try {
        const { data: sessions, error: sessionsError } = await supabase
            .from('sessions')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (sessionsError) {
            return { sessions: [], error: sessionsError.message };
        }

        const sessionList = sessions || [];
        const allDocIds = Array.from(new Set(sessionList.flatMap(s => s.document_ids)));
        
        let docMap = new Map<string, string>();
        if (allDocIds.length > 0) {
            const { data: documents, error: docsError } = await supabase
                .from('documents')
                .select('document_id, title')
                .in('document_id', allDocIds);
                
            if (docsError) {
                return { sessions: [], error: docsError.message };
            }
                
            if (documents) {
                docMap = new Map(documents.map(d => [d.document_id, d.title]));
            }
        }

        const enrichedSessions = sessionList.map(session => ({
            session_id: session.session_id,
            created_at: session.created_at,
            titles: session.document_ids.map((id: string) => docMap.get(id) || 'Unknown Document')
        }));

        return { sessions: enrichedSessions, error: null };
    } catch (err: any) {
        return { sessions: [], error: err.message || 'Unknown error occurred' };
    }
}
