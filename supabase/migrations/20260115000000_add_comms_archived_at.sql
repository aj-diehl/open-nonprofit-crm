alter table public.comms_drafts
  add column if not exists archived_at timestamptz;

create index if not exists comms_drafts_archived_at_idx
  on public.comms_drafts(archived_at);
