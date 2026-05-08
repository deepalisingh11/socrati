import { NextRequest } from 'next/server';
import { getDocumentQueue } from '@/lib/queue';
import { createDocument, updateParseStatus } from '@/lib/repository';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return Response.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return Response.json({ message: 'No file provided' }, { status: 400 });
    }

    const documentId = crypto.randomUUID();
    const buffer = Buffer.from(await file.arrayBuffer());

    await createDocument({
      id: documentId,
      userId: user.id,
      title: file.name,
      fileType: file.type || 'application/octet-stream',
    });

    try {
      await getDocumentQueue().add('process-document', {
        documentId,
        fileBase64: buffer.toString('base64'),
        fileName: file.name,
        fileType: file.type || 'application/octet-stream',
        userId: user.id,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to enqueue document';
      await updateParseStatus(documentId, 'failed', msg);
      throw err;
    }

    return Response.json({ documentId });

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Upload failed';
    return Response.json({ message: msg }, { status: 500 });
  }
}
