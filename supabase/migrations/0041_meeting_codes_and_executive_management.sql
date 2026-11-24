alter table public.gov_meetings add column if not exists display_code char(4);
with numbered as (
  select id, lpad((1000 + row_number() over (order by created_at))::text, 4, '0') as display_code
  from public.gov_meetings where display_code is null
)
update public.gov_meetings m set display_code = numbered.display_code from numbered where m.id = numbered.id;
alter table public.gov_meetings alter column display_code set not null;
create unique index if not exists gov_meetings_display_code_unique on public.gov_meetings(display_code);
create or replace function public.assign_gov_meeting_code()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.display_code is null then
    loop
      new.display_code := lpad(floor(random() * 10000)::int::text, 4, '0');
      exit when not exists (select 1 from public.gov_meetings where display_code = new.display_code);
    end loop;
  end if;
  return new;
end $$;
drop trigger if exists gov_meetings_code on public.gov_meetings;
create trigger gov_meetings_code before insert on public.gov_meetings for each row execute function public.assign_gov_meeting_code();
create or replace function public.can_run_government(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin(uid) or exists (select 1 from public.government_members where user_id=uid and status='active' and office not in ('hs_senator','ms_senator'));
$$;
create or replace function public.gov_tv_meeting_id(p_code text)
returns uuid language sql stable security definer set search_path = public as $$ select id from public.gov_meetings where display_code = p_code limit 1; $$;
grant execute on function public.gov_tv_meeting_id(text) to anon, authenticated;
