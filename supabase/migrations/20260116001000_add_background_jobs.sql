create table if not exists public.background_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  type text not null,
  status text not null check (status in ('queued','running','succeeded','failed')) default 'queued',
  title text,
  return_path text,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  error text,
  agent_run_id uuid references public.agent_runs(id) on delete set null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create index if not exists background_jobs_org_id_idx on public.background_jobs(org_id);
create index if not exists background_jobs_created_by_idx on public.background_jobs(created_by);
create index if not exists background_jobs_status_idx on public.background_jobs(status);

alter table public.background_jobs enable row level security;
create policy background_jobs_select on public.background_jobs
  for select using (org_id = public.current_org_id());
create policy background_jobs_insert on public.background_jobs
  for insert with check (org_id = public.current_org_id());
create policy background_jobs_update on public.background_jobs
  for update using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());
