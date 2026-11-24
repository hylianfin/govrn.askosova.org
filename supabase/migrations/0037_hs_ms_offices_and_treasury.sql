-- Separate HS and MS seats while preserving existing roster records.
alter table public.government_members drop constraint if exists government_members_office_check;
update public.government_members set office = case office
  when 'president' then 'hs_president' when 'vice_president' then 'hs_vice_president'
  when 'secretary' then 'hs_secretary' when 'treasurer' then 'hs_treasurer'
  when 'senator' then case when grade_level between 1 and 8 then 'ms_senator' else 'hs_senator' end
  else office end;
alter table public.government_members add constraint government_members_office_check check (office in ('hs_president','hs_vice_president','hs_secretary','hs_treasurer','ms_president','ms_vice_president','ms_secretary','ms_treasurer','hs_senator','ms_senator'));
drop index if exists public.government_one_officer;
create unique index government_one_officer on public.government_members(office) where status = 'active' and office not in ('hs_senator','ms_senator');

create or replace function public.can_manage_finance(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin(uid) or exists (select 1 from public.government_members where user_id = uid and status = 'active' and office in ('hs_treasurer','ms_treasurer'));
$$;
grant execute on function public.can_manage_finance(uuid) to authenticated;

create table public.treasury_events (
  id uuid primary key default gen_random_uuid(), title text not null check (char_length(title) between 2 and 160),
  school text not null check (school in ('hs','ms','joint')), ticket_price_cents int not null default 0 check (ticket_price_cents >= 0),
  status text not null default 'draft' check (status in ('draft','on_sale','closed')), created_by uuid references auth.users(id), created_at timestamptz not null default now()
);
create table public.treasury_entries (
  id uuid primary key default gen_random_uuid(), event_id uuid references public.treasury_events(id) on delete set null,
  kind text not null check (kind in ('ticket_sale','refund','expense','adjustment')), quantity int not null default 1 check (quantity <> 0),
  amount_cents int not null, payment_method text check (payment_method in ('cash','card','other')), note text,
  recorded_by uuid not null references auth.users(id), created_at timestamptz not null default now()
);
create index treasury_entries_event_created on public.treasury_entries(event_id, created_at desc);
alter table public.treasury_events enable row level security;
alter table public.treasury_entries enable row level security;
create policy "treasury events manage" on public.treasury_events for all using (public.can_manage_finance(auth.uid())) with check (public.can_manage_finance(auth.uid()));
create policy "treasury entries manage" on public.treasury_entries for all using (public.can_manage_finance(auth.uid())) with check (public.can_manage_finance(auth.uid()));

create or replace function public.can_run_government(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin(uid) or exists (select 1 from public.government_members where user_id = uid and status = 'active' and office in ('hs_secretary','ms_secretary'));
$$;
