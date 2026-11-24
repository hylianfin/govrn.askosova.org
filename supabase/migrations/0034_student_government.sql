-- Student government operations: who sits in government, the meetings they hold, and the secretary's records.
-- Offices: president, vice president, secretary, treasurer (the executive team) and senators.
-- Administrators can do everything the secretary can. Government members can read everything; only the
-- secretary and administrators change meetings, attendance, motions, minutes and action items.

-- ---------------------------------------------------------------- roster
create table if not exists public.government_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  office text not null check (office in ('president','vice_president','secretary','treasurer','senator')),
  grade_level int check (grade_level is null or grade_level between 1 and 13),
  term text,
  status text not null default 'active' check (status in ('active','ended')),
  started_on date not null default current_date,
  ended_on date,
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
-- One seat per person, and one holder per executive office, at a time.
create unique index if not exists government_one_seat_each on public.government_members(user_id) where status = 'active';
create unique index if not exists government_one_officer on public.government_members(office) where status = 'active' and office <> 'senator';

-- ---------------------------------------------------------------- who is allowed
create or replace function public.is_gov_member(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.government_members where user_id = uid and status = 'active');
$$;

create or replace function public.can_run_government(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin(uid)
    or exists (select 1 from public.government_members where user_id = uid and status = 'active' and office = 'secretary');
$$;

create or replace function public.can_see_government(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin(uid) or public.is_gov_member(uid);
$$;

revoke all on function public.is_gov_member(uuid), public.can_run_government(uuid), public.can_see_government(uuid) from public, anon;
grant execute on function public.is_gov_member(uuid), public.can_run_government(uuid), public.can_see_government(uuid) to authenticated;

-- ---------------------------------------------------------------- meetings
create table if not exists public.gov_meetings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default 'senate' check (body in ('senate','executive','joint')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  status text not null default 'scheduled' check (status in ('scheduled','in_progress','completed','cancelled')),
  minutes text,
  minutes_status text not null default 'none' check (minutes_status in ('none','draft','approved')),
  minutes_approved_at timestamptz,
  minutes_approved_by uuid references auth.users(id),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);
create index if not exists idx_gov_meetings_starts on public.gov_meetings(starts_at desc);

create table if not exists public.gov_agenda_items (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.gov_meetings(id) on delete cascade,
  position int not null default 0,
  title text not null,
  kind text not null default 'discussion' check (kind in ('report','discussion','motion','announcement','other')),
  presenter_id uuid references public.profiles(id) on delete set null,
  minutes_allotted int check (minutes_allotted is null or minutes_allotted between 1 and 480),
  notes text,
  done boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_gov_agenda_meeting on public.gov_agenda_items(meeting_id, position);

create table if not exists public.gov_attendance (
  meeting_id uuid not null references public.gov_meetings(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('present','late','excused','absent')),
  note text,
  recorded_by uuid references auth.users(id),
  recorded_at timestamptz not null default now(),
  primary key (meeting_id, user_id)
);

create table if not exists public.gov_motions (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.gov_meetings(id) on delete cascade,
  agenda_item_id uuid references public.gov_agenda_items(id) on delete set null,
  text text not null,
  moved_by uuid references public.profiles(id) on delete set null,
  seconded_by uuid references public.profiles(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','passed','failed','tabled','withdrawn')),
  votes_yes int not null default 0 check (votes_yes >= 0),
  votes_no int not null default 0 check (votes_no >= 0),
  votes_abstain int not null default 0 check (votes_abstain >= 0),
  voted_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  check (moved_by is null or seconded_by is null or moved_by <> seconded_by)
);
create index if not exists idx_gov_motions_meeting on public.gov_motions(meeting_id, created_at);

create table if not exists public.gov_action_items (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references public.gov_meetings(id) on delete set null,
  title text not null,
  assignee_id uuid references public.profiles(id) on delete set null,
  due_on date,
  done boolean not null default false,
  done_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_gov_actions_open on public.gov_action_items(done, due_on);

drop trigger if exists gov_meetings_upd on public.gov_meetings;
create trigger gov_meetings_upd before update on public.gov_meetings for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- row level security
alter table public.government_members enable row level security;
alter table public.gov_meetings enable row level security;
alter table public.gov_agenda_items enable row level security;
alter table public.gov_attendance enable row level security;
alter table public.gov_motions enable row level security;
alter table public.gov_action_items enable row level security;

-- The roster: members read it, only administrators change it.
drop policy if exists "gov_members read" on public.government_members;
create policy "gov_members read" on public.government_members for select
  using (user_id = auth.uid() or public.can_see_government(auth.uid()));
drop policy if exists "gov_members admin" on public.government_members;
create policy "gov_members admin" on public.government_members for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- Everything else: members read, the secretary and administrators write.
do $$
declare t text;
begin
  foreach t in array array['gov_meetings','gov_agenda_items','gov_attendance','gov_motions','gov_action_items'] loop
    execute format('drop policy if exists %I on public.%I', t || ' read', t);
    execute format('create policy %I on public.%I for select using (public.can_see_government(auth.uid()))', t || ' read', t);
    execute format('drop policy if exists %I on public.%I', t || ' run', t);
    execute format('create policy %I on public.%I for all using (public.can_run_government(auth.uid())) with check (public.can_run_government(auth.uid()))', t || ' run', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- names
-- Members cannot read profiles directly, so names for people in government go through this function
-- (name and grade only, never email).
create or replace function public.gov_people()
returns table (id uuid, full_name text, grade_level int)
language sql stable security definer set search_path = public as $$
  select p.id, p.full_name, p.grade_level
  from public.profiles p
  where public.can_see_government(auth.uid())
    and exists (select 1 from public.government_members m where m.user_id = p.id);
$$;
revoke all on function public.gov_people() from public, anon;
grant execute on function public.gov_people() to authenticated;

-- ---------------------------------------------------------------- votes
-- Records the tally for a motion. The tally cannot be larger than the people present, so attendance comes first.
create or replace function public.gov_record_vote(p_motion uuid, p_yes int, p_no int, p_abstain int)
returns text language plpgsql security definer set search_path = public as $$
declare m public.gov_motions%rowtype; present int; outcome text;
begin
  if not public.can_run_government(auth.uid()) then raise exception 'Only the secretary or an administrator can record a vote.'; end if;
  if p_yes < 0 or p_no < 0 or p_abstain < 0 then raise exception 'Vote counts cannot be negative.'; end if;
  select * into m from public.gov_motions where id = p_motion;
  if not found then raise exception 'That motion no longer exists.'; end if;
  select count(*) into present from public.gov_attendance where meeting_id = m.meeting_id and status in ('present','late');
  if present = 0 then raise exception 'Record attendance before voting.'; end if;
  if p_yes + p_no + p_abstain > present then
    raise exception 'The tally (%) is larger than the % members present.', p_yes + p_no + p_abstain, present;
  end if;
  if p_yes + p_no + p_abstain = 0 then raise exception 'Enter at least one vote.'; end if;
  outcome := case when p_yes > p_no then 'passed' else 'failed' end;
  update public.gov_motions
    set votes_yes = p_yes, votes_no = p_no, votes_abstain = p_abstain, status = outcome, voted_at = now()
    where id = p_motion;
  return outcome;
end $$;
revoke all on function public.gov_record_vote(uuid, int, int, int) from public, anon;
grant execute on function public.gov_record_vote(uuid, int, int, int) to authenticated;

-- ---------------------------------------------------------------- notices
-- Tells every active member something (a new meeting, minutes ready to read). Returns how many were told.
create or replace function public.gov_notify(p_title text, p_body text, p_link text)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.can_run_government(auth.uid()) then raise exception 'Only the secretary or an administrator can send notices.'; end if;
  if coalesce(trim(p_title), '') = '' then raise exception 'A notice needs a title.'; end if;
  insert into public.notifications (user_id, title, body, link)
    select m.user_id, left(trim(p_title), 200), nullif(left(trim(coalesce(p_body, '')), 1000), ''), nullif(p_link, '')
    from public.government_members m
    where m.status = 'active' and m.user_id <> auth.uid();
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.gov_notify(text, text, text) from public, anon;
grant execute on function public.gov_notify(text, text, text) to authenticated;

-- ---------------------------------------------------------------- audit trail
create or replace function public.gov_audit()
returns trigger language plpgsql security definer set search_path = public as $$
declare row jsonb := to_jsonb(coalesce(new, old));
begin
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'government.' || tg_table_name || '.' || lower(tg_op), tg_table_name, (row->>'id')::uuid,
    jsonb_build_object('office', row->>'office', 'title', row->>'title', 'status', row->>'status', 'minutes_status', row->>'minutes_status'));
  return coalesce(new, old);
end $$;

-- Only the triggers below run this; nobody should call it through the API.
revoke all on function public.gov_audit() from public, anon, authenticated;

drop trigger if exists gov_members_audit on public.government_members;
create trigger gov_members_audit after insert or delete or update of status, office on public.government_members for each row execute function public.gov_audit();
drop trigger if exists gov_meetings_audit on public.gov_meetings;
create trigger gov_meetings_audit after insert or delete or update of status, minutes_status on public.gov_meetings for each row execute function public.gov_audit();
