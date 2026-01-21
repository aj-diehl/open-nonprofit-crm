-- Performance indexes for common filters/sorts and text search.
create extension if not exists pg_trgm;

create index if not exists donors_org_created_at_idx on public.donors(org_id, created_at desc);
create index if not exists donations_org_donated_at_desc_idx on public.donations(org_id, donated_at desc);
create index if not exists donations_org_donor_donated_at_idx on public.donations(org_id, donor_id, donated_at desc);
create index if not exists interactions_org_donor_occurred_at_idx on public.interactions(org_id, donor_id, occurred_at desc);
create index if not exists grants_org_archived_created_at_idx on public.grants(org_id, archived_at, created_at desc);
create index if not exists comms_drafts_org_archived_updated_at_idx on public.comms_drafts(org_id, archived_at, updated_at desc);
create index if not exists documents_org_created_at_idx on public.documents(org_id, created_at desc);
create index if not exists documents_tags_gin_idx on public.documents using gin (tags jsonb_path_ops);
create index if not exists ingestion_jobs_org_created_at_idx on public.ingestion_jobs(org_id, created_at desc);
create index if not exists audit_events_org_created_at_idx on public.audit_events(org_id, created_at desc);
create index if not exists background_jobs_org_created_by_status_completed_idx on public.background_jobs(org_id, created_by, status, completed_at);

create index if not exists donors_first_name_trgm_idx on public.donors using gin (first_name gin_trgm_ops);
create index if not exists donors_last_name_trgm_idx on public.donors using gin (last_name gin_trgm_ops);
create index if not exists donors_org_name_trgm_idx on public.donors using gin (organization_name gin_trgm_ops);
create index if not exists donors_email_trgm_idx on public.donors using gin (email gin_trgm_ops);

-- Vector index for similarity search (requires pgvector >= 0.5).
create index if not exists document_chunks_embedding_idx
  on public.document_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);
