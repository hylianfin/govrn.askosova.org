-- Senators may read their own school's finance records; only treasurers/admins edit them.
create or replace function public.can_view_finance(uid uuid, school_key text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin(uid) or exists (
    select 1 from public.government_members
    where user_id = uid and status = 'active'
      and office in (school_key || '_senator', school_key || '_treasurer')
  );
$$;
create or replace function public.can_manage_finance_for_school(uid uuid, school_key text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin(uid) or exists (
    select 1 from public.government_members
    where user_id = uid and status = 'active' and office = school_key || '_treasurer'
  );
$$;
grant execute on function public.can_view_finance(uuid, text), public.can_manage_finance_for_school(uuid, text) to authenticated;

drop policy if exists "treasury events manage" on public.treasury_events;
drop policy if exists "treasury entries manage" on public.treasury_entries;
create policy "treasury events read by school" on public.treasury_events for select using (public.can_view_finance(auth.uid(), school));
create policy "treasury entries read by school" on public.treasury_entries for select using (
  exists (select 1 from public.treasury_events e where e.id = event_id and public.can_view_finance(auth.uid(), e.school))
);
create policy "treasury events manage by school" on public.treasury_events for all using (public.can_manage_finance_for_school(auth.uid(), school)) with check (public.can_manage_finance_for_school(auth.uid(), school));
create policy "treasury entries manage by school" on public.treasury_entries for all using (
  exists (select 1 from public.treasury_events e where e.id = event_id and public.can_manage_finance_for_school(auth.uid(), e.school))
) with check (
  exists (select 1 from public.treasury_events e where e.id = event_id and public.can_manage_finance_for_school(auth.uid(), e.school))
);
