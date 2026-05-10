-- ── 0007_match_document_chunks.sql ───────────────────────────────────────────
-- Creates an RPC function to perform cosine similarity search on document chunks.
-- This function is used by the RAG pipeline to retrieve relevant context.

create or replace function match_document_chunks (
  query_embedding vector,
  match_count int,
  filter_document_ids uuid[]
) returns table (
  chunk_id uuid,
  document_id uuid,
  content text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    document_chunks.chunk_id,
    document_chunks.document_id,
    document_chunks.content,
    1 - (document_chunks.embedding <=> query_embedding) as similarity
  from document_chunks
  where document_chunks.document_id = any(filter_document_ids)
  order by document_chunks.embedding <=> query_embedding
  limit match_count;
end;
$$;
