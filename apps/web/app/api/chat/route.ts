import { retrieveContext } from '@/lib/rag';
import { buildSystemPrompt } from '@/lib/prompts';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { streamText } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { loadEnvFiles } from '@/lib/load-env';
import { performWebSearch } from '@/lib/web-agent';

export async function POST(req: Request) {
    loadEnvFiles();
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

    console.log("📥 [RAW MESSAGES FROM CLIENT]:", JSON.stringify(messages, null, 2));

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

    // If RAG returned nothing, call Tavily directly — no LLM tool calling needed
    let webSearchResults = '';
    let webSearchUsed = false;
    if (!context.trim() && lastUserMessage) {
        console.log(`\n🌐 [WEB AGENT] RAG returned 0 chunks. Searching for: "${lastUserMessage.content}"`);
        webSearchResults = await performWebSearch(lastUserMessage.content);
        webSearchUsed = true;
        console.log(`✅ [WEB AGENT] Search complete. Results preview:\n${webSearchResults.substring(0, 300)}...\n`);
    }

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

    // Convert UIMessage[] → CoreMessage[] for Groq
    // assistant messages may use parts[] (streaming) or content string (hydrated from DB)
    const modelMessages = (messages as any[])
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => {
            const isUser = m.role === 'user';
            const text = isUser
                ? (m.content as string)
                : (m.parts as { type: string; text?: string }[] | undefined)
                    ?.filter((p: any) => p.type === 'text')
                    .map((p: any) => p.text ?? '')
                    .join('') || (m.content as string) || '';
            return { role: m.role as 'user' | 'assistant', content: text };
        });

    console.log("📝 [CORE MESSAGES]:", JSON.stringify(modelMessages, null, 2));

    // Stream Socratic response from Groq (Llama 3.3 70B)
    const groq = createGroq({ apiKey: process.env.GROQ_API_KEY! });

    const result = streamText({
        // Use the larger model if web results are involved to ensure the hidden tag is included
        model: webSearchUsed ? groq('llama-3.3-70b-versatile') : groq('llama-3.1-8b-instant'),
        system: buildSystemPrompt(context, webSearchResults || undefined),
        messages: modelMessages,
        onFinish: async ({ text }) => {
            if (userId && sessionId && text) {
                console.log("⏳ AWAITING DB INSERT FOR ASSISTANT MESSAGE...");
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

    console.log("🚀 [STREAM] Sending UI message stream to client...");
    return result.toUIMessageStreamResponse();
}
