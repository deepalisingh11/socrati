import { NextResponse } from 'next/server';

// ── Types ──────────────────────────────────────────────────────────────────────

export type QuizRow = {
    quiz_id: string;
    score: number | null;
    question_count: number;
    created_at: string;
    document_id: string;
    documents: { title: string } | null;
};

export type ProgressDependencies = {
    createSupabaseClient: () => Promise<{
        auth: {
            getSession: () => Promise<{
                data: { session: { user: { id: string }; access_token: string } | null };
            }>;
        };
        from: (table: string) => any;
    }>;
};

// ── Handler ────────────────────────────────────────────────────────────────────

export async function handleProgressGet(deps: ProgressDependencies): Promise<Response> {
    const supabase = await deps.createSupabaseClient();

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: quizzes, error } = await supabase
        .from('quizzes')
        .select(`
            quiz_id,
            score,
            question_count,
            created_at,
            document_id,
            documents (title)
        `)
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const attempts = (quizzes ?? []).map((q: any) => ({
        quiz_id: q.quiz_id,
        score: q.score ?? 0,
        question_count: q.question_count,
        created_at: q.created_at,
        document_id: q.document_id,
        document_title: q.documents?.title ?? 'Unknown document',
    }));

    return NextResponse.json({ attempts });
}