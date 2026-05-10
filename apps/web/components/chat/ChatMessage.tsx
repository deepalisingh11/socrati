import type { UIMessage } from 'ai';

export function ChatMessage({ message }: { message: UIMessage }) {
    const isUser = message.role === 'user';

    // ai v6: user messages use `content` (string), assistant messages use `parts` (array)
    const text = isUser
        ? (message.content as string)
        : (message.parts as { type: string; text?: string }[] | undefined)
            ?.filter((p) => p.type === 'text')
            .map((p) => p.text ?? '')
            .join('') ?? '';

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
                {text}
            </div>
        </div>
    );
}
