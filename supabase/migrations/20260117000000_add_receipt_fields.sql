alter table public.org_profiles
  add column if not exists logo_url text,
  add column if not exists logo_path text,
  add column if not exists receipt_address text,
  add column if not exists receipt_ein text,
  add column if not exists receipt_signer_name text,
  add column if not exists receipt_signer_title text;

alter table public.donations
  add column if not exists goods_or_services_provided boolean not null default false,
  add column if not exists goods_or_services_description text,
  add column if not exists goods_or_services_value numeric;
