import { retrieveContext } from '@/lib/rag';
import { buildSystemPrompt } from '@/lib/prompts';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { streamText, createUIMessageStream, createUIMessageStreamResponse, generateId } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { loadEnvFiles } from '@/lib/load-env';

export async function POST(req: Request) {
    loadEnvFiles(); // Ensures root .env.local is loaded in the Next.js API route context
    const body = await req.json();
    const { messages, documentIds, sessionId } = body;

    // 🔎 DIAGNOSTIC
    console.log("\n🔎 FULL BODY KEYS:", Object.keys(body));
    console.log("🔎 documentIds:", documentIds);

    // Extract user JWT from cookies so RLS is enforced in retrieveContext
    const cookieStore = await cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { getAll: () => cookieStore.getAll() } }
    );
    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token;

    // Retrieve RAG context for the latest user message
    const lastUserMessage = [...messages].reverse().find((m: { role: string }) => m.role === 'user');
    const context = lastUserMessage
        ? await retrieveContext(lastUserMessage.content, documentIds || [], accessToken)
        : '';

    // Log retrieved chunks to terminal
    console.log("\n=======================================================");
    console.log("🔍 RAG CONTEXT FOR:", lastUserMessage?.content);
    console.log("📄 DOCUMENT IDS:", documentIds);
    console.log("🔑 HAS ACCESS TOKEN:", !!accessToken);
    console.log("==================== CHUNKS ===========================");
    console.log(context || "No relevant chunks found.");
    console.log("=======================================================\n");

    const userId = session?.user?.id;
    console.log("💡 TRYING TO SAVE MESSAGE - userId:", userId, "sessionId:", sessionId, "hasLastMessage:", !!lastUserMessage);

    // Save user message to database
    if (userId && sessionId && lastUserMessage) {
        console.log("⏳ AWAITING DB INSERT FOR USER MESSAGE...");
        const { error } = await supabase.from('messages').insert({
            session_id: sessionId,
            user_id: userId,
            role: 'user',
            content: lastUserMessage.content
        });
        if (error) {
            console.error('🔴 Failed to save user message:', error);
        } else {
            console.log("✅ USER MESSAGE SAVED!");
        }
    }

    // Manually convert UIMessage[] → ModelMessage[]
    // @ai-sdk/react v3 sends mixed format: user messages use `content`, assistant messages use `parts`
    // convertToModelMessages() crashes on this hybrid format, so we handle it ourselves.
    const modelMessages = (messages as any[])
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => {
            if (m.role === 'user') {
                return { role: 'user' as const, content: String(m.content ?? '') };
            }
            // Assistant: extract text from parts array
            const text = (m.parts as any[] | undefined)
                ?.filter((p) => p.type === 'text')
                .map((p) => p.text as string)
                .join('') ?? String(m.content ?? '');
            return { role: 'assistant' as const, content: text };
        })
        .filter((m) => m.content.length > 0);

    // Stream Socratic response from Groq (Llama 3.3 70B)
    const groq = createGroq({ apiKey: process.env.GROQ_API_KEY! });

    const result = streamText({
        model: groq('llama-3.3-70b-versatile'),
        system: buildSystemPrompt(context),
        messages: modelMessages,
        onFinish: async ({ text }) => {
            if (userId && sessionId && text) {
                console.log("⏳ AWAITING DB INSERT FOR ASSISTANT MESSAGE...");
                // Use the already authenticated `supabase` client
                const { error } = await supabase.from('messages').insert({
                    session_id: sessionId,
                    user_id: userId,
                    role: 'assistant',
                    content: text
                });
                if (error) {
                    console.error('🔴 Failed to save assistant message:', error);
                } else {
                    console.log("✅ ASSISTANT MESSAGE SAVED!");
                }
            }
        }
    });

    // Convert to UI Message Stream protocol expected by @ai-sdk/react v3 sendMessage
    const textId = generateId();
    const stream = createUIMessageStream({
        execute: async ({ writer }) => {
            writer.write({ type: 'text-start', id: textId });
            for await (const chunk of result.textStream) {
                writer.write({ type: 'text-delta', delta: chunk, id: textId });
            }
            writer.write({ type: 'text-end', id: textId });
        },
        onError: (error) => {
            console.error('🔴 Stream error:', error);
            return 'An error occurred while generating the response.';
        },
    });

    return createUIMessageStreamResponse({ stream });
}
