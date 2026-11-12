-- Live results for the public home page: names, numbers and votes per candidate, only once counting has started.
create or replace function public.public_results()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  e public.elections%rowtype; r text; sch text; cur int; out jsonb := '[]'::jsonb; cands jsonb;
  n_valid int; n_invalid int; n_blank int; confirmed boolean;
begin
  select * into e from public.elections order by created_at desc limit 1;
  if not found then return jsonb_build_object('status', 'not_started', 'races', out); end if;
  if e.counting_status = 'not_started' then return jsonb_build_object('status', 'not_started', 'races', out); end if;
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
    select count(*) filter (where kind = 'valid'), count(*) filter (where kind = 'invalid'), count(*) filter (where kind = 'blank')
      into n_valid, n_invalid, n_blank from public.ballots where election_id = e.id and race = r and round = cur and voided_at is null;
    select exists (select 1 from public.race_confirmations x where x.election_id = e.id and x.race = r) into confirmed;
    out := out || jsonb_build_object(
      'race', r, 'kind', split_part(r, '-', 1), 'school', sch, 'schoolLabel', public.school_label(sch),
      'seats', case when r like 'senate-%' then (select senate_seats from public.election_config) else 1 end,
      'valid', n_valid, 'invalid', n_invalid, 'blank', n_blank, 'confirmed', confirmed, 'candidates', cands);
  end loop;
  return jsonb_build_object('status', e.counting_status, 'races', out);
end $$;
revoke all on function public.public_results() from public;
grant execute on function public.public_results() to anon, authenticated;
