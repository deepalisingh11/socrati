-- ── 0. Extensions ───────────────────────────────────────────────────────────
create extension if not exists vector;             -- pgvector for embeddings

-- ── 1. Align users table with data model (id → user_id) ─────────────────────
alter table public.users rename column id to user_id;

-- Re-create RLS policies that referenced the old column name
drop policy "users: select own" on public.users;
drop policy "users: update own" on public.users;

create policy "users: select own"
    on public.users for select
    using (auth.uid() = user_id);

create policy "users: update own"
    on public.users for update
    using (auth.uid() = user_id);

-- Update the trigger function to use the new column name
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.users (user_id, email, name)
    values (
        new.id,
        new.email,
        new.raw_user_meta_data ->> 'name'
    );
    return new;
end;
$$;

-- ── 2. documents ─────────────────────────────────────────────────────────────
create table public.documents (
    document_id  uuid        primary key default gen_random_uuid(),
    user_id      uuid        not null references public.users (user_id) on delete cascade,
    title        text        not null,
    file_type    text        not null,
    uploaded_at  timestamptz not null default now()
);

alter table public.documents enable row level security;

create policy "documents: select own"
    on public.documents for select
    using (auth.uid() = user_id);

create policy "documents: insert own"
    on public.documents for insert
    with check (auth.uid() = user_id);

create policy "documents: update own"
    on public.documents for update
    using (auth.uid() = user_id);

create policy "documents: delete own"
    on public.documents for delete
    using (auth.uid() = user_id);

-- ── 3. document_chunks ───────────────────────────────────────────────────────
-- embedding dimension 1536 = OpenAI text-embedding-3-small / ada-002
-- change to 3072 if using text-embedding-3-large
create table public.document_chunks (
    chunk_id     uuid        primary key default gen_random_uuid(),
    document_id  uuid        not null references public.documents (document_id) on delete cascade,
    chunk_index  int         not null,
    content      text        not null,
    embedding    vector(1536),
    created_at   timestamptz not null default now()
);

alter table public.document_chunks enable row level security;

-- Chunks inherit access from their parent document's owner
create policy "document_chunks: select via owner"
    on public.document_chunks for select
    using (
        exists (
            select 1 from public.documents d
            where d.document_id = document_chunks.document_id
              and d.user_id = auth.uid()
        )
    );

create policy "document_chunks: insert via owner"
    on public.document_chunks for insert
    with check (
        exists (
            select 1 from public.documents d
            where d.document_id = document_chunks.document_id
              and d.user_id = auth.uid()
        )
    );

-- ── 4. Vector similarity index ───────────────────────────────────────────────
-- ivfflat with cosine distance; lists = 100 suits up to ~1 M rows.
-- Re-create with a higher lists value as the dataset grows.
create index document_chunks_embedding_idx
    on public.document_chunks
    using ivfflat (embedding vector_cosine_ops)
    with (lists = 100);
