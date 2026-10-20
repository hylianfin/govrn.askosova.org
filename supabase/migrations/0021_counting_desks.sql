-- Two counting desks run at the same time: one person counts the Middle School ballots and one counts the High School ballots.
--   * a desk has exactly one holder; only the holder can enter or undo ballots for that school
--   * a race is confirmed by someone who is not holding that desk and did not enter its last ballot
--     (in practice the other desk's counter checks the first desk's count)
--   * an admin can take over a desk (for example if a counter's laptop dies)
--   * desks are pushed to every open counting screen through Realtime, like ballots are

create table if not exists public.counting_desks (
  election_id uuid not null references public.elections(id) on delete cascade,
  school text not null check (school in ('middle', 'high')),
  user_id uuid not null references auth.users(id),
  claimed_at timestamptz not null default now(),
  primary key (election_id, school)
);
alter table public.counting_desks enable row level security;
drop policy if exists "counting_desks staff read" on public.counting_desks;
create policy "counting_desks staff read" on public.counting_desks for select using (public.is_staff(auth.uid()));

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'counting_desks') then
    alter publication supabase_realtime add table public.counting_desks;
  end if;
end $$;

-- Take a desk. A person holds one desk at a time (taking the other one moves them). Only an admin can take a held desk.
create or replace function public.claim_desk(p_school text, p_force boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare e public.elections%rowtype; holder uuid; holder_name text;
begin
  if not public.is_staff(auth.uid()) then raise exception 'Only staff can take a counting desk.'; end if;
  if p_school not in ('middle', 'high') then raise exception 'Unknown school.'; end if;
  select * into e from public.elections order by created_at desc limit 1;
  if not found then raise exception 'No election is configured.'; end if;
  select user_id into holder from public.counting_desks where election_id = e.id and school = p_school;
  if holder is not null and holder <> auth.uid() then
    if not (p_force and public.is_admin(auth.uid())) then
      select coalesce(full_name, email) into holder_name from public.profiles where id = holder;
      raise exception 'The % desk is already taken by %.', p_school, coalesce(holder_name, 'another staff member');
    end if;
  end if;
  delete from public.counting_desks where election_id = e.id and user_id = auth.uid() and school <> p_school;
  insert into public.counting_desks (election_id, school, user_id) values (e.id, p_school, auth.uid())
    on conflict (election_id, school) do update set user_id = auth.uid(), claimed_at = now();
  insert into public.audit_logs (actor_id, action, entity_type, metadata) values (auth.uid(), 'desk.claimed', 'counting_desks', jsonb_build_object('school', p_school, 'election_id', e.id, 'took_over', holder is not null and holder <> auth.uid()));
end $$;

create or replace function public.release_desk(p_school text)
returns void language plpgsql security definer set search_path = public as $$
declare e public.elections%rowtype; holder uuid;
begin
  select * into e from public.elections order by created_at desc limit 1;
  select user_id into holder from public.counting_desks where election_id = e.id and school = p_school;
  if holder is null then return; end if;
  if holder <> auth.uid() and not public.is_admin(auth.uid()) then raise exception 'Only the desk holder or an admin can release this desk.'; end if;
  delete from public.counting_desks where election_id = e.id and school = p_school;
end $$;

-- live_results now also reports who holds each desk and when the last ballot of each race was entered.
create or replace function public.live_results()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  e public.elections%rowtype;
  r text; cands jsonb; races jsonb := '[]'::jsonb; desks jsonb;
  n_valid int; n_invalid int; n_blank int; issued int; registered int; mine uuid[];
  confirmed boolean; mine_last boolean; desk_mine boolean; last_at timestamptz;
begin
  select * into e from public.elections order by created_at desc limit 1;
  if not found or not public.is_staff(auth.uid()) then
    return jsonb_build_object('status', coalesce(e.counting_status, 'not_started'), 'races', '[]'::jsonb, 'desks', '{}'::jsonb);
  end if;
  select coalesce(jsonb_object_agg(d.school, jsonb_build_object('userId', d.user_id, 'name', coalesce(p.full_name, p.email), 'claimedAt', d.claimed_at, 'isMe', d.user_id = auth.uid())), '{}'::jsonb)
    into desks
    from public.counting_desks d join public.profiles p on p.id = d.user_id where d.election_id = e.id;
  foreach r in array array['exec-middle','exec-high','senate-middle','senate-high'] loop
    select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'num', c.num, 'label', c.label, 'sub', c.sub, 'members', c.members, 'votes', coalesce(v.n, 0)) order by c.num), '[]'::jsonb)
      into cands
      from public.race_candidates(e.id, r) c
      left join (
        select cid, count(*)::int n from public.ballots b, unnest(b.choices) cid
        where b.election_id = e.id and b.race = r and b.kind = 'valid' group by cid
      ) v on v.cid = c.id;
    continue when jsonb_array_length(cands) = 0;

    select count(*) filter (where kind = 'valid'), count(*) filter (where kind = 'invalid'), count(*) filter (where kind = 'blank'), max(created_at)
      into n_valid, n_invalid, n_blank, last_at from public.ballots where election_id = e.id and race = r;
    select coalesce((select b.choices from public.ballots b where b.election_id = e.id and b.race = r and b.entered_by = auth.uid() order by b.created_at desc limit 1), '{}') into mine;
    select exists (select 1 from public.race_confirmations x where x.election_id = e.id and x.race = r) into confirmed;
    select coalesce((select b.entered_by = auth.uid() from public.ballots b where b.election_id = e.id and b.race = r order by b.created_at desc limit 1), false) into mine_last;
    select exists (select 1 from public.counting_desks d where d.election_id = e.id and d.school = split_part(r, '-', 2) and d.user_id = auth.uid()) into desk_mine;
    select count(*) into registered from public.profiles where public.school_of_grade(grade_level) = split_part(r, '-', 2);
    issued := null;
    if to_regclass('public.ballot_checkins') is not null then
      execute 'select count(*) from public.ballot_checkins c join public.profiles p on p.id = c.student_id where c.election_id = $1 and public.school_of_grade(p.grade_level) = $2'
        using e.id, split_part(r, '-', 2) into issued;
    end if;

    races := races || jsonb_build_object(
      'race', r, 'kind', split_part(r, '-', 1), 'school', split_part(r, '-', 2),
      'maxChoices', case when r like 'senate-%' then 3 else 1 end,
      'seats', case when r like 'senate-%' then 5 else 1 end,
      'valid', n_valid, 'invalid', n_invalid, 'blank', n_blank,
      'issued', issued, 'registered', registered,
      'confirmed', confirmed, 'countedByMe', mine_last, 'deskMine', desk_mine, 'lastBallotAt', last_at,
      'lastChoices', to_jsonb(mine), 'candidates', cands);
  end loop;
  return jsonb_build_object('status', e.counting_status, 'startedAt', e.counting_started_at, 'endedAt', e.counting_ended_at, 'races', races, 'desks', desks);
end $$;

-- Ballots can only be entered by whoever holds the desk for that school.
create or replace function public.record_ballot(p_race text, p_kind text, p_choices uuid[] default '{}')
returns int language plpgsql security definer set search_path = public as $$
declare e public.elections%rowtype; maxc int; n int;
begin
  if not public.is_staff(auth.uid()) then raise exception 'Only staff can count ballots.'; end if;
  select * into e from public.elections order by created_at desc limit 1;
  if not found or e.counting_status <> 'counting' then raise exception 'Counting is not open.'; end if;
  if not exists (select 1 from public.counting_desks where election_id = e.id and school = split_part(p_race, '-', 2) and user_id = auth.uid()) then
    raise exception 'Take the % desk to count this school.', split_part(p_race, '-', 2);
  end if;
  if exists (select 1 from public.race_confirmations where election_id = e.id and race = p_race) then raise exception 'This race is confirmed. An admin must reopen it.'; end if;
  if not exists (select 1 from public.race_candidates(e.id, p_race)) then raise exception 'Unknown race.'; end if;
  maxc := case when p_race like 'senate-%' then 3 else 1 end;
  p_choices := coalesce(p_choices, '{}');
  if p_kind = 'valid' then
    if cardinality(p_choices) < 1 or cardinality(p_choices) > maxc then raise exception 'Choose between 1 and % candidate(s), or mark the ballot invalid.', maxc; end if;
    if (select count(distinct x) from unnest(p_choices) x) <> cardinality(p_choices) then raise exception 'A candidate can only be marked once per ballot.'; end if;
    if exists (select 1 from unnest(p_choices) x where x not in (select c.id from public.race_candidates(e.id, p_race) c)) then raise exception 'Unknown candidate for this race.'; end if;
  elsif p_kind in ('invalid', 'blank') then
    p_choices := '{}';
  else
    raise exception 'Unknown ballot type.';
  end if;
  insert into public.ballots (election_id, race, kind, choices, entered_by) values (e.id, p_race, p_kind, p_choices, auth.uid());
  select count(*) into n from public.ballots where election_id = e.id and race = p_race;
  return n;
end $$;

create or replace function public.undo_ballot(p_race text)
returns int language plpgsql security definer set search_path = public as $$
declare e public.elections%rowtype; bid uuid; n int;
begin
  if not public.is_staff(auth.uid()) then raise exception 'Only staff can count ballots.'; end if;
  select * into e from public.elections order by created_at desc limit 1;
  if not found or e.counting_status <> 'counting' then raise exception 'Counting is not open.'; end if;
  if not exists (select 1 from public.counting_desks where election_id = e.id and school = split_part(p_race, '-', 2) and user_id = auth.uid()) then
    raise exception 'Take the % desk to count this school.', split_part(p_race, '-', 2);
  end if;
  if exists (select 1 from public.race_confirmations where election_id = e.id and race = p_race) then raise exception 'This race is confirmed. An admin must reopen it.'; end if;
  select id into bid from public.ballots where election_id = e.id and race = p_race and entered_by = auth.uid() order by created_at desc limit 1;
  if bid is null then raise exception 'You have no ballot to undo in this race.'; end if;
  delete from public.ballots where id = bid;
  select count(*) into n from public.ballots where election_id = e.id and race = p_race;
  return n;
end $$;

-- Confirming is a cross-check: not by the desk holder and not by whoever entered the last ballot.
create or replace function public.confirm_race(p_race text)
returns void language plpgsql security definer set search_path = public as $$
declare e public.elections%rowtype; last_by uuid;
begin
  if not public.is_staff(auth.uid()) then raise exception 'Only staff can confirm a count.'; end if;
  select * into e from public.elections order by created_at desc limit 1;
  if not found or e.counting_status <> 'counting' then raise exception 'Counting is not open.'; end if;
  select entered_by into last_by from public.ballots where election_id = e.id and race = p_race order by created_at desc limit 1;
  if not found then raise exception 'No ballots have been counted in this race yet.'; end if;
  if last_by = auth.uid() or exists (select 1 from public.counting_desks where election_id = e.id and school = split_part(p_race, '-', 2) and user_id = auth.uid()) then
    raise exception 'Someone other than this school''s counter must confirm this count.';
  end if;
  insert into public.race_confirmations (election_id, race, confirmed_by) values (e.id, p_race, auth.uid()) on conflict do nothing;
  insert into public.audit_logs (actor_id, action, entity_type, metadata) values (auth.uid(), 'results.confirmed', 'election_results', jsonb_build_object('race', p_race, 'election_id', e.id));
end $$;

revoke all on function public.claim_desk(text, boolean) from public, anon;
revoke all on function public.release_desk(text) from public, anon;
grant execute on function public.claim_desk(text, boolean) to authenticated;
grant execute on function public.release_desk(text) to authenticated;
