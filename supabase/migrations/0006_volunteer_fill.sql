-- How many people hold each shift. Volunteers can only read their own assignments, so open-shift
-- availability has to be counted by a function that bypasses row-level security (counts only).
create or replace function public.volunteer_task_fill()
returns table (task_id uuid, taken bigint)
language sql security definer stable set search_path = public as $$
  select a.task_id, count(*) from public.volunteer_assignments a
  where a.status in ('assigned','accepted','in_progress','completed')
  group by a.task_id;
$$;
revoke all on function public.volunteer_task_fill() from public, anon;
grant execute on function public.volunteer_task_fill() to authenticated;
