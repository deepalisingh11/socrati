import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { submitQuiz } from '@/lib/quiz';
import { loadEnvFiles } from '@/lib/load-env';

export async function POST(
    req: Request,
    { params }: { params: Promise<{ quizId: string }> },
) {
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

    const { quizId } = await params;
    const body = await req.json();
    const { answers } = body;

    if (!answers || !Array.isArray(answers)) {
        return NextResponse.json({ error: 'answers array is required.' }, { status: 400 });
    }

    try {
        const result = await submitQuiz({
            quizId,
            answers,
            accessToken: session.access_token,
        });

        return NextResponse.json(result);
    } catch (err) {
        console.error('[Quiz Submit]', err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'Quiz submission failed.' },
            { status: 500 },
        );
    }
}