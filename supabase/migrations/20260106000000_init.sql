-- NonprofitOS initial schema (multi-tenant Supabase + pgvector)

-- Extensions
create extension if not exists pgcrypto;
create extension if not exists vector;

-- Helper: updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Organizations
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  invite_code text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

-- Org profile (approved fields)
create table if not exists public.org_profiles (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  website_url text,
  mission text,
  programs text,
  impact text,
  leadership text,
  service_area text,
  beneficiaries text,
  key_metrics jsonb,
  last_discovered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger org_profiles_set_updated_at
before update on public.org_profiles
for each row execute function public.set_updated_at();

-- Profiles (user membership)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  username text not null unique,
  display_name text not null,
  contact_email text,
  role text not null check (role in ('executive','member')),
  status text not null check (status in ('pending','active','disabled')) default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_org_id_idx on public.profiles(org_id);
create index if not exists profiles_status_idx on public.profiles(status);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Current org helpers for RLS
create or replace function public.current_org_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select org_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_executive()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists(
    select 1 from public.profiles
    where id = auth.uid() and role = 'executive' and status = 'active'
  );
$$;

-- Donors
create table if not exists public.donors (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  donor_type text not null check (donor_type in ('individual','organization')),
  first_name text,
  last_name text,
  organization_name text,
  email text,
  phone text,
  address jsonb,
  currency text not null default 'USD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists donors_org_id_idx on public.donors(org_id);
create index if not exists donors_email_idx on public.donors(org_id, email);

create trigger donors_set_updated_at
before update on public.donors
for each row execute function public.set_updated_at();

-- Donations
create table if not exists public.donations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  donor_id uuid references public.donors(id) on delete set null,
  amount numeric not null,
  currency text not null default 'USD',
  donated_at timestamptz not null,
  campaign text,
  channel text,
  external_id text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists donations_org_id_idx on public.donations(org_id);
create index if not exists donations_donor_id_idx on public.donations(donor_id);
create index if not exists donations_donated_at_idx on public.donations(org_id, donated_at);

-- Dedup if upstream provides external_id
create unique index if not exists donations_org_external_id_unique
  on public.donations(org_id, external_id)
  where external_id is not null;

create trigger donations_set_updated_at
before update on public.donations
for each row execute function public.set_updated_at();

-- Interactions
create table if not exists public.interactions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  donor_id uuid references public.donors(id) on delete set null,
  type text not null,
  subject text,
  body text,
  occurred_at timestamptz not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists interactions_org_id_idx on public.interactions(org_id);
create index if not exists interactions_donor_id_idx on public.interactions(donor_id);

-- Grants
create table if not exists public.grants (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  funder text,
  status text not null check (status in ('prospecting','writing','submitted','awarded','declined','reporting','closed')) default 'writing',
  due_date timestamptz,
  requested_amount numeric,
  currency text not null default 'USD',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists grants_org_id_idx on public.grants(org_id);

create trigger grants_set_updated_at
before update on public.grants
for each row execute function public.set_updated_at();

-- Grant questions/answers
create table if not exists public.grant_questions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  grant_id uuid not null references public.grants(id) on delete cascade,
  question text not null,
  constraints text,
  max_words int,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists grant_questions_org_id_idx on public.grant_questions(org_id);
create index if not exists grant_questions_grant_id_idx on public.grant_questions(grant_id);

create table if not exists public.grant_answers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  grant_id uuid not null references public.grants(id) on delete cascade,
  question_id uuid not null references public.grant_questions(id) on delete cascade,
  draft text,
  final text,
  citations jsonb,
  confidence numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, question_id)
);

create index if not exists grant_answers_org_id_idx on public.grant_answers(org_id);
create index if not exists grant_answers_grant_id_idx on public.grant_answers(grant_id);

create trigger grant_answers_set_updated_at
before update on public.grant_answers
for each row execute function public.set_updated_at();

-- Agent runs (for tracing + audit)
create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  workflow text not null,
  status text not null check (status in ('running','succeeded','failed')) default 'running',
  trace_id text,
  input jsonb,
  output jsonb,
  error text,
  usage jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists agent_runs_org_id_idx on public.agent_runs(org_id);
create index if not exists agent_runs_workflow_idx on public.agent_runs(workflow);

-- Comms drafts
create table if not exists public.comms_drafts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  type text not null check (type in ('email','newsletter','article')),
  title text not null,
  audience text,
  goal text not null,
  tone text,
  length text,
  call_to_action text,
  subject text,
  body text,
  metadata jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  agent_run_id uuid references public.agent_runs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists comms_drafts_org_id_idx on public.comms_drafts(org_id);

create trigger comms_drafts_set_updated_at
before update on public.comms_drafts
for each row execute function public.set_updated_at();

-- Documents + embeddings
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  file_name text not null,
  mime_type text,
  file_size int,
  storage_path text,
  status text not null check (status in ('uploaded','processing','indexed','failed')) default 'uploaded',
  tags jsonb,
  summary text,
  metadata jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  indexed_at timestamptz
);

create index if not exists documents_org_id_idx on public.documents(org_id);

create trigger documents_set_updated_at
before update on public.documents
for each row execute function public.set_updated_at();

-- NOTE: Embedding dimension = 1536 (configure OPENAI_EMBEDDING_DIM to match)
create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  chunk_index int not null,
  content text not null,
  token_count int,
  embedding vector(1536),
  created_at timestamptz not null default now()
);

create index if not exists document_chunks_org_id_idx on public.document_chunks(org_id);
create index if not exists document_chunks_document_id_idx on public.document_chunks(document_id);

-- Vector index (requires pgvector >= 0.5). If your Supabase project uses a different index type, adjust accordingly.
-- create index if not exists document_chunks_embedding_idx on public.document_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);
-- HNSW (pgvector >= 0.6) is often better; uncomment if available:
-- create index if not exists document_chunks_embedding_hnsw_idx on public.document_chunks using hnsw (embedding vector_cosine_ops);

-- Grant documents link
create table if not exists public.grant_documents (
  org_id uuid not null references public.organizations(id) on delete cascade,
  grant_id uuid not null references public.grants(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (org_id, grant_id, document_id)
);

-- Ingestion jobs
create table if not exists public.ingestion_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  type text not null check (type in ('donations','donors')),
  status text not null check (status in ('running','succeeded','failed')) default 'running',
  created_by uuid references public.profiles(id) on delete set null,
  file_name text,
  file_size int,
  stats jsonb,
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists ingestion_jobs_org_id_idx on public.ingestion_jobs(org_id);

-- Org profile suggested updates
create table if not exists public.org_profile_updates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  status text not null check (status in ('pending','accepted','rejected')) default 'pending',
  summary text,
  proposed jsonb,
  sources jsonb,
  agent_run_id uuid references public.agent_runs(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles(id) on delete set null
);

create index if not exists org_profile_updates_org_id_idx on public.org_profile_updates(org_id);

-- Audit events
create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_events_org_id_idx on public.audit_events(org_id);
create index if not exists audit_events_action_idx on public.audit_events(action);

-- RPC: dashboard metrics
create or replace function public.dashboard_metrics(p_org_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'donors', (select count(*) from public.donors where org_id = p_org_id),
    'donations', (select count(*) from public.donations where org_id = p_org_id),
    'donation_total', (select coalesce(sum(amount),0) from public.donations where org_id = p_org_id),
    'open_grants', (select count(*) from public.grants where org_id = p_org_id and status in ('prospecting','writing','submitted','awarded','reporting')),
    'pending_users', (select count(*) from public.profiles where org_id = p_org_id and status = 'pending')
  ) into result;
  return result;
end;
$$;

-- RPC: vector search over document chunks
create or replace function public.match_document_chunks(
  p_org_id uuid,
  p_query_embedding vector(1536),
  p_match_count int default 5
)
returns table (
  chunk_id uuid,
  document_id uuid,
  similarity float,
  content text
)
language sql stable
as $$
  select
    id as chunk_id,
    document_id,
    (1 - (embedding <=> p_query_embedding)) as similarity,
    content
  from public.document_chunks
  where org_id = p_org_id
  order by embedding <=> p_query_embedding
  limit p_match_count;
$$;

-- -----------------------------
-- Row Level Security (RLS)
-- -----------------------------

-- Organizations
alter table public.organizations enable row level security;
create policy org_select on public.organizations
  for select using (id = public.current_org_id());
create policy org_update_exec on public.organizations
  for update using (id = public.current_org_id() and public.is_executive())
  with check (id = public.current_org_id() and public.is_executive());

-- Org profiles
alter table public.org_profiles enable row level security;
create policy org_profiles_select on public.org_profiles
  for select using (org_id = public.current_org_id());
create policy org_profiles_update_exec on public.org_profiles
  for update using (org_id = public.current_org_id() and public.is_executive())
  with check (org_id = public.current_org_id() and public.is_executive());

-- Profiles
alter table public.profiles enable row level security;
create policy profiles_select_org on public.profiles
  for select using (org_id = public.current_org_id());
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());
create policy profiles_update_exec on public.profiles
  for update using (org_id = public.current_org_id() and public.is_executive())
  with check (org_id = public.current_org_id() and public.is_executive());

-- Donors
alter table public.donors enable row level security;
create policy donors_select on public.donors
  for select using (org_id = public.current_org_id());
create policy donors_insert on public.donors
  for insert with check (org_id = public.current_org_id());
create policy donors_update on public.donors
  for update using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());
create policy donors_delete_exec on public.donors
  for delete using (org_id = public.current_org_id() and public.is_executive());

-- Donations
alter table public.donations enable row level security;
create policy donations_select on public.donations
  for select using (org_id = public.current_org_id());
create policy donations_insert on public.donations
  for insert with check (org_id = public.current_org_id());
create policy donations_update on public.donations
  for update using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());
create policy donations_delete_exec on public.donations
  for delete using (org_id = public.current_org_id() and public.is_executive());

-- Interactions
alter table public.interactions enable row level security;
create policy interactions_select on public.interactions
  for select using (org_id = public.current_org_id());
create policy interactions_insert on public.interactions
  for insert with check (org_id = public.current_org_id());
create policy interactions_update on public.interactions
  for update using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());
create policy interactions_delete_exec on public.interactions
  for delete using (org_id = public.current_org_id() and public.is_executive());

-- Grants
alter table public.grants enable row level security;
create policy grants_select on public.grants
  for select using (org_id = public.current_org_id());
create policy grants_insert on public.grants
  for insert with check (org_id = public.current_org_id());
create policy grants_update on public.grants
  for update using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());
create policy grants_delete_exec on public.grants
  for delete using (org_id = public.current_org_id() and public.is_executive());

-- Grant questions/answers
alter table public.grant_questions enable row level security;
create policy grant_questions_select on public.grant_questions
  for select using (org_id = public.current_org_id());
create policy grant_questions_insert on public.grant_questions
  for insert with check (org_id = public.current_org_id());
create policy grant_questions_update on public.grant_questions
  for update using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());
create policy grant_questions_delete_exec on public.grant_questions
  for delete using (org_id = public.current_org_id() and public.is_executive());

alter table public.grant_answers enable row level security;
create policy grant_answers_select on public.grant_answers
  for select using (org_id = public.current_org_id());
create policy grant_answers_insert on public.grant_answers
  for insert with check (org_id = public.current_org_id());
create policy grant_answers_update on public.grant_answers
  for update using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());
create policy grant_answers_delete_exec on public.grant_answers
  for delete using (org_id = public.current_org_id() and public.is_executive());

-- Grant documents
alter table public.grant_documents enable row level security;
create policy grant_documents_select on public.grant_documents
  for select using (org_id = public.current_org_id());
create policy grant_documents_insert on public.grant_documents
  for insert with check (org_id = public.current_org_id());
create policy grant_documents_delete_exec on public.grant_documents
  for delete using (org_id = public.current_org_id() and public.is_executive());

-- Agent runs
alter table public.agent_runs enable row level security;
create policy agent_runs_select on public.agent_runs
  for select using (org_id = public.current_org_id());
create policy agent_runs_insert on public.agent_runs
  for insert with check (org_id = public.current_org_id());
create policy agent_runs_update on public.agent_runs
  for update using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

-- Comms drafts
alter table public.comms_drafts enable row level security;
create policy comms_select on public.comms_drafts
  for select using (org_id = public.current_org_id());
create policy comms_insert on public.comms_drafts
  for insert with check (org_id = public.current_org_id());
create policy comms_update on public.comms_drafts
  for update using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());
create policy comms_delete_exec on public.comms_drafts
  for delete using (org_id = public.current_org_id() and public.is_executive());

-- Documents + chunks
alter table public.documents enable row level security;
create policy documents_select on public.documents
  for select using (org_id = public.current_org_id());
create policy documents_insert on public.documents
  for insert with check (org_id = public.current_org_id());
create policy documents_update on public.documents
  for update using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());
create policy documents_delete_exec on public.documents
  for delete using (org_id = public.current_org_id() and public.is_executive());

alter table public.document_chunks enable row level security;
create policy chunks_select on public.document_chunks
  for select using (org_id = public.current_org_id());
create policy chunks_insert on public.document_chunks
  for insert with check (org_id = public.current_org_id());
create policy chunks_delete_exec on public.document_chunks
  for delete using (org_id = public.current_org_id() and public.is_executive());

-- Ingestion jobs
alter table public.ingestion_jobs enable row level security;
create policy ingestion_select on public.ingestion_jobs
  for select using (org_id = public.current_org_id());
create policy ingestion_insert on public.ingestion_jobs
  for insert with check (org_id = public.current_org_id());
create policy ingestion_update on public.ingestion_jobs
  for update using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

-- Org profile updates
alter table public.org_profile_updates enable row level security;
create policy org_profile_updates_select on public.org_profile_updates
  for select using (org_id = public.current_org_id());
create policy org_profile_updates_insert_exec on public.org_profile_updates
  for insert with check (org_id = public.current_org_id() and public.is_executive());
create policy org_profile_updates_update_exec on public.org_profile_updates
  for update using (org_id = public.current_org_id() and public.is_executive())
  with check (org_id = public.current_org_id() and public.is_executive());

-- Audit events
alter table public.audit_events enable row level security;
create policy audit_select_exec on public.audit_events
  for select using (org_id = public.current_org_id() and public.is_executive());
create policy audit_insert on public.audit_events
  for insert with check (org_id = public.current_org_id());
