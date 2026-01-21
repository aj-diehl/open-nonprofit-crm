-- Ensure upserts on (org_id, external_id) have a matching unique constraint.
-- Note: unique constraints allow multiple NULL external_id values.

drop index if exists public.donations_org_external_id_unique;

alter table public.donations
  add constraint donations_org_external_id_unique unique (org_id, external_id);
