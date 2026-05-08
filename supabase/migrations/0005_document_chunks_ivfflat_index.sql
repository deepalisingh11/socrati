-- IVFFlat index for approximate nearest-neighbour search on 3072-dim embeddings.
--
-- lists=100 is a reasonable default for tables under ~1M rows.
-- After a bulk data load, rebuild with: REINDEX INDEX document_chunks_embedding_idx;
-- For queries, set probe count with: SET ivfflat.probes = 10;
--
-- vector_cosine_ops matches cosine similarity, which is the standard metric
-- for comparing text embeddings produced by Gemini gemini-embedding-001.

create index if not exists document_chunks_embedding_idx
    on public.document_chunks
    using ivfflat (embedding vector_cosine_ops)
    with (lists = 100);

notify pgrst, 'reload schema';
