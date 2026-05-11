import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { generateQuiz } from '@/lib/quiz';
import { loadEnvFiles } from '@/lib/load-env';

export async function POST(req: Request) {
    loadEnvFiles();

    const cookieStore = await cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { getAll: () => cookieStore.getAll() } },
    );

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { documentId, questionCount } = body;

    if (!documentId || ![5, 10, 20].includes(questionCount)) {
        return NextResponse.json(
            { error: 'documentId and questionCount (5, 10, or 20) are required.' },
            { status: 400 },
        );
    }

    try {
        const result = await generateQuiz({
            documentId,
            userId: session.user.id,
            questionCount: questionCount as 5 | 10 | 20,
            accessToken: session.access_token,
        });

        return NextResponse.json(result);
    } catch (err) {
        console.error('[Quiz Generate]', err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'Quiz generation failed.' },
            { status: 500 },
        );
    }
}