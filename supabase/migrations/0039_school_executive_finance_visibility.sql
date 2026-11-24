-- Every executive officer may review their own school's finances; senators remain read-only.
create or replace function public.can_view_finance(uid uuid, school_key text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin(uid) or exists (
    select 1 from public.government_members
    where user_id = uid and status = 'active'
      and office in (
        school_key || '_president', school_key || '_vice_president',
        school_key || '_secretary', school_key || '_treasurer', school_key || '_senator'
      )
  );
$$;
