-- Supabase grants execute on new functions to anon by default, which "revoke ... from public" does not remove.
-- The counting and polling-desk functions are for signed-in staff, admins and volunteers only.
revoke execute on function public.live_results() from anon;
revoke execute on function public.record_ballot(text, text, uuid[]) from anon;
revoke execute on function public.undo_ballot(text) from anon;
revoke execute on function public.confirm_race(text) from anon;
revoke execute on function public.reopen_race(text) from anon;
revoke execute on function public.set_counting(text) from anon;
revoke execute on function public.race_candidates(uuid, text) from anon, authenticated;
revoke execute on function public.search_students(text, int) from anon;
revoke execute on function public.eligible_voter_count() from anon;
revoke execute on function public.can_run_polls(uuid) from anon;

-- The polling-desk functions from 0017 were also executable by everyone; limit them to signed-in users.
revoke all on function public.search_students(text, int) from public;
revoke all on function public.eligible_voter_count() from public;
revoke all on function public.can_run_polls(uuid) from public;
grant execute on function public.search_students(text, int) to authenticated;
grant execute on function public.eligible_voter_count() to authenticated;
grant execute on function public.can_run_polls(uuid) to authenticated;
