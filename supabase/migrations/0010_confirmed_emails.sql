-- Staff can see which accounts have confirmed their email (profiles doesn't carry that), to label match suggestions.
create or replace function public.confirmed_emails()
returns table (email text)
language plpgsql security definer stable set search_path = public as $$
begin
  if not public.is_staff(auth.uid()) then raise exception 'Staff only.'; end if;
  return query select u.email::text from auth.users u where u.email_confirmed_at is not null;
end;
$$;
revoke all on function public.confirmed_emails() from public, anon;
grant execute on function public.confirmed_emails() to authenticated;
