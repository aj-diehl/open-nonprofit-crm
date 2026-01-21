alter table public.grants
  add column if not exists archived_at timestamptz;

create index if not exists grants_archived_at_idx
  on public.grants(archived_at);
