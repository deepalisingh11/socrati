alter table public.documents
    add column if not exists parse_status text not null default 'pending'
        check (parse_status in ('pending', 'processing', 'ready', 'failed')),
    add column if not exists error_message text;

alter table public.document_chunks
    add column if not exists heading text,
    add column if not exists key_terms text[] not null default '{}';

drop index if exists public.document_chunks_embedding_idx;

alter table public.document_chunks
    alter column embedding type vector(3072)
    using embedding::vector(3072);

notify pgrst, 'reload schema';
