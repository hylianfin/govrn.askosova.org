import { createClient } from "@/lib/supabase/server";
import type { Poll, PollOption, PollSummary } from "@/lib/votes";

/** True once migration 0035 has been applied. */
export async function votesReady() {
  const supabase = await createClient();
  const { error } = await supabase.from("polls").select("id", { count: "exact", head: true });
  return !error;
}

/** Every vote this person may see (drafts only for the people who run votes), newest first. */
export async function getPolls(): Promise<Poll[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("polls").select("*, poll_options(id, poll_id, label, position)").order("created_at", { ascending: false });
  return ((data ?? []) as (Omit<Poll, "options"> & { poll_options: PollOption[] | null })[]).map(({ poll_options, ...p }) => ({
    ...p,
    options: [...(poll_options ?? [])].sort((a, b) => a.position - b.position),
  }));
}

export async function getSummaries(ids: string[]): Promise<Record<string, PollSummary | null>> {
  if (ids.length === 0) return {};
  const supabase = await createClient();
  const { data } = await supabase.rpc("poll_summaries", { p_polls: ids });
  return (data ?? {}) as Record<string, PollSummary | null>;
}

/** The votes this person has already cast. A ballot records that you voted, never what you chose. */
export async function getMyVotedIds(): Promise<Set<string>> {
  const supabase = await createClient();
  const { data } = await supabase.from("poll_voters").select("poll_id");
  return new Set(((data ?? []) as { poll_id: string }[]).map((r) => r.poll_id));
}
