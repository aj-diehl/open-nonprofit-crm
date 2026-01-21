create or replace function public.dashboard_donation_series(
  p_org_id uuid,
  p_start timestamptz,
  p_end timestamptz
)
returns table (
  month date,
  total numeric
)
language sql stable security definer
set search_path = public
as $$
  select
    date_trunc('month', donated_at)::date as month,
    coalesce(sum(amount), 0)::numeric as total
  from public.donations
  where org_id = p_org_id
    and donated_at >= p_start
    and donated_at < p_end
  group by 1
  order by 1;
$$;
