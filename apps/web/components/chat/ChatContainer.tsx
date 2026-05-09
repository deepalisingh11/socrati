'use client';

import { useChat } from '@ai-sdk/react';
import { useEffect, useRef } from 'react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';

export function ChatContainer({ sessionId }: { sessionId: string }) {
    const { messages, input, handleInputChange, handleSubmit, setInput, isLoading } = useChat({
        api: '/api/chat',
        body: { sessionId },
        initialMessages: [
            {
                id: 'opening-msg',
                role: 'assistant',
                content: "I've looked through your uploaded material. Before we dive in — what topic feels least solid to you right now?"
            }
        ]
    });
    
    const bottomRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    return (
        <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
        }}>
            {/* Header bar from your prototype */}
            <div style={{
                padding: '14px 24px',
                borderBottom: '1px solid var(--b1)',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                background: 'var(--main)',
                flexShrink: 0,
            }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--td)' }}>
                    Tutoring Session
                </div>
                <div style={{
                    fontSize: 11,
                    color: 'var(--t3)',
                    background: 'var(--acl)',
                    padding: '2px 10px',
                    borderRadius: 99,
                }}>
                    Socratic mode
                </div>
            </div>

            {/* Messages Area */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
            }}>
                {messages.map((msg) => (
                    <ChatMessage key={msg.id} message={msg} />
                ))}
                
                {isLoading && messages[messages.length - 1]?.role === 'user' && (
                    <div style={{ fontSize: 13, color: 'var(--t3)', marginLeft: 8 }}>Thinking...</div>
                )}
                
                <div ref={bottomRef} />
            </div>

            {/* Input Area */}
            <ChatInput 
                input={input}
                handleInputChange={handleInputChange}
                handleSubmit={handleSubmit}
                setInput={setInput}
                isLoading={isLoading}
            />
        </div>
    );
}
