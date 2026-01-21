alter table public.grants
  add column if not exists awarded_amount_min numeric,
  add column if not exists awarded_amount_max numeric;

create index if not exists grants_awarded_amount_min_idx on public.grants(awarded_amount_min);
create index if not exists grants_awarded_amount_max_idx on public.grants(awarded_amount_max);
