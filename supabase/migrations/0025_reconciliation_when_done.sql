-- Mismatches that only make sense once a school's count is finished (Government vs Senate, issued but not counted)
-- are checked only after both of its races are confirmed, so the check does not cry wolf while counting is still going on.
create or replace function public.reconciliation()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  e public.elections%rowtype; sch text; r text; checks jsonb := '[]'::jsonb;
  reg int; iss int; pg int; ps int; cg int; cs int; vg int; vs int; cur int; margin int; top1 int; top2 int; dev int; recount_diff int;
  lbl text; errs int := 0; warns int := 0; done boolean;
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
    done := exists (select 1 from public.race_confirmations x where x.election_id = e.id and x.race = 'exec-' || sch)
            and (not exists (select 1 from public.race_candidates(e.id, 'senate-' || sch)) or exists (select 1 from public.race_confirmations x where x.election_id = e.id and x.race = 'senate-' || sch));

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
    if done and cg <> cs and (cg > 0 or cs > 0) then
      dev := greatest(dev, abs(cg - cs));
      checks := checks || jsonb_build_object('id', 'gov-sen-differ-' || sch, 'level', case when abs(cg - cs) > greatest(3, coalesce(iss, cg) * 0.02) then 'error' else 'warn' end, 'school', sch,
        'title', lbl || ': Government and Senate counts differ', 'detail', 'Each voter gets both ballots, but ' || cg || ' Government and ' || cs || ' Senate ballots were counted.');
    end if;
    if done and iss is not null and greatest(cg, cs) < iss and (cg > 0 or cs > 0) then
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
    done := exists (select 1 from public.race_confirmations x where x.election_id = e.id and x.race = 'exec-' || sch)
            and (not exists (select 1 from public.race_candidates(e.id, 'senate-' || sch)) or exists (select 1 from public.race_confirmations x where x.election_id = e.id and x.race = 'senate-' || sch));
    dev := greatest(case when iss is not null then greatest(cg - iss, 0) else 0 end,
                    case when done then abs(cg - cs) else 0 end,
                    case when done and iss is not null then greatest(iss - greatest(cg, cs), 0) else 0 end);
    if dev > 0 and coalesce(top1, 0) > 0 and dev >= margin then
      checks := checks || jsonb_build_object('id', 'margin-' || sch, 'level', 'error', 'school', sch, 'race', 'exec-' || sch,
        'title', (case sch when 'middle' then 'Middle School' else 'High School' end) || ' Government: the gap is as large as the winning margin',
        'detail', 'The winner leads by ' || margin || ' vote(s), but the numbers differ by up to ' || dev || ' ballot(s). The result cannot be trusted until it is recounted or the election is repeated.');
    end if;
  end loop;

  select count(*) filter (where c ->> 'level' = 'error'), count(*) filter (where c ->> 'level' = 'warn') into errs, warns from jsonb_array_elements(checks) c;
  return jsonb_build_object('checks', checks, 'errors', errs, 'warnings', warns);
end $$;

