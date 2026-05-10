import { retrieveContext } from '@/lib/rag';
import { loadEnvFiles } from '@/lib/load-env';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
    const body = await req.json();
    const { messages, documentIds } = body;
    
    // 🔎 DIAGNOSTIC: Print EVERY key in the body to find where documentIds goes
    console.log("\n🔎 FULL BODY KEYS:", Object.keys(body));
    console.log("🔎 documentIds:", documentIds);
    
    const lastMessage = messages[messages.length - 1];
    
    // Quick local verification: Fetch RAG chunks
    if (lastMessage && lastMessage.role === 'user') {
        try {
            loadEnvFiles();
            
            // Get the authenticated user's access token so RLS works correctly
            const cookieStore = await cookies();
            const supabase = createServerClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                { cookies: { getAll: () => cookieStore.getAll() } }
            );
            const { data: { session } } = await supabase.auth.getSession();
            const accessToken = session?.access_token;
            
            console.log("\n=======================================================");
            console.log("🔍 FETCHING RAG CONTEXT FOR: ", lastMessage.content);
            console.log("📄 USING DOCUMENT IDS: ", documentIds);
            console.log("🔑 HAS ACCESS TOKEN: ", !!accessToken);
            const context = await retrieveContext(lastMessage.content, documentIds || [], accessToken);

            console.log("==================== RESULTS ==========================");
            console.log(context || "No relevant chunks found.");
            console.log("=======================================================\n");
        } catch (e) {
            console.error("RAG Test Error:", e);
        }
    }

    // Check if this is the first interaction
    const isFirstMessage = !messages || messages.length === 0;
    
    const mockResponseText = isFirstMessage 
        ? "I've looked through your uploaded material. Before we dive in — what topic feels least solid to you right now?"
        : "That's an interesting perspective! To help me understand your thought process better, how does that connect back to the main themes in the document?";

    // Create a native ReadableStream to simulate a typing effect
    const stream = new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder();
            const words = mockResponseText.split(' ');
            
            for (const word of words) {
                // Send the word plus a space
                controller.enqueue(encoder.encode(word + ' '));
                // Wait 50ms to simulate the AI "thinking" and streaming
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            controller.close();
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
        }
    });
}
