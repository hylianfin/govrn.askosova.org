-- One running role: administrators do everything that used to be split between "staff reviewer" and "admin".
-- Anyone who was a staff reviewer becomes an administrator, so nobody loses access.
insert into public.user_roles (user_id, role)
  select user_id, 'admin' from public.user_roles where role = 'staff_reviewer'
  on conflict (user_id, role) do nothing;
delete from public.user_roles where role = 'staff_reviewer';

alter table public.user_roles drop constraint if exists user_roles_role_check;
alter table public.user_roles add constraint user_roles_role_check check (role in ('student','executive_member','volunteer','admin'));

-- "Staff" in every policy and function now means administrator.
create or replace function public.is_staff(uid uuid)
returns boolean language sql security definer as $$
  select exists (select 1 from public.user_roles where user_id = uid and role = 'admin');
$$;

create or replace function public.can_run_polls(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = uid and role in ('admin','volunteer'));
$$;
