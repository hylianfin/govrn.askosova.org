"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isoToWall, validTimezone, wallToIso } from "@/lib/datetime";
import { STAGE_LABELS, type ElectionStage } from "@/lib/types";

type Result = { ok: true } | { ok: false; error: string };
export type EventPatch = {
  title: string; description: string; location: string;
  startDate: string; startTime: string; endDate: string; endTime: string; public: boolean;
};

async function adminCtx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: role } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
  if (!role) return null;
  const { data: election } = await supabase.from("elections").select("id, timezone").order("created_at", { ascending: false }).limit(1).maybeSingle();
  return election ? { supabase, election } : null;
}

const refresh = () => ["/admin/timeline", "/election-timeline", "/executive-team", "/dashboard", "/admin", "/staff"].forEach((p) => revalidatePath(p));

async function renumber(supabase: any, electionId: string) {
  const { data } = await supabase.from("election_events").select("id, start_at, order_index").eq("election_id", electionId);
  const sorted = [...(data ?? [])].sort((a: any, b: any) => {
    if (!a.start_at) return 1;
    if (!b.start_at) return -1;
    return new Date(a.start_at).getTime() - new Date(b.start_at).getTime();
  });
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].order_index !== i + 1) await supabase.from("election_events").update({ order_index: i + 1 }).eq("id", sorted[i].id);
  }
}

export type NewEvent = { id: string; startDate: string; startTime: string; endDate: string; endTime: string };

export async function createEvent(): Promise<({ ok: true } & NewEvent) | { ok: false; error: string }> {
  const ctx = await adminCtx();
  if (!ctx) return { ok: false, error: "Admins only." };
  const { supabase, election } = ctx;
  const { data: last } = await supabase.from("election_events").select("end_at, start_at").eq("election_id", election.id).order("start_at", { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
  // Default to the day after the latest event, 08:00-15:00, so a new row is already valid.
  const base = new Date(last?.end_at ?? last?.start_at ?? Date.now());
  base.setUTCDate(base.getUTCDate() + 1);
  const day = base.toISOString().slice(0, 10);
  const start = wallToIso(day, "08:00", election.timezone);
  const end = wallToIso(day, "15:00", election.timezone);
  const { data, error } = await supabase.from("election_events").insert({
    election_id: election.id, title: "New milestone", public: true, order_index: 999, start_at: start, end_at: end,
  }).select("id").single();
  if (error || !data) return { ok: false, error: error?.message ?? "Could not add the event." };
  await renumber(supabase, election.id);
  refresh();
  const a = isoToWall(start, election.timezone);
  const b = isoToWall(end, election.timezone);
  return { ok: true, id: data.id, startDate: a.date, startTime: a.time, endDate: b.date, endTime: b.time };
}

export async function saveEvent(id: string, p: EventPatch): Promise<Result> {
  const ctx = await adminCtx();
  if (!ctx) return { ok: false, error: "Admins only." };
  const { supabase, election } = ctx;
  const title = p.title.trim();
  if (!title) return { ok: false, error: "Give the milestone a title." };
  const start = p.startDate ? wallToIso(p.startDate, p.startTime || "00:00", election.timezone) : null;
  const end = p.endDate ? wallToIso(p.endDate, p.endTime || "23:59", election.timezone) : null;
  if (p.startDate && !start) return { ok: false, error: "That start date or time is not valid." };
  if (p.endDate && !end) return { ok: false, error: "That end date or time is not valid." };
  if (start && end && new Date(end) < new Date(start)) return { ok: false, error: "The end must be after the start." };
  const { error } = await supabase.from("election_events").update({
    title: title.slice(0, 200), description: p.description.trim().slice(0, 2000) || null, location: p.location.trim().slice(0, 200) || null,
    start_at: start, end_at: end, public: !!p.public,
  }).eq("id", id).eq("election_id", election.id);
  if (error) return { ok: false, error: error.message };
  await renumber(supabase, election.id);
  refresh();
  return { ok: true };
}

export async function deleteEvent(id: string): Promise<Result> {
  const ctx = await adminCtx();
  if (!ctx) return { ok: false, error: "Admins only." };
  const { error } = await ctx.supabase.from("election_events").delete().eq("id", id).eq("election_id", ctx.election.id);
  if (error) return { ok: false, error: error.message };
  await renumber(ctx.supabase, ctx.election.id);
  refresh();
  return { ok: true };
}

export async function setStage(stage: string): Promise<Result> {
  const ctx = await adminCtx();
  if (!ctx) return { ok: false, error: "Admins only." };
  if (!(stage in STAGE_LABELS)) return { ok: false, error: "Unknown stage." };
  const { error } = await ctx.supabase.from("elections").update({ current_stage: stage as ElectionStage }).eq("id", ctx.election.id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export async function setTimezone(tz: string): Promise<Result> {
  const ctx = await adminCtx();
  if (!ctx) return { ok: false, error: "Admins only." };
  if (!validTimezone(tz)) return { ok: false, error: "That is not a valid timezone, try for example Europe/Berlin." };
  const { error } = await ctx.supabase.from("elections").update({ timezone: tz }).eq("id", ctx.election.id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}
