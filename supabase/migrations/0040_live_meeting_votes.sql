alter table public.gov_motions add column if not exists voting_open boolean not null default false;
create table if not exists public.gov_motion_ballots (
  motion_id uuid not null references public.gov_motions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  choice text not null check (choice in ('yes','no','abstain')),
  cast_at timestamptz not null default now(), primary key (motion_id, user_id)
);
alter table public.gov_motion_ballots enable row level security;
drop policy if exists "motion ballots members read" on public.gov_motion_ballots;
drop policy if exists "motion ballots own vote" on public.gov_motion_ballots;
create policy "motion ballots members read" on public.gov_motion_ballots for select using (public.can_see_government(auth.uid()));
create policy "motion ballots own vote" on public.gov_motion_ballots for insert with check (user_id = auth.uid());
create or replace function public.gov_cast_motion_vote(p_motion uuid, p_choice text)
returns void language plpgsql security definer set search_path = public as $$
declare m public.gov_motions%rowtype; present boolean;
begin
  if p_choice not in ('yes','no','abstain') then raise exception 'Choose yes, no, or abstain.'; end if;
  select * into m from public.gov_motions where id = p_motion;
  if not found or not m.voting_open then raise exception 'Voting is not open for this motion.'; end if;
  select exists(select 1 from public.gov_attendance where meeting_id=m.meeting_id and user_id=auth.uid() and status in ('present','late')) into present;
  if not present then raise exception 'Only members marked present may vote.'; end if;
  insert into public.gov_motion_ballots(motion_id,user_id,choice) values(p_motion,auth.uid(),p_choice)
  on conflict(motion_id,user_id) do update set choice=excluded.choice, cast_at=now();
  update public.gov_motions set votes_yes=(select count(*) from public.gov_motion_ballots where motion_id=p_motion and choice='yes'), votes_no=(select count(*) from public.gov_motion_ballots where motion_id=p_motion and choice='no'), votes_abstain=(select count(*) from public.gov_motion_ballots where motion_id=p_motion and choice='abstain') where id=p_motion;
end $$;
grant execute on function public.gov_cast_motion_vote(uuid,text) to authenticated;
create or replace function public.gov_tv(p_meeting uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare meeting_data jsonb; attendance_data jsonb; motions_data jsonb;
begin
  select jsonb_build_object('title', title, 'status', status) into meeting_data from public.gov_meetings where id = p_meeting;
  select coalesce(jsonb_agg(jsonb_build_object('name', p.full_name, 'status', a.status) order by p.full_name), '[]'::jsonb) into attendance_data
    from public.gov_attendance a join public.profiles p on p.id = a.user_id where a.meeting_id = p_meeting;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', m.id, 'text', m.text, 'open', m.voting_open, 'yes', m.votes_yes, 'no', m.votes_no, 'abstain', m.votes_abstain, 'status', m.status,
    'ballots', coalesce((select jsonb_agg(jsonb_build_object('name', p.full_name, 'choice', b.choice) order by p.full_name) from public.gov_motion_ballots b join public.profiles p on p.id = b.user_id where b.motion_id = m.id), '[]'::jsonb)
  ) order by m.created_at), '[]'::jsonb) into motions_data from public.gov_motions m where m.meeting_id = p_meeting;
  return jsonb_build_object('meeting', meeting_data, 'attendance', attendance_data, 'motions', motions_data);
end;
$$;
grant execute on function public.gov_tv(uuid) to anon, authenticated;
