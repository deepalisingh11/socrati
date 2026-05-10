export async function performWebSearch(query: string): Promise<string> {
    
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
        return "System Notification: Web search is currently disabled because the TAVILY_API_KEY environment variable is missing. Please inform the user that you cannot browse the web right now.";
    }

    const controller = new AbortController();
    // 10 second timeout to prevent hanging the chat response
    const timeoutId = setTimeout(() => controller.abort(), 10000); 

    try {
        const response = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                api_key: apiKey,
                query: query,
                search_depth: 'basic',
                include_answer: true,
                max_results: 3
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errText = await response.text();
            console.error("Tavily API error:", errText);
            return `System Notification: The web search failed with a server error. Please rely on your training data and document context.`;
        }

        const data = await response.json();
        
        let resultText = `Web Search Results for "${query}":\n\n`;
        
        if (data.answer) {
            resultText += `Summary: ${data.answer}\n\n`;
        }
        
        if (data.results && data.results.length > 0) {
            resultText += "Sources:\n";
            data.results.forEach((item: any, index: number) => {
                resultText += `${index + 1}. ${item.title} (${item.url})\n`;
                resultText += `   Snippet: ${item.content}\n`;
            });
        } else {
            resultText += "No specific sources found.\n";
        }

        return resultText;

    } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            console.error("Tavily web search timed out after 10 seconds.");
            return "System Notification: The web search timed out. Please rely on your training data and document context.";
        }
        console.error("Tavily web search failed:", error);
        return "System Notification: The web search encountered an error. Please rely on your training data and document context.";
    }
}
