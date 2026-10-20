-- Responses saved without an email link themselves when someone signs up and confirms a school address that
-- clearly spells their name (alsara.ramadani@..., oniksam@...). The name typed in the sign-up form is NOT used,
-- because anyone can type any name; the confirmed mailbox is what proves who they are. Unclear or ambiguous
-- cases are left for staff to attach by hand.

create or replace function public.name_tokens(p text)
returns text[] language sql immutable as $$
  select coalesce(array_agg(t order by ord), '{}')
  from regexp_split_to_table(
    translate(lower(coalesce(p, '')), 'ëçäöüéèêáàâíìîóòôúùûñšžđčćß', 'ecaoueeeaaaiiiooouuunszdccs'),
    '[^a-z0-9]+') with ordinality as x(t, ord)
  where length(t) > 1;
$$;

create or replace function public.name_matches_email(p_name text, p_email text)
returns boolean language plpgsql immutable as $$
declare w text[] := public.name_tokens(p_name); e text[] := public.name_tokens(split_part(coalesce(p_email, ''), '@', 1));
        f text; l text; n int := coalesce(array_length(w, 1), 0); m int := coalesce(array_length(e, 1), 0);
begin
  if n < 2 or m < 1 then return false; end if;
  f := w[1]; l := w[n];
  if m >= 2 then
    -- firstname.lastname (either order); extra middle names in the name are fine, unknown tokens in the email are not
    return f = any(e) and l = any(e) and not exists (select 1 from unnest(e) t where t <> all(w));
  end if;
  -- one word: firstnamelastname, lastnamefirstname, or firstname + last initial (oniksam)
  return e[1] in (f || l, l || f, f || left(l, 1));
end;
$$;

create or replace function public.link_imported_responses(p_user uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  u record; r record; v_app uuid; v_team uuid; v_pos text; v_election uuid; k text; n int := 0; v_by_name boolean; v_amb int;
  positions text[] := array['president','vice_president','secretary','treasurer'];
begin
  select id, lower(email) as email, email_confirmed_at into u from auth.users where id = p_user;
  if u.id is null or u.email_confirmed_at is null then return 0; end if;

  for r in
    select * from public.imported_responses
    where status = 'pending'
      and (lower(email) = u.email or (email is null and public.name_matches_email(full_name, u.email)))
    order by submitted_at nulls last, created_at
  loop
    v_by_name := r.email is null;
    if v_by_name then
      -- two accounts that both look like this name: don't guess, leave it for staff
      select count(*) into v_amb from auth.users x where public.name_matches_email(r.full_name, x.email);
      if v_amb > 1 then continue; end if;
    end if;

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

    update public.imported_responses
       set status = 'linked', linked_user_id = u.id, linked_application_id = v_app, linked_at = now(),
           email = coalesce(email, u.email),
           note = case when v_by_name then 'Linked automatically: the confirmed email ' || u.email || ' matches the name.' else note end
     where id = r.id;
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke all on function public.link_imported_responses(uuid) from public, anon, authenticated;

create or replace function public.link_all_imported_responses()
returns int language plpgsql security definer set search_path = public as $$
declare t int := 0; x record;
begin
  if not public.is_staff(auth.uid()) then raise exception 'Staff only.'; end if;
  for x in
    select u.id from auth.users u
    where u.email_confirmed_at is not null
      and (
        lower(u.email) in (select lower(email) from public.imported_responses where status = 'pending' and email is not null)
        or exists (select 1 from public.imported_responses r where r.status = 'pending' and r.email is null and public.name_matches_email(r.full_name, u.email))
      )
  loop
    t := t + public.link_imported_responses(x.id);
  end loop;
  return t;
end;
$$;
revoke all on function public.link_all_imported_responses() from public, anon;
grant execute on function public.link_all_imported_responses() to authenticated;
