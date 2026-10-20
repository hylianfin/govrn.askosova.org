"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { formatWhen, validTimezone, wallToIso } from "@/lib/datetime";
import { ACTIVE, overlaps, type AssignmentStatus } from "@/lib/volunteers";

export type VResult = { ok: true } | { ok: false; error: string; conflict?: boolean };
export type TaskPatch = {
  title: string; description: string; instructions: string; location: string;
  date: string; startTime: string; endTime: string; slots: number;
};

const STATUSES: AssignmentStatus[] = ["assigned", "accepted", "declined", "in_progress", "completed", "no_show"];
const refresh = () => ["/staff/volunteers", "/dashboard/volunteer", "/dashboard/notifications", "/dashboard"].forEach((p) => revalidatePath(p));

async function ctx(staffOnly: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  if (staffOnly) {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).in("role", ["staff_reviewer", "admin"]);
    if (!data?.length) return null;
  }
  return { supabase, user };
}

async function electionTz(supabase: any) {
  const { data } = await supabase.from("elections").select("timezone").order("created_at", { ascending: false }).limit(1).maybeSingle();
  return validTimezone(data?.timezone) ? (data.timezone as string) : "UTC";
}

// ---- staff ----

export async function saveTask(id: string | null, p: TaskPatch): Promise<VResult> {
  const c = await ctx(true);
  if (!c) return { ok: false, error: "Only staff can manage shifts." };
  const title = p.title.trim();
  if (!title) return { ok: false, error: "Give the shift a title." };
  const slots = Math.floor(Number(p.slots));
  if (!(slots >= 1 && slots <= 200)) return { ok: false, error: "Slots must be between 1 and 200." };
  const tz = await electionTz(c.supabase);
  let starts: string | null = null, ends: string | null = null;
  if (p.date) {
    starts = wallToIso(p.date, p.startTime || "00:00", tz);
    ends = wallToIso(p.date, p.endTime || "23:59", tz);
    if (!starts || !ends) return { ok: false, error: "That date or time is not valid." };
    if (new Date(ends) < new Date(starts)) return { ok: false, error: "The shift must end after it starts." };
  }
  const row = {
    title: title.slice(0, 200), description: p.description.trim().slice(0, 2000) || null, instructions: p.instructions.trim().slice(0, 4000) || null,
    location: p.location.trim().slice(0, 200) || null, starts_at: starts, ends_at: ends, due_at: starts, slots,
  };
  if (id) {
    const { error } = await c.supabase.from("volunteer_tasks").update(row).eq("id", id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { data: election } = await c.supabase.from("elections").select("id").order("created_at", { ascending: false }).limit(1).maybeSingle();
    const { error } = await c.supabase.from("volunteer_tasks").insert({ ...row, election_id: election?.id ?? null });
    if (error) return { ok: false, error: error.message };
  }
  refresh();
  return { ok: true };
}

export async function deleteTask(id: string): Promise<VResult> {
  const c = await ctx(true);
  if (!c) return { ok: false, error: "Only staff can manage shifts." };
  const { error } = await c.supabase.from("volunteer_tasks").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export async function assignVolunteer(taskId: string, volunteerId: string, force = false): Promise<VResult> {
  const c = await ctx(true);
  if (!c) return { ok: false, error: "Only staff can assign volunteers." };
  const { supabase, user } = c;
  const { data: task } = await supabase.from("volunteer_tasks").select("id, title, slots, starts_at, ends_at, location").eq("id", taskId).maybeSingle();
  if (!task) return { ok: false, error: "Shift not found." };

  const { data: existing } = await supabase.from("volunteer_assignments").select("id, status, task_id, volunteer_tasks(title, starts_at, ends_at)").eq("volunteer_id", volunteerId);
  const mine = (existing ?? []) as any[];
  const dup = mine.find((a) => a.task_id === taskId);
  if (dup && !["declined", "no_show"].includes(dup.status)) return { ok: false, error: "They are already on this shift." };

  const { count } = await supabase.from("volunteer_assignments").select("*", { count: "exact", head: true }).eq("task_id", taskId).in("status", ACTIVE);
  if ((count ?? 0) >= task.slots) return { ok: false, error: "This shift is already full. Raise the number of slots first." };

  if (!force) {
    const clash = mine.find((a) => a.task_id !== taskId && ACTIVE.includes(a.status) && overlaps(a.volunteer_tasks ?? {}, task));
    if (clash) return { ok: false, conflict: true, error: `They are already booked on “${clash.volunteer_tasks?.title}” at the same time.` };
  }

  const { error } = dup
    ? await supabase.from("volunteer_assignments").update({ status: "assigned", supervisor_id: user.id, checked_in_at: null, checked_out_at: null, completed_at: null }).eq("id", dup.id)
    : await supabase.from("volunteer_assignments").insert({ task_id: taskId, volunteer_id: volunteerId, status: "assigned", supervisor_id: user.id });
  if (error) return { ok: false, error: error.message };

  const tz = await electionTz(supabase);
  await supabase.from("notifications").insert({
    user_id: volunteerId, title: `You were assigned a shift: ${task.title}`,
    body: `${formatWhen(task.starts_at, task.ends_at, tz)}${task.location ? ` · ${task.location}` : ""}. Open Volunteer Tasks to accept or decline.`,
    link: "/dashboard/volunteer",
  });
  refresh();
  return { ok: true };
}

export async function removeAssignment(id: string): Promise<VResult> {
  const c = await ctx(true);
  if (!c) return { ok: false, error: "Only staff can manage assignments." };
  const { error } = await c.supabase.from("volunteer_assignments").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export async function setAssignmentStatus(id: string, status: AssignmentStatus): Promise<VResult> {
  const c = await ctx(true);
  if (!c) return { ok: false, error: "Only staff can manage assignments." };
  if (!STATUSES.includes(status)) return { ok: false, error: "Unknown status." };
  const { error } = await c.supabase.from("volunteer_assignments").update({ status, completed_at: status === "completed" ? new Date().toISOString() : null }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export async function confirmHours(id: string, hours: number): Promise<VResult> {
  const c = await ctx(true);
  if (!c) return { ok: false, error: "Only staff can confirm hours." };
  const h = Math.round(Number(hours) * 100) / 100;
  if (!(h >= 0 && h <= 24)) return { ok: false, error: "Hours must be between 0 and 24." };
  const { error } = await c.supabase.from("volunteer_assignments").update({ hours: h, status: "completed", completed_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

// ---- volunteers (own shifts; enforced again by row-level security) ----

export async function signUpForShift(taskId: string): Promise<VResult> {
  const c = await ctx(false);
  if (!c) return { ok: false, error: "You need to sign in again." };
  const { supabase, user } = c;
  const { data: task } = await supabase.from("volunteer_tasks").select("id, starts_at, ends_at, slots").eq("id", taskId).maybeSingle();
  if (!task) return { ok: false, error: "Shift not found." };
  const { data: mine } = await supabase.from("volunteer_assignments").select("id, task_id, status, volunteer_tasks(title, starts_at, ends_at)").eq("volunteer_id", user.id);
  const prior = (mine ?? []).find((a: any) => a.task_id === taskId);
  if (prior && !["declined", "no_show"].includes(prior.status)) return { ok: false, error: "You are already on this shift." };
  const clash = (mine ?? []).find((a: any) => a.task_id !== taskId && ACTIVE.includes(a.status) && overlaps((a as any).volunteer_tasks ?? {}, task));
  if (clash) return { ok: false, error: `That overlaps with your shift “${(clash as any).volunteer_tasks?.title}”.` };
  const { error } = prior
    ? await supabase.from("volunteer_assignments").update({ status: "accepted" }).eq("id", prior.id)
    : await supabase.from("volunteer_assignments").insert({ task_id: taskId, volunteer_id: user.id, status: "accepted" });
  if (error) return { ok: false, error: /row-level security/i.test(error.message) ? "This shift is full, or you are not registered as a volunteer." : error.message };
  refresh();
  return { ok: true };
}

export async function updateMyAssignment(id: string, action: "accept" | "decline" | "check_in" | "check_out"): Promise<VResult> {
  const c = await ctx(false);
  if (!c) return { ok: false, error: "You need to sign in again." };
  const now = new Date().toISOString();
  const patch =
    action === "accept" ? { status: "accepted" } :
    action === "decline" ? { status: "declined" } :
    action === "check_in" ? { status: "in_progress", checked_in_at: now } :
    { status: "completed", checked_out_at: now, completed_at: now };
  const { error } = await c.supabase.from("volunteer_assignments").update(patch).eq("id", id).eq("volunteer_id", c.user.id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}
