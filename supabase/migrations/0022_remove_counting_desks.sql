-- Two or three people count each school at the same time, so a school no longer has a single "desk holder".
-- Any staff member can enter ballots in any race, and every counter sees everyone's ballots live (Realtime).
--   * a race is still confirmed by someone other than whoever entered its last ballot
--   * an admin still starts counting, ends the election and reopens races

drop function if exists public.claim_desk(text, boolean);
drop function if exists public.release_desk(text);
drop table if exists public.counting_desks; -- also leaves the Realtime publication

create or replace function public.live_results()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  e public.elections%rowtype;
  r text; cands jsonb; races jsonb := '[]'::jsonb;
  n_valid int; n_invalid int; n_blank int; issued int; registered int; mine uuid[];
  confirmed boolean; mine_last boolean; last_at timestamptz;
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

    select count(*) filter (where kind = 'valid'), count(*) filter (where kind = 'invalid'), count(*) filter (where kind = 'blank'), max(created_at)
      into n_valid, n_invalid, n_blank, last_at from public.ballots where election_id = e.id and race = r;
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
      'confirmed', confirmed, 'countedByMe', mine_last, 'lastBallotAt', last_at,
      'lastChoices', to_jsonb(mine), 'candidates', cands);
  end loop;
  return jsonb_build_object('status', e.counting_status, 'startedAt', e.counting_started_at, 'endedAt', e.counting_ended_at, 'races', races);
end $$;

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
