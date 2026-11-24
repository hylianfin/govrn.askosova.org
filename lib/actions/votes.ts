"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validTimezone, wallToIso } from "@/lib/datetime";
import type { PollKind, ShowResults } from "@/lib/votes";

export type VoteResult = { ok: true; id?: string } | { ok: false; error: string };

export type PollPatch = {
  title: string; description: string; kind: PollKind; maxChoices: number; options: string[];
  closeDate: string; closeTime: string; showResults: ShowResults;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (error: string): VoteResult => ({ ok: false, error });
const refresh = () => { revalidatePath("/vote"); revalidatePath("/government/votes"); };

async function session() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user ? { supabase, user } : null;
}

/** Casts the signed-in student's single ballot. The database enforces one vote each, the open window and the choice limit. */
export async function castVote(pollId: string, optionIds: string[]): Promise<VoteResult> {
  const s = await session();
  if (!s) return fail("Sign in to vote.");
  if (!UUID.test(pollId) || optionIds.some((o) => !UUID.test(o))) return fail("That choice is not valid.");
  const { error } = await s.supabase.rpc("cast_poll_vote", { p_poll: pollId, p_options: optionIds });
  if (error) return fail(error.message);
  refresh();
  return { ok: true };
}

export async function savePoll(id: string | null, p: PollPatch): Promise<VoteResult> {
  const s = await session();
  if (!s) return fail("Sign in again.");
  if (id && !UUID.test(id)) return fail("That vote no longer exists.");

  let closesAt: string | null = null;
  if (p.closeDate) {
    const { data } = await s.supabase.from("elections").select("timezone").order("created_at", { ascending: false }).limit(1).maybeSingle();
    const tz = validTimezone(data?.timezone) ? (data.timezone as string) : "UTC";
    closesAt = wallToIso(p.closeDate, p.closeTime || "23:59", tz);
    if (!closesAt) return fail("That closing date or time is not valid.");
  }
  const { data, error } = await s.supabase.rpc("save_poll", {
    p_id: id, p_title: p.title, p_description: p.description, p_kind: p.kind, p_max: p.kind === "single" ? 1 : p.maxChoices,
    p_closes_at: closesAt, p_show_results: p.showResults, p_options: p.options,
  });
  if (error) return fail(error.message);
  refresh();
  return { ok: true, id: data as string };
}

export async function setPollStatus(id: string, status: "open" | "closed"): Promise<VoteResult> {
  const s = await session();
  if (!s) return fail("Sign in again.");
  if (!UUID.test(id)) return fail("That vote no longer exists.");
  const { error } = await s.supabase.rpc("set_poll_status", { p_poll: id, p_status: status });
  if (error) return fail(error.message);
  refresh();
  return { ok: true };
}

export async function deletePoll(id: string): Promise<VoteResult> {
  const s = await session();
  if (!s) return fail("Sign in again.");
  if (!UUID.test(id)) return fail("That vote no longer exists.");
  const { error } = await s.supabase.rpc("delete_poll", { p_poll: id });
  if (error) return fail(error.message);
  refresh();
  return { ok: true };
}
