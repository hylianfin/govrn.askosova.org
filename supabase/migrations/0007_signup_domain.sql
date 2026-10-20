-- Only askosova.org addresses (and subdomains such as students.askosova.org) may create an account.
-- Enforced in the database so calling the auth API directly cannot bypass the sign-up form check.
create or replace function public.enforce_signup_domain()
returns trigger language plpgsql set search_path = public as $$
declare d text := lower(split_part(coalesce(new.email, ''), '@', 2));
begin
  if d <> 'askosova.org' and d not like '%.askosova.org' then
    raise exception 'Only askosova.org email addresses can sign up.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_signup_domain on auth.users;
create trigger enforce_signup_domain before insert on auth.users
  for each row execute function public.enforce_signup_domain();
