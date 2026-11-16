-- Senate cross-check: each ballot allows up to N marks (default 3), so the total votes can never be more than
-- N x the signatures, and no single ballot can hold more than N marks. Anything else means the count was tampered with.
create or replace function public.senate_vote_checks()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  e public.elections%rowtype; r text; sch text; lbl text; cur int; maxc int; iss int; marks int; over int; valid int; cnt int; checks jsonb := '[]'::jsonb;
begin
  if not public.is_staff(auth.uid()) then return checks; end if;
  select * into e from public.elections order by created_at desc limit 1;
  if not found then return checks; end if;
  select senate_max_choices into maxc from public.election_config;
  for r in select race from public.config_races() where race like 'senate-%' loop
    continue when not exists (select 1 from public.race_candidates(e.id, r));
    sch := split_part(r, '-', 2);
    lbl := public.school_label(sch) || ' Senate';
    cur := public.current_round(e.id, r);
    iss := public.effective_issued(e.id, sch);
    select count(*), coalesce(sum(cardinality(choices)), 0), count(*) filter (where cardinality(choices) > maxc)
      into valid, marks, over
      from public.ballots where election_id = e.id and race = r and round = cur and voided_at is null and kind = 'valid';
    select count(*) into cnt from public.ballots where election_id = e.id and race = r and round = cur and voided_at is null;
    continue when cnt = 0;
    if over > 0 then
      checks := checks || jsonb_build_object('id', 'senate-over-marked-' || r, 'level', 'error', 'school', sch, 'race', r, 'title', lbl || ': ballots with more than ' || maxc || ' marks',
        'detail', over || ' ballot(s) have more than ' || maxc || ' marks, which the paper ballot does not allow. The count may have been tampered with.');
    end if;
    if iss is null then
      checks := checks || jsonb_build_object('id', 'senate-votes-unknown-' || r, 'level', 'warn', 'school', sch, 'race', r, 'title', lbl || ': votes cannot be checked against signatures',
        'detail', 'Enter the number of signatures so the ' || marks || ' votes can be compared with the ' || maxc || ' per ballot limit.');
    elsif marks > maxc * iss then
      checks := checks || jsonb_build_object('id', 'senate-votes-gt-signatures-' || r, 'level', 'error', 'school', sch, 'race', r, 'title', lbl || ': more votes than the signatures allow',
        'detail', marks || ' votes were counted, but ' || iss || ' signatures allow at most ' || (maxc * iss) || ' (' || maxc || ' per ballot). The count may have been tampered with.');
    elsif over = 0 then
      checks := checks || jsonb_build_object('id', 'senate-votes-ok-' || r, 'level', 'ok', 'school', sch, 'race', r, 'title', lbl || ': votes are within the signature limit',
        'detail', marks || ' votes on ' || valid || ' valid ballots, at most ' || (maxc * iss) || ' allowed by ' || iss || ' signatures.');
    end if;
  end loop;
  return checks;
end $$;
revoke all on function public.senate_vote_checks() from public, anon;
grant execute on function public.senate_vote_checks() to authenticated;

-- Add the Senate checks to the existing reconciliation report (also used when the election is ended).
alter function public.reconciliation() rename to reconciliation_base;
create or replace function public.reconciliation()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare base jsonb; checks jsonb;
begin
  base := public.reconciliation_base();
  checks := coalesce(base -> 'checks', '[]'::jsonb) || public.senate_vote_checks();
  return base || jsonb_build_object('checks', checks,
    'errors', (select count(*) from jsonb_array_elements(checks) c where c ->> 'level' = 'error'),
    'warnings', (select count(*) from jsonb_array_elements(checks) c where c ->> 'level' = 'warn'));
end $$;
revoke all on function public.reconciliation() from public, anon;
grant execute on function public.reconciliation() to authenticated;
