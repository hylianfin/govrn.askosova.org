-- Two laptops counting on the same account.
--   * every ballot remembers which laptop entered it (device_id)
--   * "Undo" only removes the last ballot from the laptop that pressed it, never the other laptop's
--   * each ballot carries a one-time reference (client_ref), so a retry or double send is saved only once
-- Ballots from both laptops are already saved one at a time by the ballot chain lock, so they never overlap.
alter table public.ballots add column if not exists device_id text;
alter table public.ballots add column if not exists client_ref uuid;
create unique index if not exists ballots_client_ref_uniq on public.ballots (client_ref) where client_ref is not null;

create or replace function public.ballots_guard() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then raise exception 'Ballots are never deleted. They can only be voided.'; end if;
  if tg_op = 'TRUNCATE' then raise exception 'Ballots cannot be cleared.'; end if;
  if old.voided_at is not null then raise exception 'A voided ballot cannot change.'; end if;
  if new.id is distinct from old.id or new.election_id is distinct from old.election_id or new.race is distinct from old.race
     or new.kind is distinct from old.kind or new.choices is distinct from old.choices or new.entered_by is distinct from old.entered_by
     or new.created_at is distinct from old.created_at or new.round is distinct from old.round or new.seq is distinct from old.seq
     or new.prev_hash is distinct from old.prev_hash or new.hash is distinct from old.hash
     or new.device_id is distinct from old.device_id or new.client_ref is distinct from old.client_ref then
    raise exception 'Ballots cannot be edited.';
  end if;
  return new;
end $$;

drop function if exists public.record_ballot(text, text, uuid[]);
create or replace function public.record_ballot(p_race text, p_kind text, p_choices uuid[] default '{}', p_device text default null, p_ref uuid default null)
returns int language plpgsql security definer set search_path = public as $$
declare e public.elections%rowtype; maxc int; n int; cur int;
begin
  if not public.is_staff(auth.uid()) then raise exception 'Only staff can count ballots.'; end if;
  select * into e from public.elections order by created_at desc limit 1;
  if not found or e.counting_status <> 'counting' then raise exception 'Counting is not open.'; end if;
  if exists (select 1 from public.race_confirmations where election_id = e.id and race = p_race) then raise exception 'This race is confirmed. An admin must reopen it.'; end if;
  if not exists (select 1 from public.race_candidates(e.id, p_race)) then raise exception 'Unknown race.'; end if;
  cur := public.current_round(e.id, p_race);
  -- Already saved (a retry or a double send): do not add it again.
  if p_ref is not null and exists (select 1 from public.ballots where client_ref = p_ref) then
    select count(*) into n from public.ballots where election_id = e.id and race = p_race and round = cur and voided_at is null;
    return n;
  end if;
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
  insert into public.ballots (election_id, race, kind, choices, entered_by, round, device_id, client_ref)
    values (e.id, p_race, p_kind, p_choices, auth.uid(), cur, nullif(left(p_device, 64), ''), p_ref);
  select count(*) into n from public.ballots where election_id = e.id and race = p_race and round = cur and voided_at is null;
  return n;
end $$;
revoke all on function public.record_ballot(text, text, uuid[], text, uuid) from public, anon;
grant execute on function public.record_ballot(text, text, uuid[], text, uuid) to authenticated;

drop function if exists public.undo_ballot(text);
create or replace function public.undo_ballot(p_race text, p_device text default null)
returns integer language plpgsql security definer set search_path = public as $$
declare e public.elections%rowtype; bid uuid; n int; cur int;
begin
  if not public.is_staff(auth.uid()) then raise exception 'Only staff can count ballots.'; end if;
  select * into e from public.elections order by created_at desc limit 1;
  if not found or e.counting_status <> 'counting' then raise exception 'Counting is not open.'; end if;
  if exists (select 1 from public.race_confirmations where election_id = e.id and race = p_race) then raise exception 'This race is confirmed. An admin must reopen it.'; end if;
  cur := public.current_round(e.id, p_race);
  -- Only this laptop's own latest ballot, so two laptops on one account never undo each other.
  select id into bid from public.ballots
    where election_id = e.id and race = p_race and round = cur and voided_at is null and entered_by = auth.uid()
      and device_id is not distinct from nullif(left(p_device, 64), '')
    order by seq desc limit 1;
  if bid is null then raise exception 'You have no ballot to undo in this race on this laptop.'; end if;
  update public.ballots set voided_at = now(), voided_by = auth.uid() where id = bid;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata) values (auth.uid(), 'ballot.voided', 'ballots', bid, jsonb_build_object('race', p_race, 'election_id', e.id, 'round', cur, 'device', nullif(left(p_device, 64), '')));
  select count(*) into n from public.ballots where election_id = e.id and race = p_race and round = cur and voided_at is null;
  return n;
end $$;
revoke all on function public.undo_ballot(text, text) from public, anon;
grant execute on function public.undo_ballot(text, text) to authenticated;
