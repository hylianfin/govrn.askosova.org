-- Ballot-by-ballot counting for election night, in the style of the national count screen:
--   * races are per school (middle / high): Government (pick 1 numbered team) and Senate (pick up to 3 numbers)
--   * staff record each paper ballot: the numbers marked on it, or "invalid" / "blank"
--   * every ballot is its own row, so the last one can be undone and the totals can always be re-derived
--   * a race is confirmed by a different staff member than the one who entered the last ballot
--   * an admin starts counting and ends the election, which locks every edit
-- There is no public page: results are for staff and admins. Apply after 0017 (polling desk), which the
-- "ballots issued" counter reads.

alter table public.elections
  add column if not exists counting_status text not null default 'not_started',
  add column if not exists counting_started_at timestamptz,
  add column if not exists counting_ended_at timestamptz;
alter table public.elections drop constraint if exists elections_counting_status_check;
alter table public.elections add constraint elections_counting_status_check check (counting_status in ('not_started','counting','ended'));

create table if not exists public.ballots (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.elections(id) on delete cascade,
  race text not null check (race in ('exec-middle','exec-high','senate-middle','senate-high')),
  kind text not null check (kind in ('valid','invalid','blank')),
  choices uuid[] not null default '{}',
  entered_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  check ((kind = 'valid' and cardinality(choices) between 1 and 3) or (kind <> 'valid' and cardinality(choices) = 0))
);
create index if not exists idx_ballots_race on public.ballots (election_id, race, created_at);

create table if not exists public.race_confirmations (
  election_id uuid not null references public.elections(id) on delete cascade,
  race text not null check (race in ('exec-middle','exec-high','senate-middle','senate-high')),
  confirmed_by uuid not null references auth.users(id),
  confirmed_at timestamptz not null default now(),
  primary key (election_id, race)
);

-- No direct writes: every change goes through the functions below, which check the caller and the election state.
alter table public.ballots enable row level security;
alter table public.race_confirmations enable row level security;
drop policy if exists "ballots staff read" on public.ballots;
drop policy if exists "race_confirmations staff read" on public.race_confirmations;
create policy "ballots staff read" on public.ballots for select using (public.is_staff(auth.uid()));
create policy "race_confirmations staff read" on public.race_confirmations for select using (public.is_staff(auth.uid()));

create or replace function public.school_of_grade(g int)
returns text language sql immutable as $$
  select case when g is null then null when g <= 8 then 'middle' else 'high' end;
$$;

-- Candidates in a race, numbered 1..N in creation order (this must match the numbers printed on the paper ballot):
-- approved executive teams (school from their grade levels, high school by default) with their four members,
-- and approved Senate applicants (school from their grade).
create or replace function public.race_candidates(p_election uuid, p_race text)
returns table (id uuid, num int, label text, sub text, members jsonb)
language sql stable security definer set search_path = public as $$
  with c as (
    select t.id, t.name::text as label, t.slogan::text as sub,
           (select coalesce(jsonb_agg(jsonb_build_object('role', m.position, 'name', coalesce(p.full_name, p.email))
                    order by case m.position when 'president' then 1 when 'vice_president' then 2 when 'secretary' then 3 else 4 end), '[]'::jsonb)
              from public.executive_team_members m join public.profiles p on p.id = m.user_id where m.team_id = t.id) as members,
           t.created_at as ord
    from public.executive_teams t
    join public.applications a on a.id = t.application_id and a.status = 'approved'
    where p_race like 'exec-%' and t.election_id = p_election
      and coalesce((
        select public.school_of_grade(max(g::int))
        from jsonb_array_elements_text(case when jsonb_typeof(t.grade_levels) = 'array' then t.grade_levels else '[]'::jsonb end) g
        where g ~ '^[0-9]+$'
      ), 'high') = substr(p_race, 6)
    union all
    select p.id, coalesce(p.full_name, p.email)::text, ('Grade ' || p.grade_level)::text, '[]'::jsonb, a.created_at
    from public.applications a
    join public.profiles p on p.id = a.applicant_id
    where p_race like 'senate-%' and a.kind = 'senate' and a.status = 'approved'
      and public.school_of_grade(p.grade_level) = substr(p_race, 8)
  )
  select c.id, (row_number() over (order by c.ord, c.id))::int, c.label, c.sub, c.members from c order by 2;
$$;
revoke all on function public.race_candidates(uuid, text) from public;

-- One call for everything the counting screen shows. Staff only.
create or replace function public.live_results()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  e public.elections%rowtype;
  r text; cands jsonb; races jsonb := '[]'::jsonb;
  n_valid int; n_invalid int; n_blank int; issued int; registered int; mine uuid[];
  confirmed boolean; mine_last boolean;
begin
  select * into e from public.elections order by created_at desc limit 1;
  if not found or not public.is_staff(auth.uid()) then
    return jsonb_build_object('status', coalesce(e.counting_status, 'not_started'), 'races', '[]'::jsonb);
  end if;
  foreach r in array array['exec-middle','exec-high','senate-middle','senate-high'] loop
    select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'num', c.num, 'label', c.label, 'sub', c.sub, 'members', c.members, 'votes', coalesce(v.n, 0)) order by c.num), '[]'::jsonb)
      into cands
      from public.race_candidates(e.id, r) c
      left join (
        select cid, count(*)::int n from public.ballots b, unnest(b.choices) cid
        where b.election_id = e.id and b.race = r and b.kind = 'valid' group by cid
      ) v on v.cid = c.id;
    continue when jsonb_array_length(cands) = 0;

    select count(*) filter (where kind = 'valid'), count(*) filter (where kind = 'invalid'), count(*) filter (where kind = 'blank')
      into n_valid, n_invalid, n_blank from public.ballots where election_id = e.id and race = r;
    select coalesce((select b.choices from public.ballots b where b.election_id = e.id and b.race = r and b.entered_by = auth.uid() order by b.created_at desc limit 1), '{}') into mine;
    select exists (select 1 from public.race_confirmations x where x.election_id = e.id and x.race = r) into confirmed;
    select coalesce((select b.entered_by = auth.uid() from public.ballots b where b.election_id = e.id and b.race = r order by b.created_at desc limit 1), false) into mine_last;
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
      'confirmed', confirmed, 'countedByMe', mine_last,
      'lastChoices', to_jsonb(mine), 'candidates', cands);
  end loop;
  return jsonb_build_object('status', e.counting_status, 'startedAt', e.counting_started_at, 'endedAt', e.counting_ended_at, 'races', races);
end $$;

-- Record one paper ballot: kind 'valid' with the chosen candidates (1 for Government, up to 3 for Senate), or 'invalid' / 'blank'.
create or replace function public.record_ballot(p_race text, p_kind text, p_choices uuid[] default '{}')
returns int language plpgsql security definer set search_path = public as $$
declare e public.elections%rowtype; maxc int; n int;
begin
  if not public.is_staff(auth.uid()) then raise exception 'Only staff can count ballots.'; end if;
  select * into e from public.elections order by created_at desc limit 1;
  if not found or e.counting_status <> 'counting' then raise exception 'Counting is not open.'; end if;
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

-- Undo the most recent ballot you entered in this race.
create or replace function public.undo_ballot(p_race text)
returns int language plpgsql security definer set search_path = public as $$
declare e public.elections%rowtype; bid uuid; n int;
begin
  if not public.is_staff(auth.uid()) then raise exception 'Only staff can count ballots.'; end if;
  select * into e from public.elections order by created_at desc limit 1;
  if not found or e.counting_status <> 'counting' then raise exception 'Counting is not open.'; end if;
  if exists (select 1 from public.race_confirmations where election_id = e.id and race = p_race) then raise exception 'This race is confirmed. An admin must reopen it.'; end if;
  select id into bid from public.ballots where election_id = e.id and race = p_race and entered_by = auth.uid() order by created_at desc limit 1;
  if bid is null then raise exception 'You have no ballot to undo in this race.'; end if;
  delete from public.ballots where id = bid;
  select count(*) into n from public.ballots where election_id = e.id and race = p_race;
  return n;
end $$;

create or replace function public.confirm_race(p_race text)
returns void language plpgsql security definer set search_path = public as $$
declare e public.elections%rowtype; last_by uuid;
begin
  if not public.is_staff(auth.uid()) then raise exception 'Only staff can confirm a count.'; end if;
  select * into e from public.elections order by created_at desc limit 1;
  if not found or e.counting_status <> 'counting' then raise exception 'Counting is not open.'; end if;
  select entered_by into last_by from public.ballots where election_id = e.id and race = p_race order by created_at desc limit 1;
  if not found then raise exception 'No ballots have been counted in this race yet.'; end if;
  if last_by = auth.uid() then raise exception 'A different staff member must confirm this count.'; end if;
  insert into public.race_confirmations (election_id, race, confirmed_by) values (e.id, p_race, auth.uid()) on conflict do nothing;
  insert into public.audit_logs (actor_id, action, entity_type, metadata) values (auth.uid(), 'results.confirmed', 'election_results', jsonb_build_object('race', p_race, 'election_id', e.id));
end $$;

create or replace function public.reopen_race(p_race text)
returns void language plpgsql security definer set search_path = public as $$
declare e public.elections%rowtype;
begin
  if not public.is_admin(auth.uid()) then raise exception 'Only an admin can reopen a race.'; end if;
  select * into e from public.elections order by created_at desc limit 1;
  if not found or e.counting_status <> 'counting' then raise exception 'Reopen the election first.'; end if;
  delete from public.race_confirmations where election_id = e.id and race = p_race;
  insert into public.audit_logs (actor_id, action, entity_type, metadata) values (auth.uid(), 'results.reopened', 'election_results', jsonb_build_object('race', p_race, 'election_id', e.id));
end $$;

-- 'counting' starts (or reopens) the election, 'ended' locks it once every race is confirmed.
create or replace function public.set_counting(p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare e public.elections%rowtype; r text;
begin
  if not public.is_admin(auth.uid()) then raise exception 'Only an admin can start or end counting.'; end if;
  select * into e from public.elections order by created_at desc limit 1;
  if not found then raise exception 'No election is configured.'; end if;
  if p_status = 'counting' then
    if e.counting_status = 'counting' then return; end if;
    update public.elections set counting_status = 'counting', counting_started_at = coalesce(counting_started_at, now()), counting_ended_at = null where id = e.id;
  elsif p_status = 'ended' then
    if e.counting_status <> 'counting' then raise exception 'Counting has not started.'; end if;
    foreach r in array array['exec-middle','exec-high','senate-middle','senate-high'] loop
      if exists (select 1 from public.race_candidates(e.id, r))
         and not exists (select 1 from public.race_confirmations where election_id = e.id and race = r) then
        raise exception 'Confirm every race before ending the election (%).', r;
      end if;
    end loop;
    update public.elections set counting_status = 'ended', counting_ended_at = now() where id = e.id;
  else
    raise exception 'Unknown status.';
  end if;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata) values (auth.uid(), 'election.' || p_status, 'elections', e.id, '{}'::jsonb);
end $$;

-- Only signed-in users can call these; each function checks the role itself.
revoke all on function public.live_results() from public;
revoke all on function public.record_ballot(text, text, uuid[]) from public;
revoke all on function public.undo_ballot(text) from public;
revoke all on function public.confirm_race(text) from public;
revoke all on function public.reopen_race(text) from public;
revoke all on function public.set_counting(text) from public;
grant execute on function public.live_results() to authenticated;
grant execute on function public.record_ballot(text, text, uuid[]) to authenticated;
grant execute on function public.undo_ballot(text) to authenticated;
grant execute on function public.confirm_race(text) to authenticated;
grant execute on function public.reopen_race(text) to authenticated;
grant execute on function public.set_counting(text) to authenticated;
