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
    'donation_total', (select coalesce(sum(amount), 0) from public.donations where org_id = p_org_id),
    'open_grants', (
      select count(*)
      from public.grants
      where org_id = p_org_id
        and archived_at is null
        and status in ('prospecting', 'writing', 'submitted', 'awarded', 'reporting')
    ),
    'pending_users', (select count(*) from public.profiles where org_id = p_org_id and status = 'pending')
  ) into result;
  return result;
end;
$$;
