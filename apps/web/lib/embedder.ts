import { Chunk } from "./chunker";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EmbeddedChunk extends Chunk {
    embedding: number[];
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
// Using Google Gemini text-embedding-004 (768 dims), free tier, 1,500 RPM.
// Make sure your Prisma schema has: embedding vector(768)
//
// Set GEMINI_API_KEY in your .env file.
// Set EMBEDDING_MOCK=true in .env to skip API calls during local dev/testing.

const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIM = 3072;
const GEMINI_EMBED_URL = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:batchEmbedContents`;

// Gemini batchEmbedContents supports up to 100 inputs per request.
const BATCH_SIZE = 100;

// ---------------------------------------------------------------------------
// Mock embedding (dev / test)
// ---------------------------------------------------------------------------

function mockEmbedding(text: string): number[] {
    let seed = 0;
    for (let i = 0; i < text.length; i++) seed = (seed * 31 + text.charCodeAt(i)) >>> 0;

    return Array.from({ length: EMBEDDING_DIM }, (_, i) => {
        const x = Math.sin(seed + i) * 10000;
        return x - Math.floor(x);
    });
}

// ---------------------------------------------------------------------------
// Real embedding via Gemini batchEmbedContents API
// ---------------------------------------------------------------------------

async function fetchEmbeddings(texts: string[]): Promise<number[][]> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set in environment.");

    const requests = texts.map((text) => ({
        model: `models/${EMBEDDING_MODEL}`,
        content: { parts: [{ text }] },
    }));

    const response = await fetch(`${GEMINI_EMBED_URL}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requests }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Gemini embeddings API error ${response.status}: ${error}`);
    }

    const data = await response.json();

    // Response shape: { embeddings: [{ values: number[] }, ...] }
    return (data.embeddings as { values: number[] }[]).map((e) => e.values);
}

// ---------------------------------------------------------------------------
// Batch helper
// ---------------------------------------------------------------------------

function batchArray<T>(arr: T[], size: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
        batches.push(arr.slice(i, i + size));
    }
    return batches;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function embedChunks(chunks: Chunk[]): Promise<EmbeddedChunk[]> {
    if (chunks.length === 0) return [];

    const useMock = process.env.EMBEDDING_MOCK === "true";

    if (useMock) {
        console.warn("[embedder] EMBEDDING_MOCK=true — using fake vectors.");
        return chunks.map((chunk) => ({
            ...chunk,
            embedding: mockEmbedding(chunk.content),
        }));
    }

    const batches = batchArray(chunks, BATCH_SIZE);
    const allEmbeddings: number[][] = [];

    for (const batch of batches) {
        const texts = batch.map((c) => c.content);
        const embeddings = await fetchEmbeddings(texts);
        allEmbeddings.push(...embeddings);
    }

    return chunks.map((chunk, i) => ({
        ...chunk,
        embedding: allEmbeddings[i]!,
    }));
}

// ---------------------------------------------------------------------------
// Strict variant — validates dimensions before anything touches the DB
// ---------------------------------------------------------------------------

export async function embedChunksStrict(chunks: Chunk[]): Promise<EmbeddedChunk[]> {
    const embedded = await embedChunks(chunks);

    for (const chunk of embedded) {
        if (chunk.embedding.length !== EMBEDDING_DIM) {
            throw new Error(
                `Embedding dimension mismatch: expected ${EMBEDDING_DIM}, got ${chunk.embedding.length} on chunk ${chunk.chunkIndex}`
            );
        }
    }

    return embedded;
}