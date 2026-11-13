-- With a single admin role, the same person often enters and confirms the count.
-- Drop the "a different staff member must confirm" rule; confirmation is still staff-only and audited.
create or replace function public.confirm_race(p_race text)
returns void language plpgsql security definer set search_path = public as $$
declare e public.elections%rowtype;
begin
  if not public.is_staff(auth.uid()) then raise exception 'Only staff can confirm a count.'; end if;
  select * into e from public.elections order by created_at desc limit 1;
  if not found or e.counting_status <> 'counting' then raise exception 'Counting is not open.'; end if;
  if not exists (select 1 from public.ballots where election_id = e.id and race = p_race and voided_at is null) then
    raise exception 'No ballots have been counted in this race yet.';
  end if;
  insert into public.race_confirmations (election_id, race, confirmed_by) values (e.id, p_race, auth.uid()) on conflict do nothing;
  insert into public.audit_logs (actor_id, action, entity_type, metadata) values (auth.uid(), 'results.confirmed', 'election_results', jsonb_build_object('race', p_race, 'election_id', e.id));
end $$;
