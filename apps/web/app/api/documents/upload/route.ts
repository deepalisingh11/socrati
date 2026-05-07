import { NextRequest } from 'next/server';
import { parsePDFFromBuffer } from '@/lib/parser';
import { chunkDocument } from '@/lib/chunker';
import { embedChunksStrict } from '@/lib/embedder';
import { notifyDocumentComplete } from '@/lib/waiters';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return Response.json({ message: 'No file provided' }, { status: 400 });
    }

    // Generate a simple ID for this document
    const documentId = crypto.randomUUID();

    // Run the pipeline in the background so we can return documentId immediately
    (async () => {
      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const doc = await parsePDFFromBuffer(buffer);
        const chunks = await chunkDocument(doc);
        const embedded = await embedChunksStrict(chunks);

        // TODO: save `embedded` to your database here

        console.log(`Document ${documentId}: ${embedded.length} chunks ready`);
        embedded.forEach((chunk, i) => {
            console.log(`\n--- Chunk ${i} (heading: ${chunk.heading}) ---`);
            console.log(chunk.content);
            console.log(`Key terms: ${chunk.keyTerms.join(', ')}`);
        });
        notifyDocumentComplete(documentId, 'ready');
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        console.error('Pipeline error:', msg);
        notifyDocumentComplete(documentId, 'failed', msg);
    }
    })();

    // Return immediately — UI will poll SSE stream for status
    return Response.json({ documentId });

  } catch {
    return Response.json({ message: 'Upload failed' }, { status: 500 });
  }
}