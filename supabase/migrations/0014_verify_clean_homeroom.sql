-- Same as 0012's verify function, but the profile keeps the form's clean spelling of the homeroom teacher.
create or replace function public.verify_imported_response_for(p_user uuid, p_grade int, p_teacher text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  u record; p record; r record; hits uuid[] := '{}'; ans text; hit_ans text; fails int; v_kind text;
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
    if ans is not null and public.homeroom_matches(p_teacher, ans, p_grade) then hits := hits || r.id; hit_ans := ans; end if;
  end loop;

  if coalesce(array_length(hits, 1), 0) = 0 then
    insert into public.import_verify_attempts (user_id, ok) values (u.id, false);
    return jsonb_build_object('status', 'no_match', 'left', greatest(0, max_fails - fails - 1));
  end if;
  if array_length(hits, 1) > 1 then
    return jsonb_build_object('status', 'ambiguous');
  end if;

  select kind into v_kind from public.imported_responses where id = hits[1];
  delete from public.applications a
   where a.applicant_id = u.id and a.kind = v_kind and a.status in ('draft','not_started')
     and not exists (select 1 from public.application_answers x where x.application_id = a.id);

  update public.imported_responses set email = u.email, note = 'Verified by name and homeroom teacher.' where id = hits[1];
  update public.profiles set grade_level = p_grade, homeroom = nullif(trim(regexp_replace(coalesce(hit_ans, p_teacher), '\s*\m(9|10|11|12)[A-Za-z]?\M.*$', '')), '') where id = u.id;
  perform public.link_imported_responses(u.id);
  insert into public.import_verify_attempts (user_id, ok) values (u.id, true);
  return jsonb_build_object('status', 'linked', 'kind', v_kind);
end;
$$;
revoke all on function public.verify_imported_response_for(uuid, int, text) from public, anon, authenticated;
