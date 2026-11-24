-- Repair grants accidentally missing from the live schema. These helpers are used by RLS,
-- so authenticated government members need execute permission for every meeting screen.
grant execute on function public.is_admin(uuid) to authenticated;
grant execute on function public.is_gov_member(uuid) to authenticated;
grant execute on function public.can_run_government(uuid) to authenticated;
grant execute on function public.can_see_government(uuid) to authenticated;
grant execute on function public.gov_people() to authenticated;
grant execute on function public.gov_notify(text, text, text) to authenticated;

-- Live voting is a controlled state machine: it must be opened by an executive
-- during an in-progress meeting, and closing it records the final decision.
create or replace function public.gov_open_motion_vote(p_motion uuid)
returns void language plpgsql security definer set search_path = public as $$
declare m public.gov_motions%rowtype; meeting_status text; present_count int;
begin
  if not public.can_run_government(auth.uid()) then raise exception 'Only an executive officer or administrator can open voting.'; end if;
  select * into m from public.gov_motions where id = p_motion for update;
  if not found then raise exception 'That motion no longer exists.'; end if;
  if m.status <> 'pending' then raise exception 'Reopen the motion before starting a new vote.'; end if;
  if m.voting_open then return; end if;
  select status into meeting_status from public.gov_meetings where id = m.meeting_id;
  if meeting_status <> 'in_progress' then raise exception 'Start the meeting before opening a vote.'; end if;
  select count(*) into present_count from public.gov_attendance where meeting_id = m.meeting_id and status in ('present', 'late');
  if present_count = 0 then raise exception 'Record attendance before opening a vote.'; end if;
  update public.gov_motions set voting_open = true where id = m.id;
end $$;

create or replace function public.gov_close_motion_vote(p_motion uuid)
returns text language plpgsql security definer set search_path = public as $$
declare m public.gov_motions%rowtype; yes_count int; no_count int; abstain_count int; outcome text;
begin
  if not public.can_run_government(auth.uid()) then raise exception 'Only an executive officer or administrator can close voting.'; end if;
  select * into m from public.gov_motions where id = p_motion for update;
  if not found or not m.voting_open then raise exception 'Voting is not open for this motion.'; end if;
  select count(*) filter (where choice = 'yes'), count(*) filter (where choice = 'no'), count(*) filter (where choice = 'abstain')
    into yes_count, no_count, abstain_count from public.gov_motion_ballots where motion_id = m.id;
  if yes_count + no_count + abstain_count = 0 then raise exception 'At least one ballot is required before closing the vote.'; end if;
  outcome := case when yes_count > no_count then 'passed' else 'failed' end;
  update public.gov_motions set voting_open = false, status = outcome, votes_yes = yes_count, votes_no = no_count,
    votes_abstain = abstain_count, voted_at = now() where id = m.id;
  return outcome;
end $$;

create or replace function public.gov_reopen_motion_vote(p_motion uuid)
returns void language plpgsql security definer set search_path = public as $$
declare m public.gov_motions%rowtype;
begin
  if not public.can_run_government(auth.uid()) then raise exception 'Only an executive officer or administrator can reopen a motion.'; end if;
  select * into m from public.gov_motions where id = p_motion for update;
  if not found then raise exception 'That motion no longer exists.'; end if;
  delete from public.gov_motion_ballots where motion_id = m.id;
  update public.gov_motions set status = 'pending', voting_open = false, votes_yes = 0, votes_no = 0,
    votes_abstain = 0, voted_at = null where id = m.id;
end $$;

create or replace function public.gov_set_motion_status(p_motion uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare m public.gov_motions%rowtype;
begin
  if not public.can_run_government(auth.uid()) then raise exception 'Only an executive officer or administrator can manage motions.'; end if;
  if p_status not in ('tabled', 'withdrawn') then raise exception 'That motion status is not allowed here.'; end if;
  select * into m from public.gov_motions where id = p_motion for update;
  if not found then raise exception 'That motion no longer exists.'; end if;
  if m.voting_open then raise exception 'Close the live vote before changing the motion status.'; end if;
  update public.gov_motions set status = p_status where id = m.id;
end $$;

create or replace function public.gov_cast_motion_vote(p_motion uuid, p_choice text)
returns void language plpgsql security definer set search_path = public as $$
declare m public.gov_motions%rowtype; present boolean; meeting_status text;
begin
  if p_choice not in ('yes','no','abstain') then raise exception 'Choose yes, no, or abstain.'; end if;
  select * into m from public.gov_motions where id = p_motion;
  if not found or not m.voting_open or m.status <> 'pending' then raise exception 'Voting is not open for this motion.'; end if;
  select status into meeting_status from public.gov_meetings where id = m.meeting_id;
  if meeting_status <> 'in_progress' then raise exception 'This meeting is not in session.'; end if;
  select exists(select 1 from public.gov_attendance where meeting_id = m.meeting_id and user_id = auth.uid() and status in ('present','late')) into present;
  if not present then raise exception 'Only members marked present may vote.'; end if;
  insert into public.gov_motion_ballots(motion_id,user_id,choice) values(p_motion,auth.uid(),p_choice)
    on conflict(motion_id,user_id) do update set choice = excluded.choice, cast_at = now();
  update public.gov_motions set votes_yes = (select count(*) from public.gov_motion_ballots where motion_id = p_motion and choice = 'yes'),
    votes_no = (select count(*) from public.gov_motion_ballots where motion_id = p_motion and choice = 'no'),
    votes_abstain = (select count(*) from public.gov_motion_ballots where motion_id = p_motion and choice = 'abstain') where id = p_motion;
end $$;

revoke all on function public.gov_open_motion_vote(uuid), public.gov_close_motion_vote(uuid), public.gov_reopen_motion_vote(uuid), public.gov_set_motion_status(uuid, text), public.gov_cast_motion_vote(uuid, text) from public, anon;
grant execute on function public.gov_open_motion_vote(uuid), public.gov_close_motion_vote(uuid), public.gov_reopen_motion_vote(uuid), public.gov_set_motion_status(uuid, text), public.gov_cast_motion_vote(uuid, text) to authenticated;
