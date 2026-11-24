-- Auth inserts run as supabase_auth_admin, which cannot read public tables.
-- This trigger must execute with its owning role's permissions to consult the
-- configured allowed email domains during sign-up.
create or replace function public.enforce_signup_domain()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  domain text := lower(split_part(coalesce(new.email, ''), '@', 2));
  allowed_domains text[];
begin
  select email_domains into allowed_domains
  from public.election_config
  where id;

  if allowed_domains is null or cardinality(allowed_domains) = 0 then
    return new;
  end if;

  if not exists (
    select 1
    from unnest(allowed_domains) as configured_domain
    where domain = lower(configured_domain)
      or domain like '%.' || lower(configured_domain)
  ) then
    raise exception 'Only % email addresses can sign up.', array_to_string(allowed_domains, ', ')
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;
