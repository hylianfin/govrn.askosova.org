-- Ballot history, integrity settings, reconciliation, recounts.
--   * every ballot is permanent: "undo" voids a ballot (who and when are kept), nothing is ever deleted or edited
--   * ballots are chained with hashes, so a missing or altered ballot is detectable afterwards
--   * admins record how many ballots were printed, how many were issued and how many people are registered
--   * a reconciliation compares those numbers with the count, and its problems are sent to every admin
--   * an admin can start a recount of a race; earlier rounds stay in the history for comparison

-- 1. Permanent ballots ---------------------------------------------------------------------------------------------
alter table public.ballots
  add column if not exists seq bigint generated always as identity,
  add column if not exists round int not null default 1,
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references auth.users(id),
  add column if not exists prev_hash text,
  add column if not exists hash text;
create index if not exists idx_ballots_seq on public.ballots (election_id, seq);

create or replace function public.ballots_guard() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then raise exception 'Ballots are never deleted. They can only be voided.'; end if;
  if tg_op = 'TRUNCATE' then raise exception 'Ballots cannot be cleared.'; end if;
  if old.voided_at is not null then raise exception 'A voided ballot cannot change.'; end if;
  if new.id is distinct from old.id or new.election_id is distinct from old.election_id or new.race is distinct from old.race
     or new.kind is distinct from old.kind or new.choices is distinct from old.choices or new.entered_by is distinct from old.entered_by
     or new.created_at is distinct from old.created_at or new.round is distinct from old.round or new.seq is distinct from old.seq
     or new.prev_hash is distinct from old.prev_hash or new.hash is distinct from old.hash then
    raise exception 'Ballots cannot be edited.';
  end if;
  return new;
end $$;
drop trigger if exists ballots_guard on public.ballots;
create trigger ballots_guard before update or delete on public.ballots for each row execute function public.ballots_guard();
drop trigger if exists ballots_no_truncate on public.ballots;
create trigger ballots_no_truncate before truncate on public.ballots for each statement execute function public.ballots_guard();

create or replace function public.ballot_hash(prev text, b public.ballots) returns text language sql immutable as $$
  select encode(sha256(convert_to(coalesce(prev, '') || '|' || b.id::text || '|' || b.election_id::text || '|' || b.race || '|' || b.round::text || '|' || b.kind
    || '|' || coalesce(array_to_string(b.choices, ','), '') || '|' || coalesce(b.entered_by::text, '') || '|' || to_char(b.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'), 'utf8')), 'hex');
$$;

-- The latest hash of each election's chain. It is locked while a ballot is added, so the chain stays in one order.
create table if not exists public.ballot_chain_tip (
  election_id uuid primary key references public.elections(id) on delete cascade,
  hash text
);
alter table public.ballot_chain_tip enable row level security;

create or replace function public.ballots_chain() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.ballot_chain_tip (election_id, hash) values (new.election_id, null) on conflict do nothing;
  select hash into new.prev_hash from public.ballot_chain_tip where election_id = new.election_id for update;
  new.hash := public.ballot_hash(new.prev_hash, new);
  update public.ballot_chain_tip set hash = new.hash where election_id = new.election_id;
  return new;
end $$;
drop trigger if exists ballots_chain on public.ballots;
create trigger ballots_chain before insert on public.ballots for each row execute function public.ballots_chain();

-- 2. Rounds (recounts) and integrity settings -------------------------------------------------------------------------
create table if not exists public.race_rounds (
  election_id uuid not null references public.elections(id) on delete cascade,
  race text not null check (race in ('exec-middle','exec-high','senate-middle','senate-high')),
  round int not null default 1,
  started_by uuid references auth.users(id),
  started_at timestamptz not null default now(),
  reason text,
  primary key (election_id, race)
);

create table if not exists public.election_integrity (
  election_id uuid not null references public.elections(id) on delete cascade,
  school text not null check (school in ('middle','high')),
  printed_government int check (printed_government >= 0),
  printed_senate int check (printed_senate >= 0),
  issued_override int check (issued_override >= 0),
  registered_override int check (registered_override >= 0),
  note text,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key (election_id, school)
);

alter table public.race_rounds enable row level security;
alter table public.election_integrity enable row level security;
drop policy if exists "race_rounds staff read" on public.race_rounds;
drop policy if exists "election_integrity staff read" on public.election_integrity;
create policy "race_rounds staff read" on public.race_rounds for select using (public.is_staff(auth.uid()));
create policy "election_integrity staff read" on public.election_integrity for select using (public.is_staff(auth.uid()));

do $$
declare t text;
begin
  foreach t in array array['race_rounds', 'election_integrity'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

create or replace function public.current_round(p_election uuid, p_race text)
returns int language sql stable as $$
  select coalesce((select round from public.race_rounds where election_id = p_election and race = p_race), 1);
$$;

-- Numbers used everywhere: what an admin typed in, or else what the system knows.
create or replace function public.effective_registered(p_election uuid, p_school text)
returns int language sql stable security definer set search_path = public as $$
  select coalesce((select registered_override from public.election_integrity where election_id = p_election and school = p_school),
                  (select count(*)::int from public.profiles where public.school_of_grade(grade_level) = p_school));
$$;
create or replace function public.effective_issued(p_election uuid, p_school text)
returns int language plpgsql stable security definer set search_path = public as $$
declare o int; n int;
begin
  select issued_override into o from public.election_integrity where election_id = p_election and school = p_school;
  if o is not null then return o; end if;
  if to_regclass('public.ballot_checkins') is null then return null; end if;
  execute 'select count(*)::int from public.ballot_checkins c join public.profiles p on p.id = c.student_id where c.election_id = $1 and public.school_of_grade(p.grade_level) = $2'
    using p_election, p_school into n;
  return n;
end $$;

create or replace function public.set_integrity(p_school text, p_printed_government int, p_printed_senate int, p_issued int, p_registered int, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare e public.elections%rowtype; old jsonb;
begin
  if not public.is_admin(auth.uid()) then raise exception 'Only an admin can change the integrity numbers.'; end if;
  if p_school not in ('middle', 'high') then raise exception 'Unknown school.'; end if;
  select * into e from public.elections order by created_at desc limit 1;
  if not found then raise exception 'No election is configured.'; end if;
  if e.counting_status = 'ended' then raise exception 'The election has ended. Reopen it to change these numbers.'; end if;
  select to_jsonb(i) into old from public.election_integrity i where election_id = e.id and school = p_school;
  insert into public.election_integrity (election_id, school, printed_government, printed_senate, issued_override, registered_override, note, updated_by, updated_at)
    values (e.id, p_school, p_printed_government, p_printed_senate, p_issued, p_registered, p_note, auth.uid(), now())
    on conflict (election_id, school) do update set printed_government = excluded.printed_government, printed_senate = excluded.printed_senate,
      issued_override = excluded.issued_override, registered_override = excluded.registered_override, note = excluded.note, updated_by = auth.uid(), updated_at = now();
  insert into public.audit_logs (actor_id, action, entity_type, metadata) values (auth.uid(), 'integrity.updated', 'election_integrity',
    jsonb_build_object('school', p_school, 'election_id', e.id, 'before', old, 'after', jsonb_build_object('printed_government', p_printed_government, 'printed_senate', p_printed_senate, 'issued', p_issued, 'registered', p_registered, 'note', p_note)));
end $$;

-- 3. Counting now writes to the current round, and "undo" voids -------------------------------------------------------
create or replace function public.record_ballot(p_race text, p_kind text, p_choices uuid[] default '{}')
returns int language plpgsql security definer set search_path = public as $$
declare e public.elections%rowtype; maxc int; n int; cur int;
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
  cur := public.current_round(e.id, p_race);
  insert into public.ballots (election_id, race, kind, choices, entered_by, round) values (e.id, p_race, p_kind, p_choices, auth.uid(), cur);
  select count(*) into n from public.ballots where election_id = e.id and race = p_race and round = cur and voided_at is null;
  return n;
end $$;

create or replace function public.undo_ballot(p_race text)
returns int language plpgsql security definer set search_path = public as $$
declare e public.elections%rowtype; bid uuid; n int; cur int;
begin
  if not public.is_staff(auth.uid()) then raise exception 'Only staff can count ballots.'; end if;
  select * into e from public.elections order by created_at desc limit 1;
  if not found or e.counting_status <> 'counting' then raise exception 'Counting is not open.'; end if;
  if exists (select 1 from public.race_confirmations where election_id = e.id and race = p_race) then raise exception 'This race is confirmed. An admin must reopen it.'; end if;
  cur := public.current_round(e.id, p_race);
  select id into bid from public.ballots where election_id = e.id and race = p_race and round = cur and voided_at is null and entered_by = auth.uid() order by seq desc limit 1;
  if bid is null then raise exception 'You have no ballot to undo in this race.'; end if;
  update public.ballots set voided_at = now(), voided_by = auth.uid() where id = bid;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata) values (auth.uid(), 'ballot.voided', 'ballots', bid, jsonb_build_object('race', p_race, 'election_id', e.id, 'round', cur));
  select count(*) into n from public.ballots where election_id = e.id and race = p_race and round = cur and voided_at is null;
  return n;
end $$;

-- 4. Live numbers, including the integrity figures and earlier rounds -----------------------------------------------------
create or replace function public.live_results()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  e public.elections%rowtype;
  r text; sch text; cands jsonb; races jsonb := '[]'::jsonb; rounds jsonb; cur int;
  n_valid int; n_invalid int; n_blank int; n_void int; issued int; registered int; printed int; mine uuid[];
  confirmed boolean; mine_last boolean; last_at timestamptz;
begin
  select * into e from public.elections order by created_at desc limit 1;
  if not found or not public.is_staff(auth.uid()) then
    return jsonb_build_object('status', coalesce(e.counting_status, 'not_started'), 'races', '[]'::jsonb);
  end if;
  foreach r in array array['exec-middle','exec-high','senate-middle','senate-high'] loop
    sch := split_part(r, '-', 2);
    cur := public.current_round(e.id, r);
    select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'num', c.num, 'label', c.label, 'sub', c.sub, 'members', c.members, 'votes', coalesce(v.n, 0)) order by c.num), '[]'::jsonb)
      into cands
      from public.race_candidates(e.id, r) c
      left join (
        select cid, count(*)::int n from public.ballots b, unnest(b.choices) cid
        where b.election_id = e.id and b.race = r and b.round = cur and b.voided_at is null and b.kind = 'valid' group by cid
      ) v on v.cid = c.id;
    continue when jsonb_array_length(cands) = 0;

    select count(*) filter (where kind = 'valid'), count(*) filter (where kind = 'invalid'), count(*) filter (where kind = 'blank'), max(created_at)
      into n_valid, n_invalid, n_blank, last_at from public.ballots where election_id = e.id and race = r and round = cur and voided_at is null;
    select count(*) into n_void from public.ballots where election_id = e.id and race = r and round = cur and voided_at is not null;
    select coalesce((select b.choices from public.ballots b where b.election_id = e.id and b.race = r and b.round = cur and b.voided_at is null and b.entered_by = auth.uid() order by b.seq desc limit 1), '{}') into mine;
    select exists (select 1 from public.race_confirmations x where x.election_id = e.id and x.race = r) into confirmed;
    select coalesce((select b.entered_by = auth.uid() from public.ballots b where b.election_id = e.id and b.race = r and b.round = cur and b.voided_at is null order by b.seq desc limit 1), false) into mine_last;
    registered := public.effective_registered(e.id, sch);
    issued := public.effective_issued(e.id, sch);
    select case when r like 'exec-%' then printed_government else printed_senate end into printed from public.election_integrity where election_id = e.id and school = sch;

    select coalesce(jsonb_agg(jsonb_build_object('round', k, 'valid', x.valid, 'invalid', x.invalid, 'blank', x.blank, 'votes', x.votes) order by k), '[]'::jsonb)
      into rounds
      from generate_series(1, cur - 1) k
      cross join lateral (
        select (select count(*) from public.ballots b where b.election_id = e.id and b.race = r and b.round = k and b.voided_at is null and b.kind = 'valid') valid,
               (select count(*) from public.ballots b where b.election_id = e.id and b.race = r and b.round = k and b.voided_at is null and b.kind = 'invalid') invalid,
               (select count(*) from public.ballots b where b.election_id = e.id and b.race = r and b.round = k and b.voided_at is null and b.kind = 'blank') blank,
               (select coalesce(jsonb_object_agg(cid::text, n), '{}'::jsonb) from (select cid, count(*) n from public.ballots b, unnest(b.choices) cid
                  where b.election_id = e.id and b.race = r and b.round = k and b.voided_at is null and b.kind = 'valid' group by cid) q) votes
      ) x;

    races := races || jsonb_build_object(
      'race', r, 'kind', split_part(r, '-', 1), 'school', sch,
      'maxChoices', case when r like 'senate-%' then 3 else 1 end,
      'seats', case when r like 'senate-%' then 5 else 1 end,
      'round', cur, 'rounds', rounds, 'voided', n_void,
      'valid', n_valid, 'invalid', n_invalid, 'blank', n_blank,
      'printed', printed, 'issued', issued, 'registered', registered,
      'confirmed', confirmed, 'countedByMe', mine_last, 'lastBallotAt', last_at,
      'lastChoices', to_jsonb(mine), 'candidates', cands);
  end loop;
  return jsonb_build_object('status', e.counting_status, 'startedAt', e.counting_started_at, 'endedAt', e.counting_ended_at, 'races', races);
end $$;

-- 5. Reconciliation: do the numbers add up? ------------------------------------------------------------------------------
create or replace function public.reconciliation()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  e public.elections%rowtype; sch text; r text; checks jsonb := '[]'::jsonb;
  reg int; iss int; pg int; ps int; cg int; cs int; vg int; vs int; cur int; margin int; top1 int; top2 int; dev int; recount_diff int;
  lbl text; errs int := 0; warns int := 0;
begin
  if not public.is_staff(auth.uid()) then return jsonb_build_object('checks', '[]'::jsonb, 'errors', 0, 'warnings', 0); end if;
  select * into e from public.elections order by created_at desc limit 1;
  if not found then return jsonb_build_object('checks', '[]'::jsonb, 'errors', 0, 'warnings', 0); end if;

  foreach sch in array array['middle', 'high'] loop
    continue when not exists (select 1 from public.race_candidates(e.id, 'exec-' || sch)) and not exists (select 1 from public.race_candidates(e.id, 'senate-' || sch));
    lbl := case sch when 'middle' then 'Middle School' else 'High School' end;
    reg := public.effective_registered(e.id, sch);
    iss := public.effective_issued(e.id, sch);
    select printed_government, printed_senate into pg, ps from public.election_integrity where election_id = e.id and school = sch;
    cg := (select count(*) from public.ballots b where b.election_id = e.id and b.race = 'exec-' || sch and b.round = public.current_round(e.id, 'exec-' || sch) and b.voided_at is null);
    cs := (select count(*) from public.ballots b where b.election_id = e.id and b.race = 'senate-' || sch and b.round = public.current_round(e.id, 'senate-' || sch) and b.voided_at is null);
    dev := 0;

    if pg is null and ps is null then checks := checks || jsonb_build_object('id', 'printed-missing-' || sch, 'level', 'warn', 'school', sch, 'title', lbl || ': printed ballots not entered', 'detail', 'Enter how many ballots were printed so printing and issuing can be compared.'); end if;
    if iss is null then checks := checks || jsonb_build_object('id', 'issued-missing-' || sch, 'level', 'warn', 'school', sch, 'title', lbl || ': ballots issued unknown', 'detail', 'No polling-desk check-ins and no number entered by an admin.'); end if;

    if iss is not null and pg is not null and iss > pg then
      dev := greatest(dev, iss - pg);
      checks := checks || jsonb_build_object('id', 'issued-gt-printed-gov-' || sch, 'level', 'error', 'school', sch, 'title', lbl || ': more Government ballots issued than printed', 'detail', iss || ' issued, ' || pg || ' printed.');
    end if;
    if iss is not null and ps is not null and iss > ps then
      dev := greatest(dev, iss - ps);
      checks := checks || jsonb_build_object('id', 'issued-gt-printed-sen-' || sch, 'level', 'error', 'school', sch, 'title', lbl || ': more Senate ballots issued than printed', 'detail', iss || ' issued, ' || ps || ' printed.');
    end if;
    if iss is not null and reg is not null and iss > reg then
      dev := greatest(dev, iss - reg);
      checks := checks || jsonb_build_object('id', 'issued-gt-registered-' || sch, 'level', 'error', 'school', sch, 'title', lbl || ': more ballots issued than registered voters', 'detail', iss || ' issued, ' || reg || ' registered.');
    end if;
    if iss is not null and cg > iss then
      dev := greatest(dev, cg - iss);
      checks := checks || jsonb_build_object('id', 'counted-gt-issued-gov-' || sch, 'level', 'error', 'school', sch, 'title', lbl || ': more Government ballots counted than issued', 'detail', cg || ' counted, ' || iss || ' issued. Ballots may have been added.');
    end if;
    if iss is not null and cs > iss then
      dev := greatest(dev, cs - iss);
      checks := checks || jsonb_build_object('id', 'counted-gt-issued-sen-' || sch, 'level', 'error', 'school', sch, 'title', lbl || ': more Senate ballots counted than issued', 'detail', cs || ' counted, ' || iss || ' issued. Ballots may have been added.');
    end if;
    if reg is not null and greatest(cg, cs) > reg then
      dev := greatest(dev, greatest(cg, cs) - reg);
      checks := checks || jsonb_build_object('id', 'counted-gt-registered-' || sch, 'level', 'error', 'school', sch, 'title', lbl || ': more ballots counted than registered voters', 'detail', greatest(cg, cs) || ' counted, ' || reg || ' registered.');
    end if;
    if cg <> cs and (cg > 0 or cs > 0) then
      dev := greatest(dev, abs(cg - cs));
      checks := checks || jsonb_build_object('id', 'gov-sen-differ-' || sch, 'level', case when abs(cg - cs) > greatest(3, coalesce(iss, cg) * 0.02) then 'error' else 'warn' end, 'school', sch,
        'title', lbl || ': Government and Senate counts differ', 'detail', 'Each voter gets both ballots, but ' || cg || ' Government and ' || cs || ' Senate ballots were counted.');
    end if;
    if iss is not null and greatest(cg, cs) < iss and (cg > 0 or cs > 0) then
      checks := checks || jsonb_build_object('id', 'issued-not-counted-' || sch, 'level', 'warn', 'school', sch, 'title', lbl || ': issued ballots not counted', 'detail', (iss - greatest(cg, cs)) || ' ballots were issued but not found in the count (not cast, spoiled or lost). They should be accounted for.');
    end if;
    if pg is not null and iss is not null and pg >= iss then
      checks := checks || jsonb_build_object('id', 'unused-' || sch, 'level', 'ok', 'school', sch, 'title', lbl || ': unused ballots', 'detail', (pg - iss) || ' Government ballots were printed but not issued.');
    end if;
  end loop;

  foreach r in array array['exec-middle', 'exec-high', 'senate-middle', 'senate-high'] loop
    continue when not exists (select 1 from public.race_candidates(e.id, r));
    sch := split_part(r, '-', 2);
    lbl := (case sch when 'middle' then 'Middle School' else 'High School' end) || ' ' || (case when r like 'exec-%' then 'Government' else 'Senate' end);
    cur := public.current_round(e.id, r);
    vg := (select count(*) from public.ballots b where b.election_id = e.id and b.race = r and b.round = cur and b.voided_at is not null);
    cg := (select count(*) from public.ballots b where b.election_id = e.id and b.race = r and b.round = cur);
    if cg >= 10 and vg * 100 > cg * 10 then
      checks := checks || jsonb_build_object('id', 'many-voided-' || r, 'level', 'warn', 'school', sch, 'race', r, 'title', lbl || ': many ballots were undone', 'detail', vg || ' of ' || cg || ' entered ballots were voided. Check the ballot history for who undid them.');
    end if;
    if cur > 1 then
      recount_diff := (
        select coalesce(sum(abs(coalesce(a.n, 0) - coalesce(b.n, 0))), 0) from (
          select c.id, (select count(*) from public.ballots x where x.election_id = e.id and x.race = r and x.round = cur and x.voided_at is null and x.kind = 'valid' and c.id = any(x.choices)) n from public.race_candidates(e.id, r) c) a
        join (select c.id, (select count(*) from public.ballots x where x.election_id = e.id and x.race = r and x.round = cur - 1 and x.voided_at is null and x.kind = 'valid' and c.id = any(x.choices)) n from public.race_candidates(e.id, r) c) b on a.id = b.id);
      checks := checks || jsonb_build_object('id', 'recount-' || r, 'level', case when recount_diff > 0 then 'error' else 'ok' end, 'school', sch, 'race', r,
        'title', lbl || ': round ' || cur || ' compared with round ' || (cur - 1), 'detail', case when recount_diff > 0 then 'The recount differs from the earlier count by ' || recount_diff || ' vote(s) in total.' else 'The recount matches the earlier count.' end);
    end if;
  end loop;

  -- Problems that are large enough to change a Government result
  for sch in select unnest(array['middle', 'high']) loop
    continue when not exists (select 1 from public.race_candidates(e.id, 'exec-' || sch));
    reg := public.effective_registered(e.id, sch); iss := public.effective_issued(e.id, sch);
    cg := (select count(*) from public.ballots b where b.election_id = e.id and b.race = 'exec-' || sch and b.round = public.current_round(e.id, 'exec-' || sch) and b.voided_at is null);
    cs := (select count(*) from public.ballots b where b.election_id = e.id and b.race = 'senate-' || sch and b.round = public.current_round(e.id, 'senate-' || sch) and b.voided_at is null);
    cur := public.current_round(e.id, 'exec-' || sch);
    select max(v), (array_agg(v order by v desc))[2] into top1, top2 from (
      select (select count(*) from public.ballots x where x.election_id = e.id and x.race = 'exec-' || sch and x.round = cur and x.voided_at is null and x.kind = 'valid' and c.id = any(x.choices))::int v
      from public.race_candidates(e.id, 'exec-' || sch) c) q;
    margin := coalesce(top1, 0) - coalesce(top2, 0);
    dev := greatest(case when iss is not null then greatest(cg - iss, 0) else 0 end, abs(cg - cs), case when iss is not null then greatest(iss - greatest(cg, cs), 0) else 0 end);
    if dev > 0 and coalesce(top1, 0) > 0 and dev >= margin then
      checks := checks || jsonb_build_object('id', 'margin-' || sch, 'level', 'error', 'school', sch, 'race', 'exec-' || sch,
        'title', (case sch when 'middle' then 'Middle School' else 'High School' end) || ' Government: the gap is as large as the winning margin',
        'detail', 'The winner leads by ' || margin || ' vote(s), but the numbers differ by up to ' || dev || ' ballot(s). The result cannot be trusted until it is recounted or the election is repeated.');
    end if;
  end loop;

  select count(*) filter (where c ->> 'level' = 'error'), count(*) filter (where c ->> 'level' = 'warn') into errs, warns from jsonb_array_elements(checks) c;
  return jsonb_build_object('checks', checks, 'errors', errs, 'warnings', warns);
end $$;

-- Check that no ballot was removed or changed after it was entered.
create or replace function public.verify_ballot_chain()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare e public.elections%rowtype; bad bigint[] := '{}'; n int := 0; b public.ballots;
begin
  if not public.is_staff(auth.uid()) then return jsonb_build_object('ok', true, 'checked', 0, 'broken', '[]'::jsonb); end if;
  select * into e from public.elections order by created_at desc limit 1;
  for b in select * from public.ballots where election_id = e.id order by seq loop
    n := n + 1;
    if b.hash is distinct from public.ballot_hash(b.prev_hash, b)
       or (b.prev_hash is not null and not exists (select 1 from public.ballots p where p.election_id = e.id and p.hash = b.prev_hash)) then
      bad := bad || b.seq;
    end if;
  end loop;
  -- The newest ballot is the one the chain tip points at; if it is gone, the last ballot was removed.
  if exists (select 1 from public.ballot_chain_tip t where t.election_id = e.id and t.hash is not null)
     and not exists (select 1 from public.ballots x join public.ballot_chain_tip t on t.election_id = x.election_id and t.hash = x.hash where x.election_id = e.id) then
    bad := bad || 0::bigint;
  end if;
  return jsonb_build_object('ok', cardinality(bad) = 0, 'checked', n, 'broken', to_jsonb(bad));
end $$;

-- 6. Ending the election runs the reconciliation and tells every admin ------------------------------------------------------
create or replace function public.notify_admins(p_title text, p_body text, p_link text)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, title, body, link) select distinct user_id, p_title, p_body, p_link from public.user_roles where role = 'admin';
$$;
revoke all on function public.notify_admins(text, text, text) from public, anon, authenticated;

create or replace function public.set_counting(p_status text, p_acknowledge text default null)
returns void language plpgsql security definer set search_path = public as $$
declare e public.elections%rowtype; r text; rec jsonb; chain jsonb; summary text;
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
    rec := public.reconciliation();
    chain := public.verify_ballot_chain();
    if not (chain ->> 'ok')::boolean then
      rec := jsonb_set(rec, '{errors}', to_jsonb((rec ->> 'errors')::int + 1));
      rec := jsonb_set(rec, '{checks}', (rec -> 'checks') || jsonb_build_object('id', 'chain', 'level', 'error', 'title', 'Ballot history was changed', 'detail', 'The ballot chain is broken at ballot(s) ' || (chain ->> 'broken') || '. Ballots were removed or altered after being entered.'));
    end if;
    summary := (rec ->> 'errors') || ' problem(s), ' || (rec ->> 'warnings') || ' warning(s)';
    if (rec ->> 'errors')::int > 0 and (p_acknowledge is null or length(trim(p_acknowledge)) < 5) then
      perform public.notify_admins('Election integrity alert', 'The count could not be closed: ' || summary || '. Review the reconciliation, then recount, repeat the election, or end it with a written reason.', '/admin/election-results');
      raise exception 'RECONCILIATION_FAILED: % found. Review them, recount, or end the election with a written reason.', summary;
    end if;
    update public.elections set counting_status = 'ended', counting_ended_at = now() where id = e.id;
    if (rec ->> 'errors')::int > 0 or (rec ->> 'warnings')::int > 0 then
      perform public.notify_admins('Election ended with ' || summary, coalesce('Reason given: ' || nullif(trim(p_acknowledge), ''), 'Review the reconciliation report.'), '/admin/election-results');
    end if;
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata) values (auth.uid(), 'election.ended', 'elections', e.id, jsonb_build_object('reconciliation', rec, 'acknowledged', nullif(trim(coalesce(p_acknowledge, '')), '')));
    return;
  else
    raise exception 'Unknown status.';
  end if;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata) values (auth.uid(), 'election.' || p_status, 'elections', e.id, '{}'::jsonb);
end $$;

-- Start a recount of one race: a new round that begins from zero. The earlier round stays in the history.
create or replace function public.start_recount(p_race text, p_reason text)
returns int language plpgsql security definer set search_path = public as $$
declare e public.elections%rowtype; cur int;
begin
  if not public.is_admin(auth.uid()) then raise exception 'Only an admin can start a recount.'; end if;
  if p_reason is null or length(trim(p_reason)) < 5 then raise exception 'Write the reason for the recount.'; end if;
  select * into e from public.elections order by created_at desc limit 1;
  if not found or e.counting_status <> 'counting' then raise exception 'Reopen the election to recount.'; end if;
  if not exists (select 1 from public.race_candidates(e.id, p_race)) then raise exception 'Unknown race.'; end if;
  cur := public.current_round(e.id, p_race) + 1;
  insert into public.race_rounds (election_id, race, round, started_by, reason) values (e.id, p_race, cur, auth.uid(), trim(p_reason))
    on conflict (election_id, race) do update set round = cur, started_by = auth.uid(), started_at = now(), reason = trim(p_reason);
  delete from public.race_confirmations where election_id = e.id and race = p_race;
  insert into public.audit_logs (actor_id, action, entity_type, metadata) values (auth.uid(), 'results.recount_started', 'election_results', jsonb_build_object('race', p_race, 'election_id', e.id, 'round', cur, 'reason', trim(p_reason)));
  perform public.notify_admins('Recount started: ' || p_race, 'Round ' || cur || '. Reason: ' || trim(p_reason), '/admin/election-results');
  return cur;
end $$;

-- 7. The full ballot history ------------------------------------------------------------------------------------------------
create or replace function public.ballot_history(p_race text default null, p_limit int default 300, p_offset int default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare e public.elections%rowtype; rows jsonb; total int; counters jsonb;
begin
  if not public.is_staff(auth.uid()) then return jsonb_build_object('total', 0, 'rows', '[]'::jsonb, 'counters', '[]'::jsonb); end if;
  select * into e from public.elections order by created_at desc limit 1;
  if not found then return jsonb_build_object('total', 0, 'rows', '[]'::jsonb, 'counters', '[]'::jsonb); end if;

  select count(*) into total from public.ballots where election_id = e.id and (p_race is null or race = p_race);

  with cands as (
    select r.race, c.id, c.num from (values ('exec-middle'), ('exec-high'), ('senate-middle'), ('senate-high')) r(race), lateral public.race_candidates(e.id, r.race) c
  ), page as (
    select * from public.ballots where election_id = e.id and (p_race is null or race = p_race) order by seq desc limit least(greatest(p_limit, 1), 5000) offset greatest(p_offset, 0)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'seq', b.seq, 'at', b.created_at, 'race', b.race, 'round', b.round, 'kind', b.kind,
      'marks', coalesce((select jsonb_agg(cd.num order by cd.num) from cands cd where cd.race = b.race and cd.id = any(b.choices)), '[]'::jsonb),
      'by', coalesce(p.full_name, p.email, 'Unknown'), 'byId', b.entered_by,
      'voided', b.voided_at is not null, 'voidedAt', b.voided_at, 'voidedBy', coalesce(vp.full_name, vp.email),
      'hash', left(b.hash, 10)) order by b.seq desc), '[]'::jsonb)
    into rows
    from page b left join public.profiles p on p.id = b.entered_by left join public.profiles vp on vp.id = b.voided_by;

  select coalesce(jsonb_agg(jsonb_build_object('name', coalesce(p.full_name, p.email, 'Unknown'), 'id', t.entered_by, 'active', t.active, 'voided', t.voided, 'first', t.first_at, 'last', t.last_at) order by t.active desc), '[]'::jsonb)
    into counters
    from (select entered_by, count(*) filter (where voided_at is null) active, count(*) filter (where voided_at is not null) voided, min(created_at) first_at, max(created_at) last_at
          from public.ballots where election_id = e.id and (p_race is null or race = p_race) group by entered_by) t
    left join public.profiles p on p.id = t.entered_by;

  return jsonb_build_object('total', total, 'rows', rows, 'counters', counters);
end $$;

-- Signed-in users only; each function checks the role itself.
revoke all on function public.set_integrity(text, int, int, int, int, text) from public, anon;
revoke all on function public.reconciliation() from public, anon;
revoke all on function public.verify_ballot_chain() from public, anon;
revoke all on function public.set_counting(text, text) from public, anon;
revoke all on function public.start_recount(text, text) from public, anon;
revoke all on function public.ballot_history(text, int, int) from public, anon;
revoke all on function public.effective_registered(uuid, text) from public, anon;
revoke all on function public.effective_issued(uuid, text) from public, anon;
grant execute on function public.set_integrity(text, int, int, int, int, text) to authenticated;
grant execute on function public.reconciliation() to authenticated;
grant execute on function public.verify_ballot_chain() to authenticated;
grant execute on function public.set_counting(text, text) to authenticated;
grant execute on function public.start_recount(text, text) to authenticated;
grant execute on function public.ballot_history(text, int, int) to authenticated;
drop function if exists public.set_counting(text);

-- Ending the election returns the reconciliation instead of raising, so the alert sent to the admins is kept
-- (an exception would roll the notification back along with everything else).
drop function if exists public.set_counting(text, text);
create or replace function public.set_counting(p_status text, p_acknowledge text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e public.elections%rowtype; r text; rec jsonb; chain jsonb; summary text;
begin
  if not public.is_admin(auth.uid()) then raise exception 'Only an admin can start or end counting.'; end if;
  select * into e from public.elections order by created_at desc limit 1;
  if not found then raise exception 'No election is configured.'; end if;
  if p_status = 'counting' then
    if e.counting_status = 'counting' then return jsonb_build_object('ok', true); end if;
    update public.elections set counting_status = 'counting', counting_started_at = coalesce(counting_started_at, now()), counting_ended_at = null where id = e.id;
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata) values (auth.uid(), 'election.counting', 'elections', e.id, '{}'::jsonb);
    return jsonb_build_object('ok', true);
  elsif p_status = 'ended' then
    if e.counting_status <> 'counting' then raise exception 'Counting has not started.'; end if;
    foreach r in array array['exec-middle','exec-high','senate-middle','senate-high'] loop
      if exists (select 1 from public.race_candidates(e.id, r))
         and not exists (select 1 from public.race_confirmations where election_id = e.id and race = r) then
        raise exception 'Confirm every race before ending the election (%).', r;
      end if;
    end loop;
    rec := public.reconciliation();
    chain := public.verify_ballot_chain();
    if not (chain ->> 'ok')::boolean then
      rec := jsonb_set(rec, '{errors}', to_jsonb((rec ->> 'errors')::int + 1));
      rec := jsonb_set(rec, '{checks}', (rec -> 'checks') || jsonb_build_object('id', 'chain', 'level', 'error', 'title', 'Ballot history was changed', 'detail', 'The ballot chain is broken at ballot(s) ' || (chain ->> 'broken') || '. Ballots were removed or altered after being entered.'));
    end if;
    summary := (rec ->> 'errors') || ' problem(s), ' || (rec ->> 'warnings') || ' warning(s)';
    if (rec ->> 'errors')::int > 0 and (p_acknowledge is null or length(trim(p_acknowledge)) < 5) then
      perform public.notify_admins('Election integrity alert', 'The count could not be closed: ' || summary || '. Review the reconciliation, then recount, repeat the election, or end it with a written reason.', '/admin/election-results');
      insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata) values (auth.uid(), 'election.end_blocked', 'elections', e.id, jsonb_build_object('reconciliation', rec));
      return jsonb_build_object('ok', false, 'blocked', true, 'reconciliation', rec);
    end if;
    update public.elections set counting_status = 'ended', counting_ended_at = now() where id = e.id;
    if (rec ->> 'errors')::int > 0 or (rec ->> 'warnings')::int > 0 then
      perform public.notify_admins('Election ended with ' || summary, coalesce('Reason given: ' || nullif(trim(p_acknowledge), ''), 'Review the reconciliation report.'), '/admin/election-results');
    end if;
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata) values (auth.uid(), 'election.ended', 'elections', e.id, jsonb_build_object('reconciliation', rec, 'acknowledged', nullif(trim(coalesce(p_acknowledge, '')), '')));
    return jsonb_build_object('ok', true, 'reconciliation', rec);
  end if;
  raise exception 'Unknown status.';
end $$;
revoke all on function public.set_counting(text, text) from public, anon;
grant execute on function public.set_counting(text, text) to authenticated;

-- What the integrity settings page shows: the admin's numbers next to the ones the system knows by itself.
create or replace function public.integrity_settings()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare e public.elections%rowtype; sch text; out jsonb := '[]'::jsonb; i public.election_integrity%rowtype; found_row boolean;
begin
  if not public.is_staff(auth.uid()) then return '[]'::jsonb; end if;
  select * into e from public.elections order by created_at desc limit 1;
  if not found then return out; end if;
  foreach sch in array array['middle', 'high'] loop
    select * into i from public.election_integrity where election_id = e.id and school = sch;
    found_row := found;
    out := out || jsonb_build_object(
      'school', sch,
      'printedGovernment', case when found_row then i.printed_government end,
      'printedSenate', case when found_row then i.printed_senate end,
      'issuedOverride', case when found_row then i.issued_override end,
      'registeredOverride', case when found_row then i.registered_override end,
      'note', case when found_row then i.note end,
      'updatedAt', case when found_row then i.updated_at end,
      'issuedAuto', (select count(*)::int from public.ballot_checkins c join public.profiles p on p.id = c.student_id where c.election_id = e.id and public.school_of_grade(p.grade_level) = sch),
      'registeredAuto', (select count(*)::int from public.profiles where public.school_of_grade(grade_level) = sch),
      'locked', e.counting_status = 'ended');
  end loop;
  return out;
end $$;
revoke all on function public.integrity_settings() from public, anon;
grant execute on function public.integrity_settings() to authenticated;
