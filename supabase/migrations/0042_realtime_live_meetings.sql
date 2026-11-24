-- Publish meeting changes for authenticated government members. RLS still controls
-- which database changes each subscribed client receives.
do $$
declare t text;
begin
  foreach t in array array['gov_meetings', 'gov_agenda_items', 'gov_attendance', 'gov_motions', 'gov_motion_ballots']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
