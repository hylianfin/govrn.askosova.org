-- Operational controls for election day. Disabling an election stops new ballot
-- check-ins while preserving all attendance and ballot-history records.
alter table public.elections
  add column if not exists is_enabled boolean not null default true,
  add column if not exists disabled_at timestamptz,
  add column if not exists disabled_by uuid references auth.users(id),
  add column if not exists disabled_reason text;

create or replace function public.set_election_enabled(p_enabled boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare e public.elections%rowtype; reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if not public.is_admin(auth.uid()) then raise exception 'Only an admin can change the election status.'; end if;
  select * into e from public.elections order by created_at desc limit 1;
  if not found then raise exception 'No election is configured.'; end if;
  if not p_enabled and reason is null then raise exception 'Add a reason before disabling the election.'; end if;

  update public.elections
  set is_enabled = p_enabled,
      disabled_at = case when p_enabled then null else now() end,
      disabled_by = case when p_enabled then null else auth.uid() end,
      disabled_reason = case when p_enabled then null else reason end,
      updated_at = now()
  where id = e.id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), case when p_enabled then 'election.enabled' else 'election.disabled' end, 'elections', e.id,
    jsonb_build_object('reason', reason, 'previouslyEnabled', e.is_enabled));
end $$;
revoke all on function public.set_election_enabled(boolean, text) from public, anon;
grant execute on function public.set_election_enabled(boolean, text) to authenticated;

-- RLS remains the enforcement point even if a client bypasses the UI.
drop policy if exists "checkins issue" on public.ballot_checkins;
create policy "checkins issue" on public.ballot_checkins for insert with check (
  public.can_run_polls(auth.uid())
  and issued_by = auth.uid()
  and exists (select 1 from public.elections e where e.id = election_id and e.is_enabled)
);
