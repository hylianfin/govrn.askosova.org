-- Candidates entered directly by an admin (no application/approval flow needed).
-- When a race has any manual candidates, they replace the application-based list for that race.

create table if not exists public.manual_candidates (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.elections(id) on delete cascade,
  race text not null,
  label text not null check (length(trim(label)) > 0),
  sub text,
  members jsonb not null default '[]'::jsonb,
  ord int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists manual_candidates_race_idx on public.manual_candidates (election_id, race, ord);
alter table public.manual_candidates enable row level security;
drop policy if exists "manual_candidates public read" on public.manual_candidates;
create policy "manual_candidates public read" on public.manual_candidates for select using (true);

create or replace function public.race_candidates(p_election uuid, p_race text)
returns table (id uuid, num int, label text, sub text, members jsonb)
language sql stable security definer set search_path = public as $$
  with m as (
    select mc.id, mc.label::text label, mc.sub::text sub, mc.members, mc.created_at + (mc.ord * interval '1 millisecond') ord
    from public.manual_candidates mc where mc.election_id = p_election and mc.race = p_race
  ), c as (
    select t.id, t.name::text as label, t.slogan::text as sub,
           (select coalesce(jsonb_agg(jsonb_build_object('role', mm.position, 'name', coalesce(p.full_name, p.email))
                    order by case mm.position when 'president' then 1 when 'vice_president' then 2 when 'secretary' then 3 else 4 end), '[]'::jsonb)
              from public.executive_team_members mm join public.profiles p on p.id = mm.user_id where mm.team_id = t.id) as members,
           t.created_at as ord
    from public.executive_teams t
    join public.applications a on a.id = t.application_id and a.status = 'approved'
    where p_race like 'exec-%' and t.election_id = p_election
      and not exists (select 1 from m)
      and coalesce((
        select public.school_of_grade(max(g::int))
        from jsonb_array_elements_text(case when jsonb_typeof(t.grade_levels) = 'array' then t.grade_levels else '[]'::jsonb end) g
        where g ~ '^[0-9]+$'
      ), (select key from public.config_schools() order by ord desc limit 1)) = substr(p_race, 6)
    union all
    select p.id, coalesce(p.full_name, p.email)::text, ('Grade ' || p.grade_level)::text, '[]'::jsonb, a.created_at
    from public.applications a
    join public.profiles p on p.id = a.applicant_id
    where p_race like 'senate-%' and a.kind = 'senate' and a.status = 'approved'
      and not exists (select 1 from m)
      and public.school_of_grade(p.grade_level) = substr(p_race, 8)
    union all
    select m.id, m.label, m.sub, m.members, m.ord from m
  )
  select c.id, (row_number() over (order by c.ord, c.id))::int, c.label, c.sub, c.members from c order by 2;
$$;
revoke all on function public.race_candidates(uuid, text) from public, anon;

-- Replace the whole list for one race. p_entries: [{"label": "...", "sub": "...", "members": [{"role":"president","name":"..."}]}]
create or replace function public.save_candidates(p_race text, p_entries jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare e public.elections%rowtype; x jsonb; i int := 0;
begin
  if not public.is_admin(auth.uid()) then raise exception 'Only an admin can edit the candidates.'; end if;
  if not exists (select 1 from public.config_races() where race = p_race) then raise exception 'Unknown race.'; end if;
  select * into e from public.elections order by created_at desc limit 1;
  if not found then raise exception 'No election is configured.'; end if;
  if exists (select 1 from public.ballots where election_id = e.id and race = p_race) then
    raise exception 'Ballots were already counted in this race, so the candidate list is locked.';
  end if;
  if exists (select 1 from public.race_confirmations where election_id = e.id and race = p_race) then
    raise exception 'This race is confirmed, so the candidate list is locked.';
  end if;
  if jsonb_typeof(p_entries) <> 'array' or jsonb_array_length(p_entries) > 60 then raise exception 'Enter between 0 and 60 candidates.'; end if;
  delete from public.manual_candidates where election_id = e.id and race = p_race;
  for x in select * from jsonb_array_elements(p_entries) loop
    continue when coalesce(trim(x ->> 'label'), '') = '';
    i := i + 1;
    insert into public.manual_candidates (election_id, race, label, sub, members, ord)
      values (e.id, p_race, trim(x ->> 'label'), nullif(trim(coalesce(x ->> 'sub', '')), ''),
              case when jsonb_typeof(x -> 'members') = 'array' then x -> 'members' else '[]'::jsonb end, i);
  end loop;
  insert into public.audit_logs (actor_id, action, entity_type, metadata)
    values (auth.uid(), 'candidates.saved', 'manual_candidates', jsonb_build_object('race', p_race, 'count', i));
  return i;
end $$;
revoke all on function public.save_candidates(text, jsonb) from public, anon;
grant execute on function public.save_candidates(text, jsonb) to authenticated;

-- Admin editor: current list per race (includes application-based ones so the admin can see what is already there).
create or replace function public.candidate_lists()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare e public.elections%rowtype; r text; out jsonb := '[]'::jsonb;
begin
  if not public.is_admin(auth.uid()) then return out; end if;
  select * into e from public.elections order by created_at desc limit 1;
  if not found then return out; end if;
  for r in select race from public.config_races() loop
    out := out || jsonb_build_object(
      'race', r, 'school', split_part(r, '-', 2), 'kind', split_part(r, '-', 1),
      'manual', exists (select 1 from public.manual_candidates where election_id = e.id and race = r),
      'locked', exists (select 1 from public.ballots where election_id = e.id and race = r) or exists (select 1 from public.race_confirmations where election_id = e.id and race = r),
      'candidates', (select coalesce(jsonb_agg(jsonb_build_object('num', c.num, 'label', c.label, 'sub', c.sub, 'members', c.members) order by c.num), '[]'::jsonb) from public.race_candidates(e.id, r) c));
  end loop;
  return out;
end $$;
revoke all on function public.candidate_lists() from public, anon;
grant execute on function public.candidate_lists() to authenticated;

-- Public "who is running": names only, no counts.
create or replace function public.public_candidates()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare e public.elections%rowtype; r text; out jsonb := '[]'::jsonb; cands jsonb;
begin
  select * into e from public.elections order by created_at desc limit 1;
  if not found then return out; end if;
  for r in select race from public.config_races() loop
    select coalesce(jsonb_agg(jsonb_build_object('num', c.num, 'label', c.label, 'sub', c.sub, 'members', c.members) order by c.num), '[]'::jsonb)
      into cands from public.race_candidates(e.id, r) c;
    continue when jsonb_array_length(cands) = 0;
    out := out || jsonb_build_object('race', r, 'school', split_part(r, '-', 2), 'schoolLabel', public.school_label(split_part(r, '-', 2)), 'kind', split_part(r, '-', 1), 'candidates', cands);
  end loop;
  return out;
end $$;
revoke all on function public.public_candidates() from public;
grant execute on function public.public_candidates() to anon, authenticated;

-- school_label is only granted to authenticated; the public function above runs as definer so that is fine.
