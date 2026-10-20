-- Make the system reusable without touching code: everything that was specific to one school lives in a settings row.
--   * organization and site names, logo, allowed sign-up email domains
--   * the schools (any number, each with a name and a grade range), Senate seats and votes per ballot, ballot titles
-- Races are "exec-<school>" and "senate-<school>" for every school in the settings, so adding or removing a school needs no code.

create table if not exists public.election_config (
  id boolean primary key default true check (id),
  organization_name text not null default 'American School of Kosovo',
  site_name text not null default 'ASK Votes',
  tagline text not null default 'Student Government',
  logo_url text not null default '/images/logo-mark.png',
  email_domains text[] not null default array['askosova.org'],
  schools jsonb not null default '[{"key":"middle","label":"Middle School","min_grade":0,"max_grade":8},{"key":"high","label":"High School","min_grade":9,"max_grade":99}]'::jsonb,
  senate_seats int not null default 5 check (senate_seats between 1 and 50),
  senate_max_choices int not null default 3 check (senate_max_choices between 1 and 10),
  government_label text not null default 'Government',
  senate_label text not null default 'Senator',
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
insert into public.election_config (id) values (true) on conflict (id) do nothing;
alter table public.election_config enable row level security;
drop policy if exists "election_config public read" on public.election_config;
create policy "election_config public read" on public.election_config for select using (true);

create or replace function public.election_config_json()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'organizationName', c.organization_name, 'siteName', c.site_name, 'tagline', c.tagline, 'logoUrl', c.logo_url,
    'emailDomains', to_jsonb(c.email_domains),
    'schools', (select coalesce(jsonb_agg(jsonb_build_object('key', s ->> 'key', 'label', s ->> 'label', 'minGrade', (s ->> 'min_grade')::int, 'maxGrade', (s ->> 'max_grade')::int) order by o), '[]'::jsonb) from jsonb_array_elements(c.schools) with ordinality t(s, o)),
    'senateSeats', c.senate_seats, 'senateMaxChoices', c.senate_max_choices,
    'governmentLabel', c.government_label, 'senateLabel', c.senate_label)
  from public.election_config c where c.id;
$$;
revoke all on function public.election_config_json() from public;
grant execute on function public.election_config_json() to anon, authenticated;

create or replace function public.config_schools()
returns table (key text, label text, min_grade int, max_grade int, ord int)
language sql stable security definer set search_path = public as $$
  select s ->> 'key', s ->> 'label', (s ->> 'min_grade')::int, (s ->> 'max_grade')::int, o::int
  from public.election_config c, jsonb_array_elements(c.schools) with ordinality t(s, o) where c.id;
$$;
revoke all on function public.config_schools() from public, anon;
grant execute on function public.config_schools() to authenticated;

-- "exec-<school>" then "senate-<school>" for each school, in the order the schools are listed.
create or replace function public.config_races()
returns table (race text)
language sql stable security definer set search_path = public as $$
  select k.r from (
    select 'exec-' || key r, ord * 2 o from public.config_schools()
    union all
    select 'senate-' || key, ord * 2 + 1 from public.config_schools()
  ) k order by k.o;
$$;
revoke all on function public.config_races() from public, anon;
grant execute on function public.config_races() to authenticated;

create or replace function public.school_label(p_key text)
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select label from public.config_schools() where key = p_key), p_key);
$$;
revoke all on function public.school_label(text) from public, anon;
grant execute on function public.school_label(text) to authenticated;

create or replace function public.school_of_grade(g int)
returns text language sql stable security definer set search_path = public as $$
  select key from public.config_schools() where g is not null and g between min_grade and max_grade order by ord limit 1;
$$;

-- The race and school columns no longer list the two original schools, and a Senate ballot may carry as many marks as the settings allow.
do $$
declare c record;
begin
  for c in
    select conrelid::regclass::text rel, conname from pg_constraint
    where contype = 'c' and conrelid in ('public.ballots'::regclass, 'public.race_confirmations'::regclass, 'public.race_rounds'::regclass, 'public.election_integrity'::regclass)
      and (pg_get_constraintdef(oid) like '%exec-middle%' or pg_get_constraintdef(oid) like '%''middle''%' or pg_get_constraintdef(oid) like '%cardinality(choices)%')
  loop
    execute format('alter table %s drop constraint %I', c.rel, c.conname);
  end loop;
end $$;
alter table public.ballots drop constraint if exists ballots_shape;
alter table public.ballots add constraint ballots_shape check ((kind = 'valid' and cardinality(choices) >= 1) or (kind <> 'valid' and cardinality(choices) = 0));

-- Who may create an account comes from the settings (an empty list allows any address).
create or replace function public.enforce_signup_domain()
returns trigger language plpgsql set search_path = public as $$
declare d text := lower(split_part(coalesce(new.email, ''), '@', 2)); doms text[];
begin
  select email_domains into doms from public.election_config where id;
  if doms is null or cardinality(doms) = 0 then return new; end if;
  if not exists (select 1 from unnest(doms) x where d = lower(x) or d like '%.' || lower(x)) then
    raise exception 'Only % email addresses can sign up.', array_to_string(doms, ', ') using errcode = 'check_violation';
  end if;
  return new;
end $$;

-- Save the settings. Once ballots exist, the schools and the votes per ballot are locked (names can still be corrected).
create or replace function public.save_config(p jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  cur public.election_config%rowtype; s jsonb; keys text[] := '{}'; k text; lo int; hi int; used jsonb := '[]'::jsonb; seats int; maxc int; locked boolean;
  doms text[]; old_keys text[]; schools_new jsonb := '[]'::jsonb;
begin
  if not public.is_admin(auth.uid()) then raise exception 'Only an admin can change the settings.'; end if;
  select * into cur from public.election_config where id;
  locked := exists (select 1 from public.ballots);

  if coalesce(trim(p ->> 'organizationName'), '') = '' or coalesce(trim(p ->> 'siteName'), '') = '' then raise exception 'The organization and site names cannot be empty.'; end if;
  seats := (p ->> 'senateSeats')::int; maxc := (p ->> 'senateMaxChoices')::int;
  if seats is null or seats < 1 or seats > 50 then raise exception 'Senate seats must be between 1 and 50.'; end if;
  if maxc is null or maxc < 1 or maxc > 10 then raise exception 'Votes per Senate ballot must be between 1 and 10.'; end if;
  if jsonb_typeof(p -> 'schools') <> 'array' or jsonb_array_length(p -> 'schools') < 1 or jsonb_array_length(p -> 'schools') > 8 then raise exception 'Add between 1 and 8 schools.'; end if;

  for s in select * from jsonb_array_elements(p -> 'schools') loop
    k := lower(trim(s ->> 'key')); lo := (s ->> 'minGrade')::int; hi := (s ->> 'maxGrade')::int;
    if k !~ '^[a-z0-9_]{1,20}$' then raise exception 'A school key may only use letters, digits and underscores.'; end if;
    if k = any(keys) then raise exception 'Each school needs a different key.'; end if;
    if coalesce(trim(s ->> 'label'), '') = '' then raise exception 'Every school needs a name.'; end if;
    if lo is null or hi is null or lo > hi then raise exception 'Check the grade range of %.', k; end if;
    if exists (select 1 from jsonb_array_elements(used) u where lo <= (u ->> 1)::int and hi >= (u ->> 0)::int) then raise exception 'Grade ranges of schools cannot overlap.'; end if;
    used := used || jsonb_build_array(jsonb_build_array(lo, hi));
    keys := keys || k;
    schools_new := schools_new || jsonb_build_object('key', k, 'label', trim(s ->> 'label'), 'min_grade', lo, 'max_grade', hi);
  end loop;

  if locked then
    select array_agg(key) into old_keys from public.config_schools();
    if (select array_agg(x order by x) from unnest(keys) x) is distinct from (select array_agg(x order by x) from unnest(old_keys) x) then raise exception 'Ballots have been entered, so schools cannot be added or removed.'; end if;
    if exists (select 1 from jsonb_array_elements(schools_new) n join public.config_schools() o on o.key = n ->> 'key' where o.min_grade <> (n ->> 'min_grade')::int or o.max_grade <> (n ->> 'max_grade')::int) then raise exception 'Ballots have been entered, so grade ranges cannot change.'; end if;
    if maxc <> cur.senate_max_choices then raise exception 'Ballots have been entered, so votes per Senate ballot cannot change.'; end if;
  end if;

  select coalesce(array_agg(lower(trim(x))), '{}') into doms from jsonb_array_elements_text(coalesce(p -> 'emailDomains', '[]'::jsonb)) x where trim(x) <> '';

  update public.election_config set
    organization_name = trim(p ->> 'organizationName'), site_name = trim(p ->> 'siteName'), tagline = coalesce(trim(p ->> 'tagline'), ''),
    logo_url = coalesce(nullif(trim(p ->> 'logoUrl'), ''), logo_url), email_domains = doms, schools = schools_new,
    senate_seats = seats, senate_max_choices = maxc,
    government_label = coalesce(nullif(trim(p ->> 'governmentLabel'), ''), government_label), senate_label = coalesce(nullif(trim(p ->> 'senateLabel'), ''), senate_label),
    updated_by = auth.uid(), updated_at = now()
  where id;
  insert into public.audit_logs (actor_id, action, entity_type, metadata) values (auth.uid(), 'config.updated', 'election_config', jsonb_build_object('before', to_jsonb(cur), 'after', p));
end $$;
revoke all on function public.save_config(jsonb) from public, anon;
grant execute on function public.save_config(jsonb) to authenticated;

-- Undo "Start counting" pressed by mistake. Only possible while nothing has been counted, so no ballot can ever be lost.
create or replace function public.cancel_counting()
returns void language plpgsql security definer set search_path = public as $$
declare e public.elections%rowtype;
begin
  if not public.is_admin(auth.uid()) then raise exception 'Only an admin can cancel the start of counting.'; end if;
  select * into e from public.elections order by created_at desc limit 1;
  if not found or e.counting_status <> 'counting' then raise exception 'Counting is not open.'; end if;
  if exists (select 1 from public.ballots where election_id = e.id) or exists (select 1 from public.race_confirmations where election_id = e.id) then
    raise exception 'Ballots have already been entered, so counting cannot be cancelled.';
  end if;
  update public.elections set counting_status = 'not_started', counting_started_at = null where id = e.id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata) values (auth.uid(), 'election.counting_cancelled', 'elections', e.id, '{}'::jsonb);
end $$;
revoke all on function public.cancel_counting() from public, anon;
grant execute on function public.cancel_counting() to authenticated;

create or replace function public.set_integrity(p_school text, p_printed_government int, p_printed_senate int, p_issued int, p_registered int, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare e public.elections%rowtype; old jsonb;
begin
  if not public.is_admin(auth.uid()) then raise exception 'Only an admin can change the integrity numbers.'; end if;
  if not exists (select 1 from public.config_schools() where key = p_school) then raise exception 'Unknown school.'; end if;
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

create or replace function public.integrity_settings()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare e public.elections%rowtype; sch text; out jsonb := '[]'::jsonb; i public.election_integrity%rowtype; found_row boolean;
begin
  if not public.is_staff(auth.uid()) then return '[]'::jsonb; end if;
  select * into e from public.elections order by created_at desc limit 1;
  if not found then return out; end if;
  for sch in select key from public.config_schools() order by ord loop
    select * into i from public.election_integrity where election_id = e.id and school = sch;
    found_row := found;
    out := out || jsonb_build_object(
      'school', sch, 'label', public.school_label(sch),
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
    return jsonb_build_object('status', coalesce(e.counting_status, 'not_started'), 'races', '[]'::jsonb, 'config', public.election_config_json());
  end if;
  for r in select race from public.config_races() loop
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
      'maxChoices', case when r like 'senate-%' then (select senate_max_choices from public.election_config) else 1 end,
      'seats', case when r like 'senate-%' then (select senate_seats from public.election_config) else 1 end,
      'round', cur, 'rounds', rounds, 'voided', n_void,
      'valid', n_valid, 'invalid', n_invalid, 'blank', n_blank,
      'printed', printed, 'issued', issued, 'registered', registered,
      'confirmed', confirmed, 'countedByMe', mine_last, 'lastBallotAt', last_at,
      'lastChoices', to_jsonb(mine), 'candidates', cands);
  end loop;
  return jsonb_build_object('status', e.counting_status, 'startedAt', e.counting_started_at, 'endedAt', e.counting_ended_at, 'races', races, 'config', public.election_config_json());
end $$;

create or replace function public.record_ballot(p_race text, p_kind text, p_choices uuid[] default '{}')
returns int language plpgsql security definer set search_path = public as $$
declare e public.elections%rowtype; maxc int; n int; cur int;
begin
  if not public.is_staff(auth.uid()) then raise exception 'Only staff can count ballots.'; end if;
  select * into e from public.elections order by created_at desc limit 1;
  if not found or e.counting_status <> 'counting' then raise exception 'Counting is not open.'; end if;
  if exists (select 1 from public.race_confirmations where election_id = e.id and race = p_race) then raise exception 'This race is confirmed. An admin must reopen it.'; end if;
  if not exists (select 1 from public.race_candidates(e.id, p_race)) then raise exception 'Unknown race.'; end if;
  maxc := case when p_race like 'senate-%' then (select senate_max_choices from public.election_config) else 1 end;
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
    for r in select race from public.config_races() loop
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

create or replace function public.reconciliation()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  e public.elections%rowtype; sch text; r text; checks jsonb := '[]'::jsonb;
  reg int; iss int; pg int; ps int; cg int; cs int; vg int; vs int; cur int; margin int; top1 int; top2 int; dev int; recount_diff int;
  lbl text; errs int := 0; warns int := 0; done boolean; gl text; sl text;
begin
  if not public.is_staff(auth.uid()) then return jsonb_build_object('checks', '[]'::jsonb, 'errors', 0, 'warnings', 0); end if;
  select * into e from public.elections order by created_at desc limit 1;
  if not found then return jsonb_build_object('checks', '[]'::jsonb, 'errors', 0, 'warnings', 0); end if;
  select government_label, senate_label into gl, sl from public.election_config;

  for sch in select key from public.config_schools() order by ord loop
    continue when not exists (select 1 from public.race_candidates(e.id, 'exec-' || sch)) and not exists (select 1 from public.race_candidates(e.id, 'senate-' || sch));
    lbl := public.school_label(sch);
    reg := public.effective_registered(e.id, sch);
    iss := public.effective_issued(e.id, sch);
    select printed_government, printed_senate into pg, ps from public.election_integrity where election_id = e.id and school = sch;
    cg := (select count(*) from public.ballots b where b.election_id = e.id and b.race = 'exec-' || sch and b.round = public.current_round(e.id, 'exec-' || sch) and b.voided_at is null);
    cs := (select count(*) from public.ballots b where b.election_id = e.id and b.race = 'senate-' || sch and b.round = public.current_round(e.id, 'senate-' || sch) and b.voided_at is null);
    dev := 0;
    done := exists (select 1 from public.race_confirmations x where x.election_id = e.id and x.race = 'exec-' || sch)
            and (not exists (select 1 from public.race_candidates(e.id, 'senate-' || sch)) or exists (select 1 from public.race_confirmations x where x.election_id = e.id and x.race = 'senate-' || sch));

    if pg is null and ps is null then checks := checks || jsonb_build_object('id', 'printed-missing-' || sch, 'level', 'warn', 'school', sch, 'title', lbl || ': printed ballots not entered', 'detail', 'Enter how many ballots were printed so printing and issuing can be compared.'); end if;
    if iss is null then checks := checks || jsonb_build_object('id', 'issued-missing-' || sch, 'level', 'warn', 'school', sch, 'title', lbl || ': ballots issued unknown', 'detail', 'No polling-desk check-ins and no number entered by an admin.'); end if;

    if iss is not null and pg is not null and iss > pg then
      dev := greatest(dev, iss - pg);
      checks := checks || jsonb_build_object('id', 'issued-gt-printed-gov-' || sch, 'level', 'error', 'school', sch, 'title', lbl || ': more ' || gl || ' ballots issued than printed', 'detail', iss || ' issued, ' || pg || ' printed.');
    end if;
    if iss is not null and ps is not null and iss > ps then
      dev := greatest(dev, iss - ps);
      checks := checks || jsonb_build_object('id', 'issued-gt-printed-sen-' || sch, 'level', 'error', 'school', sch, 'title', lbl || ': more ' || sl || ' ballots issued than printed', 'detail', iss || ' issued, ' || ps || ' printed.');
    end if;
    if iss is not null and reg is not null and iss > reg then
      dev := greatest(dev, iss - reg);
      checks := checks || jsonb_build_object('id', 'issued-gt-registered-' || sch, 'level', 'error', 'school', sch, 'title', lbl || ': more ballots issued than registered voters', 'detail', iss || ' issued, ' || reg || ' registered.');
    end if;
    if iss is not null and cg > iss then
      dev := greatest(dev, cg - iss);
      checks := checks || jsonb_build_object('id', 'counted-gt-issued-gov-' || sch, 'level', 'error', 'school', sch, 'title', lbl || ': more ' || gl || ' ballots counted than issued', 'detail', cg || ' counted, ' || iss || ' issued. Ballots may have been added.');
    end if;
    if iss is not null and cs > iss then
      dev := greatest(dev, cs - iss);
      checks := checks || jsonb_build_object('id', 'counted-gt-issued-sen-' || sch, 'level', 'error', 'school', sch, 'title', lbl || ': more ' || sl || ' ballots counted than issued', 'detail', cs || ' counted, ' || iss || ' issued. Ballots may have been added.');
    end if;
    if reg is not null and greatest(cg, cs) > reg then
      dev := greatest(dev, greatest(cg, cs) - reg);
      checks := checks || jsonb_build_object('id', 'counted-gt-registered-' || sch, 'level', 'error', 'school', sch, 'title', lbl || ': more ballots counted than registered voters', 'detail', greatest(cg, cs) || ' counted, ' || reg || ' registered.');
    end if;
    if done and cg <> cs and (cg > 0 or cs > 0) then
      dev := greatest(dev, abs(cg - cs));
      checks := checks || jsonb_build_object('id', 'gov-sen-differ-' || sch, 'level', case when abs(cg - cs) > greatest(3, coalesce(iss, cg) * 0.02) then 'error' else 'warn' end, 'school', sch,
        'title', lbl || ': ' || gl || ' and ' || sl || ' counts differ', 'detail', 'Each voter gets both ballots, but ' || cg || ' ' || gl || ' and ' || cs || ' ' || sl || ' ballots were counted.');
    end if;
    if done and iss is not null and greatest(cg, cs) < iss and (cg > 0 or cs > 0) then
      checks := checks || jsonb_build_object('id', 'issued-not-counted-' || sch, 'level', 'warn', 'school', sch, 'title', lbl || ': issued ballots not counted', 'detail', (iss - greatest(cg, cs)) || ' ballots were issued but not found in the count (not cast, spoiled or lost). They should be accounted for.');
    end if;
    if pg is not null and iss is not null and pg >= iss then
      checks := checks || jsonb_build_object('id', 'unused-' || sch, 'level', 'ok', 'school', sch, 'title', lbl || ': unused ballots', 'detail', (pg - iss) || ' ' || gl || ' ballots were printed but not issued.');
    end if;
  end loop;

  for r in select race from public.config_races() loop
    continue when not exists (select 1 from public.race_candidates(e.id, r));
    sch := split_part(r, '-', 2);
    lbl := public.school_label(sch) || ' ' || (case when r like 'exec-%' then gl else sl end);
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
  for sch in select key from public.config_schools() order by ord loop
    continue when not exists (select 1 from public.race_candidates(e.id, 'exec-' || sch));
    reg := public.effective_registered(e.id, sch); iss := public.effective_issued(e.id, sch);
    cg := (select count(*) from public.ballots b where b.election_id = e.id and b.race = 'exec-' || sch and b.round = public.current_round(e.id, 'exec-' || sch) and b.voided_at is null);
    cs := (select count(*) from public.ballots b where b.election_id = e.id and b.race = 'senate-' || sch and b.round = public.current_round(e.id, 'senate-' || sch) and b.voided_at is null);
    cur := public.current_round(e.id, 'exec-' || sch);
    select max(v), (array_agg(v order by v desc))[2] into top1, top2 from (
      select (select count(*) from public.ballots x where x.election_id = e.id and x.race = 'exec-' || sch and x.round = cur and x.voided_at is null and x.kind = 'valid' and c.id = any(x.choices))::int v
      from public.race_candidates(e.id, 'exec-' || sch) c) q;
    margin := coalesce(top1, 0) - coalesce(top2, 0);
    done := exists (select 1 from public.race_confirmations x where x.election_id = e.id and x.race = 'exec-' || sch)
            and (not exists (select 1 from public.race_candidates(e.id, 'senate-' || sch)) or exists (select 1 from public.race_confirmations x where x.election_id = e.id and x.race = 'senate-' || sch));
    dev := greatest(case when iss is not null then greatest(cg - iss, 0) else 0 end,
                    case when done then abs(cg - cs) else 0 end,
                    case when done and iss is not null then greatest(iss - greatest(cg, cs), 0) else 0 end);
    if dev > 0 and coalesce(top1, 0) > 0 and dev >= margin then
      checks := checks || jsonb_build_object('id', 'margin-' || sch, 'level', 'error', 'school', sch, 'race', 'exec-' || sch,
        'title', public.school_label(sch) || ' ' || gl || ': the gap is as large as the winning margin',
        'detail', 'The winner leads by ' || margin || ' vote(s), but the numbers differ by up to ' || dev || ' ballot(s). The result cannot be trusted until it is recounted or the election is repeated.');
    end if;
  end loop;

  select count(*) filter (where c ->> 'level' = 'error'), count(*) filter (where c ->> 'level' = 'warn') into errs, warns from jsonb_array_elements(checks) c;
  return jsonb_build_object('checks', checks, 'errors', errs, 'warnings', warns);
end $$;

create or replace function public.ballot_history(p_race text default null, p_limit int default 300, p_offset int default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare e public.elections%rowtype; rows jsonb; total int; counters jsonb;
begin
  if not public.is_staff(auth.uid()) then return jsonb_build_object('total', 0, 'rows', '[]'::jsonb, 'counters', '[]'::jsonb); end if;
  select * into e from public.elections order by created_at desc limit 1;
  if not found then return jsonb_build_object('total', 0, 'rows', '[]'::jsonb, 'counters', '[]'::jsonb); end if;

  select count(*) into total from public.ballots where election_id = e.id and (p_race is null or race = p_race);

  with cands as (
    select r.race, c.id, c.num from public.config_races() r(race), lateral public.race_candidates(e.id, r.race) c
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

revoke all on function public.live_results() from public, anon;
revoke all on function public.record_ballot(text, text, uuid[]) from public, anon;
revoke all on function public.set_counting(text, text) from public, anon;
revoke all on function public.reconciliation() from public, anon;
revoke all on function public.ballot_history(text, int, int) from public, anon;
revoke all on function public.integrity_settings() from public, anon;
revoke all on function public.set_integrity(text, int, int, int, int, text) from public, anon;
grant execute on function public.live_results() to authenticated;
grant execute on function public.record_ballot(text, text, uuid[]) to authenticated;
grant execute on function public.set_counting(text, text) to authenticated;
grant execute on function public.reconciliation() to authenticated;
grant execute on function public.ballot_history(text, int, int) to authenticated;
grant execute on function public.integrity_settings() to authenticated;
grant execute on function public.set_integrity(text, int, int, int, int, text) to authenticated;
