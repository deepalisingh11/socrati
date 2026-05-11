'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { ChatContainer } from '@/components/chat/ChatContainer';

type SessionDocument = {
    document_id: string;
    title: string;
    file_type: string;
    parse_status: string;
};

type SessionMessage = {
    message_id: string;
    role: 'user' | 'assistant';
    content: string;
    created_at: string;
};

type SessionData = {
    session_id: string;
    user_id: string;
    document_ids: string[];
    created_at: string;
};

export default function SessionPage() {
    const { sessionId } = useParams<{ sessionId: string }>();
    const [session, setSession] = useState<SessionData | null>(null);
    const [documents, setDocuments] = useState<SessionDocument[]>([]);
    const [messages, setMessages] = useState<SessionMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch(`/api/sessions/${sessionId}`)
            .then(async (res) => {
                if (!res.ok) {
                    const body = await res
                        .json()
                        .catch(() => ({ message: 'Failed to load session' }));
                    throw new Error(
                        (body as { message?: string }).message ?? 'Failed to load session',
                    );
                }
                return res.json() as Promise<{
                    session: SessionData;
                    documents: SessionDocument[];
                    messages: SessionMessage[];
                }>;
            })
            .then(({ session, documents, messages }) => {
                setSession(session);
                setDocuments(documents);
                setMessages(messages);
            })
            .catch((err: unknown) => {
                setError(err instanceof Error ? err.message : 'Failed to load session');
            })
            .finally(() => setLoading(false));
    }, [sessionId]);

    const docCount = documents.length;

    return (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
            <Sidebar />
            <main
                style={{
                    flex: 1,
                    background: 'var(--main)',
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                {/* Header */}
                <div style={{ padding: '20px 24px 15px', borderBottom: '1px solid var(--b1)' }}>
                    <h1
                        style={{
                            fontSize: 20,
                            fontWeight: 600,
                            color: 'var(--td)',
                            letterSpacing: '-0.2px',
                        }}
                    >
                        Study session
                    </h1>
                    <p style={{ fontSize: 12, color: 'var(--t3)', marginTop: 3 }}>
                        {loading
                            ? 'Loading…'
                            : error
                              ? 'Error loading session'
                              : `${docCount} document${docCount !== 1 ? 's' : ''} · Ask questions about your materials`}
                    </p>
                </div>

                {/* Body */}
                <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                    {/* Document list panel */}
                    <div
                        style={{
                            width: 256,
                            borderRight: '1px solid var(--b1)',
                            padding: '16px 14px',
                            overflowY: 'auto',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 6,
                        }}
                    >
                        <div
                            style={{
                                fontSize: 10,
                                fontWeight: 500,
                                color: 'var(--t3)',
                                letterSpacing: '.07em',
                                textTransform: 'uppercase',
                                marginBottom: 4,
                            }}
                        >
                            Documents
                        </div>

                        {loading && (
                            <div style={{ fontSize: 13, color: 'var(--t3)' }}>Loading…</div>
                        )}

                        {error && (
                            <div style={{ fontSize: 13, color: '#8a4a40' }}>{error}</div>
                        )}

                        {documents.map((doc) => (
                            <div
                                key={doc.document_id}
                                style={{
                                    padding: '8px 10px',
                                    borderRadius: 8,
                                    background: 'var(--card)',
                                    border: '1px solid var(--b1)',
                                    fontSize: 13,
                                    color: 'var(--td)',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                }}
                                title={doc.title}
                            >
                                {doc.title}
                            </div>
                        ))}
                    </div>

                    {/* Chat area */}
                    {!loading && !error && session ? (
                        <ChatContainer 
                            sessionId={sessionId} 
                            documentIds={documents.map(d => d.document_id)}
                            documents={documents.map((document) => ({
                                document_id: document.document_id,
                                title: document.title,
                            }))}
                            initialMessages={messages.map(m => ({
                                id: m.message_id,
                                role: m.role,
                                content: m.content
                            })) as any}
                        />
                    ) : (
                        <div
                            style={{
                                flex: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--t3)',
                            }}
                        >
                            {loading ? 'Loading...' : error ? error : ''}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
