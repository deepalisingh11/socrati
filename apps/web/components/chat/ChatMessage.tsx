import type { UIMessage } from 'ai';

export function ChatMessage({ message }: { message: UIMessage }) {
    const isUser = message.role === 'user';

    // ai v6: streamed assistant messages might use `parts`, but DB hydrated messages use `content`
    const text = isUser
        ? ((message as any).content as string)
        : ((message as any).parts as { type: string; text?: string }[] | undefined)
            ?.filter((p: any) => p.type === 'text')
            .map((p: any) => p.text ?? '')
            .join('') || ((message as any).content as string) || '';

    // Detect and strip hidden web search signal
    const WEB_SEARCH_TAG = '<!-- web_search_used -->';
    const hasSearchTag = text.includes(WEB_SEARCH_TAG);
    const cleanedText = text.replace(WEB_SEARCH_TAG, '').trim();

    // Server sends annotation in some versions, or we use the text tag as a fallback
    const webSearchUsed = hasSearchTag || (message as any).annotations?.some((a: any) => a.webSearchUsed === true);

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
                {webSearchUsed && (
                    <div style={{
                        fontSize: 11,
                        padding: '4px 8px',
                        background: 'var(--b1)',
                        borderRadius: 6,
                        marginBottom: text ? 10 : 0,
                        color: 'var(--ts)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        fontWeight: 500,
                        border: '1px solid var(--b2)'
                    }}>
                        🌐 Web Search Used
                    </div>
                )}
                {cleanedText}
            </div>
        </div>
    );
}

