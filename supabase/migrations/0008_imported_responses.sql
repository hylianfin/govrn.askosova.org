-- Responses collected earlier (e.g. via Google Forms) are imported against an email address and wait.
-- When a person signs up and CONFIRMS that email, their application, answers and (for executive teams) team
-- are created from the import. Confirmation is required so nobody can claim an email they don't own.

create table if not exists public.imported_responses (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null,
  kind text not null check (kind in ('executive_team','senate')),
  form_id uuid not null references public.application_forms(id) on delete cascade,
  version_id uuid not null references public.application_form_versions(id) on delete cascade,
  email text not null,
  full_name text,
  submitted_at timestamptz,
  team_name text,
  members jsonb not null default '{}'::jsonb,   -- {"president": {"email": "...", "name": "..."}, ...}
  answers jsonb not null default '{}'::jsonb,   -- {"<question id>": {"text": "...", "values": [...]}}
  raw jsonb,                                    -- the original spreadsheet row
  status text not null default 'pending' check (status in ('pending','linked','skipped')),
  note text,
  linked_user_id uuid references auth.users(id) on delete set null,
  linked_application_id uuid references public.applications(id) on delete set null,
  linked_at timestamptz,
  imported_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create unique index if not exists imported_responses_dedupe
  on public.imported_responses (kind, lower(email), coalesce(submitted_at, 'epoch'::timestamptz));
create index if not exists imported_responses_pending_email
  on public.imported_responses (lower(email)) where status = 'pending';

alter table public.imported_responses enable row level security;
drop policy if exists "imported_responses staff" on public.imported_responses;
create policy "imported_responses staff" on public.imported_responses for all
  using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

create or replace function public.link_imported_responses(p_user uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  u record; r record; v_app uuid; v_team uuid; v_pos text; v_election uuid; k text; n int := 0;
  positions text[] := array['president','vice_president','secretary','treasurer'];
begin
  select id, lower(email) as email, email_confirmed_at into u from auth.users where id = p_user;
  if u.id is null or u.email_confirmed_at is null then return 0; end if;

  for r in
    select * from public.imported_responses
    where status = 'pending' and lower(email) = u.email
    order by submitted_at nulls last, created_at
  loop
    if exists (select 1 from public.applications a where a.applicant_id = u.id and a.kind = r.kind) then
      update public.imported_responses set status = 'skipped', linked_user_id = u.id, linked_at = now(),
        note = 'This person already had an application of this kind, so nothing was overwritten.' where id = r.id;
      continue;
    end if;
    if r.kind = 'executive_team' and exists (select 1 from public.executive_team_members m where m.user_id = u.id) then
      update public.imported_responses set status = 'skipped', linked_user_id = u.id, linked_at = now(),
        note = 'This person is already on an executive team, so nothing was created.' where id = r.id;
      continue;
    end if;

    select election_id into v_election from public.application_forms where id = r.form_id;
    v_team := null;
    if r.kind = 'executive_team' then
      insert into public.executive_teams (election_id, name, created_by)
      values (v_election, coalesce(nullif(trim(r.team_name), ''), 'Team ' || coalesce(nullif(trim(r.full_name), ''), split_part(u.email, '@', 1))), u.id)
      returning id into v_team;
    end if;

    insert into public.applications (form_id, form_version_id, applicant_id, executive_team_id, kind, status, submitted_at, submitted_by)
    values (r.form_id, r.version_id, u.id, v_team, r.kind, 'submitted', coalesce(r.submitted_at, now()), u.id)
    returning id into v_app;

    if v_team is not null then
      update public.executive_teams set application_id = v_app where id = v_team;

      v_pos := null;
      select e.key into v_pos from jsonb_each(r.members) e where lower(e.value ->> 'email') = u.email limit 1;
      if v_pos is null or not (v_pos = any(positions)) then
        select p into v_pos from unnest(positions) p where not (r.members ? p) limit 1;
        v_pos := coalesce(v_pos, 'president');
      end if;
      insert into public.executive_team_members (team_id, user_id, position, accepted, accepted_at)
      values (v_team, u.id, v_pos, true, now());

      for k in select e.key from jsonb_each(r.members) e loop
        if k = any(positions) and k <> v_pos
           and coalesce(r.members -> k ->> 'email', '') <> '' and lower(r.members -> k ->> 'email') <> u.email then
          insert into public.team_invitations (team_id, email, position, token, invited_by, expires_at)
          values (v_team, lower(r.members -> k ->> 'email'), k, gen_random_uuid()::text, u.id, now() + interval '60 days');
        end if;
      end loop;
    end if;

    insert into public.application_answers (application_id, question_id, respondent_id, value)
    select v_app, q.id, case when q.scope = 'team' then null else u.id end, r.answers -> q.id::text
    from public.application_questions q
    where q.version_id = r.version_id and r.answers ? q.id::text;

    update public.imported_responses set status = 'linked', linked_user_id = u.id, linked_application_id = v_app, linked_at = now() where id = r.id;
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke all on function public.link_imported_responses(uuid) from public, anon, authenticated;

-- A signed-in person claims whatever was imported under their own confirmed email.
create or replace function public.claim_my_imported_responses()
returns int language sql security definer set search_path = public as $$
  select public.link_imported_responses(auth.uid());
$$;
revoke all on function public.claim_my_imported_responses() from public, anon;
grant execute on function public.claim_my_imported_responses() to authenticated;

-- Staff: link everything that already has a matching, confirmed account (used right after an import).
create or replace function public.link_all_imported_responses()
returns int language plpgsql security definer set search_path = public as $$
declare t int := 0; x record;
begin
  if not public.is_staff(auth.uid()) then raise exception 'Staff only.'; end if;
  for x in
    select u.id from auth.users u
    where u.email_confirmed_at is not null
      and lower(u.email) in (select lower(email) from public.imported_responses where status = 'pending')
  loop
    t := t + public.link_imported_responses(x.id);
  end loop;
  return t;
end;
$$;
revoke all on function public.link_all_imported_responses() from public, anon;
grant execute on function public.link_all_imported_responses() to authenticated;
