-- Push counting changes to every open counting screen through Supabase Realtime.
-- Realtime respects row level security, so only staff (who may read these tables) receive the events.
do $$
declare t text;
begin
  foreach t in array array['ballots', 'race_confirmations', 'elections'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
