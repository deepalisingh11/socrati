-- ── Quiz schema ───────────────────────────────────────────────────────────────

create table if not exists public.quizzes (
    quiz_id       uuid        primary key default gen_random_uuid(),
    user_id       uuid        not null references public.users (user_id) on delete cascade,
    document_id   uuid        not null references public.documents (document_id) on delete cascade,
    question_count int        not null,
    score         int,
    created_at    timestamptz not null default now()
);

create table if not exists public.quiz_questions (
    question_id   uuid        primary key default gen_random_uuid(),
    quiz_id       uuid        not null references public.quizzes (quiz_id) on delete cascade,
    type          text        not null check (type in ('multiple_choice', 'short_answer', 'true_false')),
    question      text        not null,
    options       jsonb,
    correct_answer text       not null,
    explanation   text        not null,
    user_answer   text,
    is_correct    boolean,
    created_at    timestamptz not null default now()
);

-- RLS
alter table public.quizzes       enable row level security;
alter table public.quiz_questions enable row level security;

create policy "quizzes: select own"
    on public.quizzes for select using (auth.uid() = user_id);

create policy "quizzes: insert own"
    on public.quizzes for insert with check (auth.uid() = user_id);

create policy "quizzes: update own"
    on public.quizzes for update using (auth.uid() = user_id);

create policy "quiz_questions: select via quiz"
    on public.quiz_questions for select
    using (exists (
        select 1 from public.quizzes q
        where q.quiz_id = quiz_questions.quiz_id
          and q.user_id = auth.uid()
    ));

create policy "quiz_questions: insert via quiz"
    on public.quiz_questions for insert
    with check (exists (
        select 1 from public.quizzes q
        where q.quiz_id = quiz_questions.quiz_id
          and q.user_id = auth.uid()
    ));

create policy "quiz_questions: update via quiz"
    on public.quiz_questions for update
    using (exists (
        select 1 from public.quizzes q
        where q.quiz_id = quiz_questions.quiz_id
          and q.user_id = auth.uid()
    ));