export async function POST(req: Request) {
    const { messages } = await req.json();

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
