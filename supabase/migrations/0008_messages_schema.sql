create table if not exists public.messages (
    message_id   uuid         primary key default gen_random_uuid(),
    session_id   uuid         not null references public.sessions (session_id) on delete cascade,
    user_id      uuid         not null references public.users (user_id) on delete cascade,
    role         text         not null check (role in ('user', 'assistant')),
    content      text         not null,
    created_at   timestamptz  not null default now()
);

alter table public.messages enable row level security;

drop policy if exists "messages: select own" on public.messages;
drop policy if exists "messages: insert own" on public.messages;
drop policy if exists "messages: delete own" on public.messages;

create policy "messages: select own"
    on public.messages for select
    using (auth.uid() = user_id);

create policy "messages: insert own"
    on public.messages for insert
    with check (auth.uid() = user_id);

create policy "messages: delete own"
    on public.messages for delete
    using (auth.uid() = user_id);
