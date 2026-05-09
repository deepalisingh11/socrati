import type { Message } from '@ai-sdk/react';

export function ChatMessage({ message }: { message: Message }) {
    const isUser = message.role === 'user';
    
    return (
        <div style={{
            display: 'flex',
            justifyContent: isUser ? 'flex-end' : 'flex-start',
        }}>
            <div style={{
                maxWidth: '70%',
                padding: '11px 15px',
                borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                background: isUser ? 'var(--acc)' : 'var(--card)',
                border: isUser ? 'none' : '1px solid var(--b1)',
                fontSize: 14,
                lineHeight: '1.6',
                color: isUser ? '#eef8f2' : 'var(--td)',
                whiteSpace: 'pre-wrap',
            }}>
                {message.content}
            </div>
        </div>
    );
}
