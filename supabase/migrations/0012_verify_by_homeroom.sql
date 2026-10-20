-- When a student's account name matches a response imported without an email, they prove it is theirs by
-- entering their grade and homeroom teacher. Small typos and case/title differences ("ms esma salihu",
-- "MS Esma Salihy") still pass. Wrong guesses are limited so teacher names can't be brute-forced.

create extension if not exists fuzzystrmatch with schema extensions;

-- Two names are the same person's when every word pairs up (typo-tolerant for words of 5+ letters, any order).
create or replace function public.name_fuzzy_equal(a text, b text)
returns boolean language plpgsql stable set search_path = public, extensions as $$
declare x text[] := public.name_tokens(a); y text[] := public.name_tokens(b); tmp text[]; used int[] := '{}'; i int; j int; ok boolean;
begin
  if coalesce(array_length(x, 1), 0) < 2 or coalesce(array_length(y, 1), 0) < 2 then return false; end if;
  if abs(array_length(x, 1) - array_length(y, 1)) > 1 then return false; end if;
  if array_length(x, 1) > array_length(y, 1) then tmp := x; x := y; y := tmp; end if;
  for i in 1..array_length(x, 1) loop
    ok := false;
    for j in 1..array_length(y, 1) loop
      if not (j = any(used)) and (x[i] = y[j] or (length(x[i]) >= 5 and length(y[j]) >= 5 and levenshtein(x[i], y[j]) <= 1)) then
        used := used || j; ok := true; exit;
      end if;
    end loop;
    if not ok then return false; end if;
  end loop;
  return true;
end;
$$;

-- "Ms Esma Salihu" (form answer) vs what the student typed. Titles and case don't matter, a one-letter slip is
-- forgiven in words of 4+ letters, every word typed must be in the answer, and the surname must be among them.
-- If the answer also contains a grade (e.g. "Ms Esma 10A") it must equal the grade entered.
create or replace function public.homeroom_matches(p_input text, p_answer text, p_grade int)
returns boolean language plpgsql stable set search_path = public, extensions as $$
declare
  titles text[] := array['ms','mr','mrs','miss','mz','dr','prof','professor','teacher','sir','madam'];
  a text[]; i text[]; t text; k int; hit boolean; surname_ok boolean := false; g text;
begin
  g := substring(coalesce(p_answer, '') from '(?:^|[^0-9])(9|10|11|12)(?:[^0-9]|$)');
  if g is not null and p_grade is not null and g::int <> p_grade then return false; end if;
  select coalesce(array_agg(x order by o), '{}') into a from unnest(public.name_tokens(p_answer)) with ordinality s(x, o) where x <> all(titles) and x !~ '[0-9]';
  select coalesce(array_agg(x order by o), '{}') into i from unnest(public.name_tokens(p_input)) with ordinality s(x, o) where x <> all(titles) and x !~ '[0-9]';
  if coalesce(array_length(a, 1), 0) = 0 or coalesce(array_length(i, 1), 0) = 0 then return false; end if;
  foreach t in array i loop
    hit := false;
    for k in 1..array_length(a, 1) loop
      if t = a[k] or (length(t) >= 4 and length(a[k]) >= 4 and levenshtein(t, a[k]) <= 1) then
        hit := true;
        if k = array_length(a, 1) then surname_ok := true; end if;
      end if;
    end loop;
    if not hit then return false; end if;
  end loop;
  return surname_ok;
end;
$$;

create table if not exists public.import_verify_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ok boolean not null,
  created_at timestamptz not null default now()
);
create index if not exists import_verify_attempts_user on public.import_verify_attempts (user_id, created_at desc);
alter table public.import_verify_attempts enable row level security;   -- no policies: only the functions below touch it

-- Which kinds of imported application look like they belong to this person (name only; nothing about the content).
create or replace function public.pending_imports_for(p_user uuid)
returns table (kind text) language sql security definer stable set search_path = public, extensions as $$
  select distinct r.kind
  from auth.users u
  join public.profiles p on p.id = u.id
  join public.imported_responses r on r.status = 'pending' and r.email is null and public.name_fuzzy_equal(r.full_name, p.full_name)
  where u.id = p_user and u.email_confirmed_at is not null
    and not exists (
      select 1 from public.applications a
      where a.applicant_id = u.id and a.kind = r.kind
        and (a.status not in ('draft','not_started') or exists (select 1 from public.application_answers x where x.application_id = a.id))
    );
$$;
revoke all on function public.pending_imports_for(uuid) from public, anon, authenticated;

create or replace function public.pending_import_for_me()
returns table (kind text) language sql security definer stable set search_path = public, extensions as $$
  select * from public.pending_imports_for(auth.uid());
$$;
revoke all on function public.pending_import_for_me() from public, anon;
grant execute on function public.pending_import_for_me() to authenticated;

create or replace function public.verify_imported_response_for(p_user uuid, p_grade int, p_teacher text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  u record; p record; r record; hits uuid[] := '{}'; ans text; fails int; v_kind text;
  max_fails constant int := 5;
begin
  select id, lower(email) as email, email_confirmed_at into u from auth.users where id = p_user;
  if u.id is null or u.email_confirmed_at is null then return jsonb_build_object('status', 'unconfirmed'); end if;
  if p_grade is null or p_grade not between 9 and 12 or length(trim(coalesce(p_teacher, ''))) < 2 then
    return jsonb_build_object('status', 'invalid');
  end if;

  select count(*) into fails from public.import_verify_attempts where user_id = u.id and not ok and created_at > now() - interval '1 hour';
  if fails >= max_fails then return jsonb_build_object('status', 'locked'); end if;

  select * into p from public.profiles where id = u.id;
  for r in
    select * from public.imported_responses ir
    where ir.status = 'pending' and ir.email is null and public.name_fuzzy_equal(ir.full_name, p.full_name)
  loop
    select r.answers -> q.id::text ->> 'text' into ans
    from public.application_questions q where q.version_id = r.version_id and q.label ilike '%homeroom%' order by q.order_index limit 1;
    if ans is not null and public.homeroom_matches(p_teacher, ans, p_grade) then hits := hits || r.id; end if;
  end loop;

  if coalesce(array_length(hits, 1), 0) = 0 then
    insert into public.import_verify_attempts (user_id, ok) values (u.id, false);
    return jsonb_build_object('status', 'no_match', 'left', greatest(0, max_fails - fails - 1));
  end if;
  if array_length(hits, 1) > 1 then
    return jsonb_build_object('status', 'ambiguous');   -- two same-name applicants share a teacher; staff decide
  end if;

  select kind into v_kind from public.imported_responses where id = hits[1];
  -- a blank draft started before verifying would otherwise block the link
  delete from public.applications a
   where a.applicant_id = u.id and a.kind = v_kind and a.status in ('draft','not_started')
     and not exists (select 1 from public.application_answers x where x.application_id = a.id);

  update public.imported_responses set email = u.email, note = 'Verified by name and homeroom teacher.' where id = hits[1];
  update public.profiles set grade_level = p_grade, homeroom = nullif(trim(p_teacher), '') where id = u.id;
  perform public.link_imported_responses(u.id);
  insert into public.import_verify_attempts (user_id, ok) values (u.id, true);
  return jsonb_build_object('status', 'linked', 'kind', v_kind);
end;
$$;
revoke all on function public.verify_imported_response_for(uuid, int, text) from public, anon, authenticated;

create or replace function public.verify_imported_response(p_grade int, p_teacher text)
returns jsonb language sql security definer set search_path = public, extensions as $$
  select public.verify_imported_response_for(auth.uid(), p_grade, p_teacher);
$$;
revoke all on function public.verify_imported_response(int, text) from public, anon;
grant execute on function public.verify_imported_response(int, text) to authenticated;
