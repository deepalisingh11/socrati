import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fetchUserSessions } from '../apps/web/lib/sessions-list';
import type { SupabaseClient } from '@supabase/supabase-js';

// Helper to mock Supabase for the sessions-list fetcher
function createMockSupabase(options: {
    sessions?: any[];
    sessionsError?: any;
    documents?: any[];
    docsError?: any;
}) {
    return {
        from(table: string) {
            return {
                select() {
                    return {
                        eq(col: string, val: string) {
                            return {
                                order() {
                                    return {
                                        data: options.sessions !== undefined ? options.sessions : null,
                                        error: options.sessionsError || null
                                    };
                                }
                            };
                        },
                        in(col: string, vals: string[]) {
                            return {
                                data: options.documents !== undefined ? options.documents : null,
                                error: options.docsError || null
                            };
                        }
                    };
                }
            };
        }
    } as unknown as SupabaseClient;
}

describe('fetchUserSessions', () => {
    it('fetches sessions and maps document titles correctly', async () => {
        const mockSessions = [
            { session_id: 'sess-1', user_id: 'user-1', document_ids: ['doc-1', 'doc-2'], created_at: '2025-01-01' },
            { session_id: 'sess-2', user_id: 'user-1', document_ids: ['doc-3'], created_at: '2025-01-02' }
        ];
        const mockDocuments = [
            { document_id: 'doc-1', title: 'Biology Notes' },
            { document_id: 'doc-2', title: 'Chemistry Notes' },
            { document_id: 'doc-3', title: 'Physics Notes' }
        ];

        const supabase = createMockSupabase({ sessions: mockSessions, documents: mockDocuments });
        const { sessions, error } = await fetchUserSessions(supabase, 'user-1');

        assert.equal(error, null);
        assert.equal(sessions.length, 2);
        
        // Assert first session
        assert.equal(sessions[0].session_id, 'sess-1');
        assert.deepEqual(sessions[0].titles, ['Biology Notes', 'Chemistry Notes']);
        
        // Assert second session
        assert.equal(sessions[1].session_id, 'sess-2');
        assert.deepEqual(sessions[1].titles, ['Physics Notes']);
    });

    it('returns empty array when user has no sessions', async () => {
        const supabase = createMockSupabase({ sessions: [] });
        const { sessions, error } = await fetchUserSessions(supabase, 'user-1');

        assert.equal(error, null);
        assert.equal(sessions.length, 0);
    });

    it('handles missing documents gracefully by returning Unknown Document', async () => {
        const mockSessions = [
            { session_id: 'sess-1', user_id: 'user-1', document_ids: ['doc-1'], created_at: '2025-01-01' },
        ];
        // Empty documents array simulating a deleted document
        const supabase = createMockSupabase({ sessions: mockSessions, documents: [] });
        const { sessions, error } = await fetchUserSessions(supabase, 'user-1');

        assert.equal(error, null);
        assert.equal(sessions[0].titles[0], 'Unknown Document');
    });

    it('returns an error when the sessions query fails', async () => {
        const supabase = createMockSupabase({ sessionsError: { message: 'Database connection failed' } });
        const { sessions, error } = await fetchUserSessions(supabase, 'user-1');

        assert.equal(error, 'Database connection failed');
        assert.equal(sessions.length, 0);
    });

    it('returns an error when the documents query fails', async () => {
        const mockSessions = [
            { session_id: 'sess-1', user_id: 'user-1', document_ids: ['doc-1'], created_at: '2025-01-01' },
        ];
        const supabase = createMockSupabase({ sessions: mockSessions, docsError: { message: 'Failed to fetch documents' } });
        const { sessions, error } = await fetchUserSessions(supabase, 'user-1');

        assert.equal(error, 'Failed to fetch documents');
        assert.equal(sessions.length, 0);
    });
});
