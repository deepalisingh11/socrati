create table if not exists public.sessions (
    session_id   uuid         primary key default gen_random_uuid(),
    user_id      uuid         not null references public.users (user_id) on delete cascade,
    document_ids uuid[]       not null default '{}',
    created_at   timestamptz  not null default now()
);

alter table public.sessions enable row level security;

drop policy if exists "sessions: select own" on public.sessions;
drop policy if exists "sessions: insert own" on public.sessions;
drop policy if exists "sessions: delete own" on public.sessions;

create policy "sessions: select own"
    on public.sessions for select
    using (auth.uid() = user_id);

create policy "sessions: insert own"
    on public.sessions for insert
    with check (auth.uid() = user_id);

create policy "sessions: delete own"
    on public.sessions for delete
    using (auth.uid() = user_id);