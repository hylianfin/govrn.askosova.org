-- Volunteer shifts: a task now has a time window, location and number of slots; assignments gain
-- accept/decline, check-in/out and confirmed hours; volunteers can manage their own assignment
-- and staff can notify people.

alter table public.volunteer_tasks
  add column if not exists location text,
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz,
  add column if not exists slots int not null default 1;

alter table public.volunteer_tasks drop constraint if exists volunteer_tasks_slots_check;
alter table public.volunteer_tasks add constraint volunteer_tasks_slots_check check (slots between 1 and 200);
alter table public.volunteer_tasks drop constraint if exists volunteer_tasks_times_check;
alter table public.volunteer_tasks add constraint volunteer_tasks_times_check check (ends_at is null or starts_at is null or ends_at >= starts_at);

alter table public.volunteer_assignments
  add column if not exists checked_in_at timestamptz,
  add column if not exists checked_out_at timestamptz,
  add column if not exists hours numeric;

alter table public.volunteer_assignments drop constraint if exists volunteer_assignments_status_check;
alter table public.volunteer_assignments add constraint volunteer_assignments_status_check
  check (status in ('assigned','accepted','declined','in_progress','completed','no_show'));

create unique index if not exists volunteer_assignments_task_volunteer_key on public.volunteer_assignments (task_id, volunteer_id);

create or replace function public.is_volunteer(uid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = uid and role = 'volunteer');
$$;

create or replace function public.volunteer_has_room(tid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select (select count(*) from public.volunteer_assignments a where a.task_id = tid and a.status not in ('declined','no_show'))
       < coalesce((select slots from public.volunteer_tasks t where t.id = tid), 0);
$$;

-- Volunteers can accept/decline/check in/out on their own assignment, and sign up for open shifts.
drop policy if exists "volunteer_assignments self update" on public.volunteer_assignments;
create policy "volunteer_assignments self update" on public.volunteer_assignments for update
  using (volunteer_id = auth.uid())
  with check (volunteer_id = auth.uid() and status in ('assigned','accepted','declined','in_progress','completed'));

drop policy if exists "volunteer_assignments self signup" on public.volunteer_assignments;
create policy "volunteer_assignments self signup" on public.volunteer_assignments for insert
  with check (volunteer_id = auth.uid() and status = 'accepted' and public.is_volunteer(auth.uid()) and public.volunteer_has_room(task_id));

-- Only staff may move an assignment to another task/person or set confirmed hours.
create or replace function public.guard_volunteer_assignment()
returns trigger language plpgsql as $$
begin
  if auth.uid() is not null and not public.is_staff(auth.uid()) then
    new.task_id := old.task_id;
    new.volunteer_id := old.volunteer_id;
    new.supervisor_id := old.supervisor_id;
    new.hours := old.hours;
  end if;
  return new;
end;
$$;
drop trigger if exists volunteer_assignment_guard on public.volunteer_assignments;
create trigger volunteer_assignment_guard before update on public.volunteer_assignments
  for each row execute function public.guard_volunteer_assignment();

-- Staff need to see who the volunteers are, and to send notifications (e.g. "you were assigned a shift").
drop policy if exists "user_roles staff read volunteers" on public.user_roles;
create policy "user_roles staff read volunteers" on public.user_roles for select
  using (public.is_staff(auth.uid()) and role = 'volunteer');

drop policy if exists "notifications staff insert" on public.notifications;
create policy "notifications staff insert" on public.notifications for insert with check (public.is_staff(auth.uid()));
