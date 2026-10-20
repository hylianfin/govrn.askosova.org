-- Election-day polling desk: volunteers and staff check students in and record that a ballot was issued.
-- This records who received a ballot, never who they voted for.
create table if not exists public.ballot_checkins (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.elections(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  issued_by uuid references auth.users(id),
  issued_at timestamptz not null default now(),
  unique (election_id, student_id)
);
alter table public.ballot_checkins enable row level security;

create or replace function public.can_run_polls(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = uid and role in ('admin','staff_reviewer','volunteer'));
$$;

create policy "checkins read" on public.ballot_checkins for select using (public.can_run_polls(auth.uid()));
create policy "checkins issue" on public.ballot_checkins for insert with check (public.can_run_polls(auth.uid()) and issued_by = auth.uid());
create policy "checkins undo" on public.ballot_checkins for delete using (public.is_staff(auth.uid()));

-- Volunteers cannot read profiles directly, so name search goes through this function (name and grade only).
create or replace function public.search_students(q text, lim int default 8)
returns table (id uuid, full_name text, grade_level int, issued boolean)
language sql stable security definer set search_path = public as $$
  select p.id, p.full_name, p.grade_level,
         exists (select 1 from public.ballot_checkins c
                 where c.student_id = p.id
                   and c.election_id = (select e.id from public.elections e order by e.created_at desc limit 1))
  from public.profiles p
  where public.can_run_polls(auth.uid())
    and p.grade_level is not null
    and length(trim(coalesce(q, ''))) >= 2
    and p.full_name ilike '%' || trim(q) || '%'
  order by p.full_name
  limit least(greatest(lim, 1), 20);
$$;

create or replace function public.eligible_voter_count()
returns int language sql stable security definer set search_path = public as $$
  select case when public.can_run_polls(auth.uid()) then (select count(*)::int from public.profiles where grade_level is not null) else 0 end;
$$;
