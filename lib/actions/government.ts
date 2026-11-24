"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { formatWhen, validTimezone, wallToIso } from "@/lib/datetime";
import {
  OFFICES, OFFICE_LABEL, type AgendaKind, type AttendanceStatus, type MeetingBody, type MeetingStatus, type Office,
} from "@/lib/government";

export type GResult = { ok: true; id?: string } | { ok: false; error: string };
export type StudentHit = { id: string; name: string; email: string; grade: number | null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BODIES: MeetingBody[] = ["senate", "executive", "joint"];
const KINDS: AgendaKind[] = ["report", "discussion", "motion", "announcement", "other"];
const ATTENDANCE: AttendanceStatus[] = ["present", "late", "excused", "absent"];
// Where each meeting status may go next.
const NEXT_STATUS: Record<MeetingStatus, MeetingStatus[]> = {
  scheduled: ["in_progress", "cancelled"],
  in_progress: ["completed", "scheduled"],
  completed: ["in_progress"],
  cancelled: ["scheduled"],
};

const fail = (error: string): GResult => ({ ok: false, error });
const ok = (id?: string): GResult => ({ ok: true, id });
const clean = (s: unknown, max: number) => (typeof s === "string" ? s.trim().slice(0, max) : "");
const uuid = (s: unknown) => (typeof s === "string" && UUID.test(s) ? s : null);
const refresh = () => revalidatePath("/government", "layout");

/** The signed-in person, if they may change government records ("run") or manage the roster ("admin"). */
async function ctx(need: "run" | "admin") {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  if (need === "admin") {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin");
    return data?.length ? { supabase, user } : null;
  }
  const { data } = await supabase.rpc("can_run_government", { uid: user.id });
  return data ? { supabase, user } : null;
}

async function memberCtx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.rpc("can_see_government", { uid: user.id });
  return data ? { supabase, user } : null;
}

async function financeCtx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.rpc("can_manage_finance", { uid: user.id });
  return data ? { supabase, user } : null;
}

export async function saveTreasuryEvent(title: string, school: "hs" | "ms" | "joint", price: number): Promise<GResult> {
  const c = await financeCtx();
  if (!c) return fail("Only a treasurer or administrator can manage finances.");
  const name = clean(title, 160), cents = Math.round(price * 100);
  if (!name || !["hs", "ms", "joint"].includes(school) || !Number.isFinite(cents) || cents < 0) return fail("Enter a valid event and ticket price.");
  const { data: permitted } = await c.supabase.rpc("can_manage_finance_for_school", { uid: c.user.id, school_key: school });
  if (!permitted) return fail("You can only manage events for your own school.");
  const { error } = await c.supabase.from("treasury_events").insert({ title: name, school, ticket_price_cents: cents, created_by: c.user.id });
  if (error) return fail(error.message); refresh(); return ok();
}

export async function recordTreasuryEntry(eventId: string, kind: "ticket_sale" | "refund" | "expense" | "adjustment", amount: number, quantity: number, method: "cash" | "card" | "other", note: string): Promise<GResult> {
  const c = await financeCtx();
  if (!c) return fail("Only a treasurer or administrator can manage finances.");
  const cents = Math.round(amount * 100), qty = Math.trunc(quantity);
  if (!uuid(eventId) || !["ticket_sale", "refund", "expense", "adjustment"].includes(kind) || !Number.isFinite(cents) || cents <= 0 || !Number.isInteger(qty) || qty < 1) return fail("Enter a valid transaction.");
  const { data: event } = await c.supabase.from("treasury_events").select("school").eq("id", eventId).maybeSingle();
  const { data: permitted } = event ? await c.supabase.rpc("can_manage_finance_for_school", { uid: c.user.id, school_key: event.school }) : { data: false };
  if (!permitted) return fail("You can only manage finances for your own school.");
  const signed = kind === "ticket_sale" ? cents : -cents;
  const { error } = await c.supabase.from("treasury_entries").insert({ event_id: eventId, kind, quantity: qty, amount_cents: signed, payment_method: method, note: clean(note, 500) || null, recorded_by: c.user.id });
  if (error) return fail(error.message); refresh(); return ok();
}

const NO_RUN = "Only an executive officer or administrator can change government records.";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- createClient() is untyped across the app
async function electionTz(supabase: any) {
  const { data } = await supabase.from("elections").select("timezone, academic_years(label)").order("created_at", { ascending: false }).limit(1).maybeSingle();
  const year = Array.isArray(data?.academic_years) ? data.academic_years[0] : data?.academic_years;
  return { tz: validTimezone(data?.timezone) ? (data.timezone as string) : "UTC", academicYear: typeof year?.label === "string" ? year.label : null };
}

// ---------------------------------------------------------------- meetings

export type MeetingPatch = { title: string; body: MeetingBody; date: string; startTime: string; endTime: string; location: string };

export async function saveMeeting(id: string | null, p: MeetingPatch): Promise<GResult> {
  const c = await ctx("run");
  if (!c) return fail("Only an executive officer or administrator can schedule meetings.");
  const title = clean(p.title, 160);
  if (!title) return fail("Give the meeting a title.");
  if (!BODIES.includes(p.body)) return fail("Choose who the meeting is for.");
  const { tz } = await electionTz(c.supabase);
  const starts = wallToIso(p.date, p.startTime || "00:00", tz);
  if (!starts) return fail("Pick a valid date and start time.");
  let ends: string | null = null;
  if (p.endTime) {
    ends = wallToIso(p.date, p.endTime, tz);
    if (!ends) return fail("That end time is not valid.");
    if (new Date(ends) < new Date(starts)) return fail("The meeting must end after it starts.");
  }
  const row = { title, body: p.body, starts_at: starts, ends_at: ends, location: clean(p.location, 200) || null };

  if (id) {
    if (!uuid(id)) return fail("That meeting no longer exists.");
    const { error } = await c.supabase.from("gov_meetings").update(row).eq("id", id);
    if (error) return fail(error.message);
    refresh();
    return ok(id);
  }
  const { data, error } = await c.supabase.from("gov_meetings").insert({ ...row, created_by: c.user.id }).select("id").single();
  if (error || !data) return fail(error?.message ?? "The meeting could not be saved.");
  // Telling members is a courtesy; the meeting is saved either way.
  await c.supabase.rpc("gov_notify", {
    p_title: `New meeting: ${title}`,
    p_body: [formatWhen(starts, ends, tz), row.location].filter(Boolean).join(" · "),
    p_link: `/government/meetings/${data.id}`,
  });
  refresh();
  return ok(data.id as string);
}

export async function setMeetingStatus(id: string, status: MeetingStatus): Promise<GResult> {
  const c = await ctx("run");
  if (!c) return fail(NO_RUN);
  if (!uuid(id)) return fail("That meeting no longer exists.");
  const { data: m } = await c.supabase.from("gov_meetings").select("status, title").eq("id", id).maybeSingle();
  if (!m) return fail("That meeting no longer exists.");
  if (!NEXT_STATUS[m.status as MeetingStatus]?.includes(status)) return fail("The meeting cannot move to that status from here.");
  const { error } = await c.supabase.from("gov_meetings").update({ status }).eq("id", id);
  if (error) return fail(error.message);
  if (status === "cancelled") {
    await c.supabase.rpc("gov_notify", { p_title: `Meeting cancelled: ${m.title}`, p_body: "", p_link: `/government/meetings/${id}` });
  }
  refresh();
  return ok(id);
}

// ---------------------------------------------------------------- agenda

export type AgendaPatch = { title: string; kind: AgendaKind; presenterId: string; minutes: string; notes: string };

export async function saveAgendaItem(meetingId: string, id: string | null, p: AgendaPatch): Promise<GResult> {
  const c = await ctx("run");
  if (!c) return fail(NO_RUN);
  if (!uuid(meetingId)) return fail("That meeting no longer exists.");
  const title = clean(p.title, 200);
  if (!title) return fail("Give the agenda item a title.");
  if (!KINDS.includes(p.kind)) return fail("Choose a type for the item.");
  const allotted = p.minutes.trim() === "" ? null : Math.floor(Number(p.minutes));
  if (allotted !== null && !(allotted >= 1 && allotted <= 480)) return fail("Minutes must be between 1 and 480.");
  const row = {
    title, kind: p.kind, presenter_id: uuid(p.presenterId), minutes_allotted: allotted, notes: clean(p.notes, 2000) || null,
  };
  if (id) {
    if (!uuid(id)) return fail("That item no longer exists.");
    const { error } = await c.supabase.from("gov_agenda_items").update(row).eq("id", id).eq("meeting_id", meetingId);
    if (error) return fail(error.message);
  } else {
    const { data: last } = await c.supabase.from("gov_agenda_items").select("position").eq("meeting_id", meetingId).order("position", { ascending: false }).limit(1).maybeSingle();
    const { error } = await c.supabase.from("gov_agenda_items").insert({ ...row, meeting_id: meetingId, position: (last?.position ?? 0) + 1 });
    if (error) return fail(error.message);
  }
  refresh();
  return ok();
}

export async function moveAgendaItem(meetingId: string, id: string, direction: -1 | 1): Promise<GResult> {
  const c = await ctx("run");
  if (!c) return fail(NO_RUN);
  if (!uuid(meetingId) || !uuid(id)) return fail("That item no longer exists.");
  const { data } = await c.supabase.from("gov_agenda_items").select("id").eq("meeting_id", meetingId).order("position").order("created_at");
  const ids = ((data ?? []) as { id: string }[]).map((r) => r.id);
  const from = ids.indexOf(id);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= ids.length) return ok();
  [ids[from], ids[to]] = [ids[to], ids[from]];
  const results = await Promise.all(ids.map((x, i) => c.supabase.from("gov_agenda_items").update({ position: i + 1 }).eq("id", x)));
  const failed = results.find((r: { error: { message: string } | null }) => r.error);
  if (failed?.error) return fail(failed.error.message);
  refresh();
  return ok();
}

export async function toggleAgendaItem(id: string, done: boolean): Promise<GResult> {
  const c = await ctx("run");
  if (!c) return fail(NO_RUN);
  if (!uuid(id)) return fail("That item no longer exists.");
  const { error } = await c.supabase.from("gov_agenda_items").update({ done }).eq("id", id);
  if (error) return fail(error.message);
  refresh();
  return ok();
}

export async function deleteAgendaItem(id: string): Promise<GResult> {
  const c = await ctx("run");
  if (!c) return fail(NO_RUN);
  if (!uuid(id)) return fail("That item no longer exists.");
  const { error } = await c.supabase.from("gov_agenda_items").delete().eq("id", id);
  if (error) return fail(error.message);
  refresh();
  return ok();
}

// ---------------------------------------------------------------- attendance

/** Sets one person's attendance, or clears it when `status` is null. */
export async function setAttendance(meetingId: string, userId: string, status: AttendanceStatus | null): Promise<GResult> {
  return setAttendanceMany(meetingId, [userId], status);
}

export async function setAttendanceMany(meetingId: string, userIds: string[], status: AttendanceStatus | null): Promise<GResult> {
  const c = await ctx("run");
  if (!c) return fail(NO_RUN);
  const ids = [...new Set(userIds.map(uuid).filter((x): x is string => !!x))];
  if (!uuid(meetingId) || ids.length === 0) return fail("Choose who to mark.");
  if (status !== null && !ATTENDANCE.includes(status)) return fail("Unknown attendance status.");
  // Only people who hold (or held) a government seat appear on the register.
  const { data: seats } = await c.supabase.from("government_members").select("user_id").in("user_id", ids);
  const known = new Set(((seats ?? []) as { user_id: string }[]).map((s) => s.user_id));
  const valid = ids.filter((x) => known.has(x));
  if (valid.length === 0) return fail("That person is not in government.");

  const { error } = status === null
    ? await c.supabase.from("gov_attendance").delete().eq("meeting_id", meetingId).in("user_id", valid)
    : await c.supabase.from("gov_attendance").upsert(
        valid.map((user_id) => ({ meeting_id: meetingId, user_id, status, recorded_by: c.user.id, recorded_at: new Date().toISOString() })),
        { onConflict: "meeting_id,user_id" },
      );
  if (error) return fail(error.message);
  refresh();
  return ok();
}

// ---------------------------------------------------------------- motions and votes

export type MotionPatch = { text: string; movedBy: string; secondedBy: string; agendaItemId: string; ballotVisibility: "open" | "anonymous" };

export async function saveMotion(meetingId: string, id: string | null, p: MotionPatch): Promise<GResult> {
  const c = id ? await ctx("run") : await memberCtx();
  if (!c) return fail(id ? NO_RUN : "Only active government members can make a motion.");
  if (!uuid(meetingId)) return fail("That meeting no longer exists.");
  const text = clean(p.text, 1000);
  if (!text) return fail("Write the motion as it was moved.");
  if (!["open", "anonymous"].includes(p.ballotVisibility)) return fail("Choose whether this ballot is open or anonymous.");
  const movedBy = uuid(p.movedBy), secondedBy = uuid(p.secondedBy);
  if (movedBy && movedBy === secondedBy) return fail("The person who moves a motion cannot also second it.");
  const row = { text, moved_by: movedBy, seconded_by: secondedBy, agenda_item_id: uuid(p.agendaItemId), ballot_visibility: p.ballotVisibility };
  if (id) {
    if (!uuid(id)) return fail("That motion no longer exists.");
    const { data: m } = await c.supabase.from("gov_motions").select("status").eq("id", id).maybeSingle();
    if (m && m.status !== "pending") return fail("Reopen the motion before changing it.");
    const { error } = await c.supabase.from("gov_motions").update(row).eq("id", id).eq("meeting_id", meetingId);
    if (error) return fail(error.message);
  } else {
    const { error } = await c.supabase.from("gov_motions").insert({ ...row, meeting_id: meetingId, created_by: c.user.id });
    if (error) return fail(error.message);
  }
  refresh();
  return ok();
}

export async function setMotionVoting(id: string, open: boolean): Promise<GResult> {
  const c = await ctx("run"); if (!c || !uuid(id)) return fail(NO_RUN);
  const { error } = await c.supabase.rpc(open ? "gov_open_motion_vote" : "gov_close_motion_vote", { p_motion: id });
  if (error) return fail(error.message); refresh(); return ok();
}
export async function castMotionVote(id: string, choice: "yes" | "no" | "abstain"): Promise<GResult> {
  const supabase = await createClient(); const { error } = await supabase.rpc("gov_cast_motion_vote", { p_motion: id, p_choice: choice });
  if (error) return fail(error.message); refresh(); return ok();
}

export async function setMotionStatus(id: string, status: "pending" | "tabled" | "withdrawn"): Promise<GResult> {
  const c = await ctx("run");
  if (!c) return fail(NO_RUN);
  if (!uuid(id)) return fail("That motion no longer exists.");
  const { error } = status === "pending"
    ? await c.supabase.rpc("gov_reopen_motion_vote", { p_motion: id })
    : await c.supabase.rpc("gov_set_motion_status", { p_motion: id, p_status: status });
  if (error) return fail(error.message);
  refresh();
  return ok();
}

export async function deleteMotion(id: string): Promise<GResult> {
  const c = await ctx("run");
  if (!c) return fail(NO_RUN);
  if (!uuid(id)) return fail("That motion no longer exists.");
  const { data: m } = await c.supabase.from("gov_motions").select("status").eq("id", id).maybeSingle();
  if (m && (m.status === "passed" || m.status === "failed")) return fail("A motion with a recorded vote cannot be deleted. Reopen it first.");
  const { error } = await c.supabase.from("gov_motions").delete().eq("id", id);
  if (error) return fail(error.message);
  refresh();
  return ok();
}

// ---------------------------------------------------------------- minutes

export async function saveMinutes(meetingId: string, text: string): Promise<GResult> {
  const c = await ctx("run");
  if (!c) return fail(NO_RUN);
  if (!uuid(meetingId)) return fail("That meeting no longer exists.");
  const { data: m } = await c.supabase.from("gov_meetings").select("minutes_status").eq("id", meetingId).maybeSingle();
  if (!m) return fail("That meeting no longer exists.");
  if (m.minutes_status === "approved") return fail("These minutes are approved. An administrator can reopen them.");
  const body = text.trim().slice(0, 40000);
  const { error } = await c.supabase.from("gov_meetings").update({ minutes: body || null, minutes_status: body ? "draft" : "none" }).eq("id", meetingId);
  if (error) return fail(error.message);
  refresh();
  return ok();
}

export async function approveMinutes(meetingId: string): Promise<GResult> {
  const c = await ctx("run");
  if (!c) return fail(NO_RUN);
  if (!uuid(meetingId)) return fail("That meeting no longer exists.");
  const { data: m } = await c.supabase.from("gov_meetings").select("title, minutes, minutes_status").eq("id", meetingId).maybeSingle();
  if (!m) return fail("That meeting no longer exists.");
  if (m.minutes_status !== "draft" || !m.minutes?.trim()) return fail("Save the minutes as a draft before approving them.");
  const { error } = await c.supabase.from("gov_meetings")
    .update({ minutes_status: "approved", minutes_approved_at: new Date().toISOString(), minutes_approved_by: c.user.id }).eq("id", meetingId);
  if (error) return fail(error.message);
  await c.supabase.rpc("gov_notify", { p_title: `Minutes approved: ${m.title}`, p_body: "", p_link: `/government/meetings/${meetingId}` });
  refresh();
  return ok();
}

export async function reopenMinutes(meetingId: string): Promise<GResult> {
  const c = await ctx("admin");
  if (!c) return fail("Only an administrator can reopen approved minutes.");
  if (!uuid(meetingId)) return fail("That meeting no longer exists.");
  const { error } = await c.supabase.from("gov_meetings")
    .update({ minutes_status: "draft", minutes_approved_at: null, minutes_approved_by: null }).eq("id", meetingId).eq("minutes_status", "approved");
  if (error) return fail(error.message);
  refresh();
  return ok();
}

// ---------------------------------------------------------------- action items

export type ActionPatch = { title: string; assigneeId: string; dueOn: string; meetingId: string };

export async function saveActionItem(id: string | null, p: ActionPatch): Promise<GResult> {
  const c = await ctx("run");
  if (!c) return fail(NO_RUN);
  const title = clean(p.title, 300);
  if (!title) return fail("Describe what needs to be done.");
  let dueOn: string | null = null;
  if (p.dueOn) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.dueOn) || Number.isNaN(Date.parse(p.dueOn))) return fail("That due date is not valid.");
    dueOn = p.dueOn;
  }
  const row = { title, assignee_id: uuid(p.assigneeId), due_on: dueOn, meeting_id: uuid(p.meetingId) };
  if (id) {
    if (!uuid(id)) return fail("That action item no longer exists.");
    const { error } = await c.supabase.from("gov_action_items").update(row).eq("id", id);
    if (error) return fail(error.message);
  } else {
    const { error } = await c.supabase.from("gov_action_items").insert({ ...row, created_by: c.user.id });
    if (error) return fail(error.message);
  }
  refresh();
  return ok();
}

export async function toggleActionItem(id: string, done: boolean): Promise<GResult> {
  const c = await ctx("run");
  if (!c) return fail(NO_RUN);
  if (!uuid(id)) return fail("That action item no longer exists.");
  const { error } = await c.supabase.from("gov_action_items").update({ done, done_at: done ? new Date().toISOString() : null }).eq("id", id);
  if (error) return fail(error.message);
  refresh();
  return ok();
}

export async function deleteActionItem(id: string): Promise<GResult> {
  const c = await ctx("run");
  if (!c) return fail(NO_RUN);
  if (!uuid(id)) return fail("That action item no longer exists.");
  const { error } = await c.supabase.from("gov_action_items").delete().eq("id", id);
  if (error) return fail(error.message);
  refresh();
  return ok();
}

// ---------------------------------------------------------------- the roster (administrators)

export async function searchStudents(q: string): Promise<StudentHit[]> {
  const c = await ctx("admin");
  if (!c) return [];
  const term = q.trim().replace(/[%_,()*]/g, " ").trim().slice(0, 60);
  if (term.length < 2) return [];
  const { data } = await c.supabase.from("profiles").select("id, full_name, email, grade_level")
    .or(`full_name.ilike.%${term}%,email.ilike.%${term}%`).order("full_name").limit(8);
  return ((data ?? []) as { id: string; full_name: string | null; email: string; grade_level: number | null }[])
    .map((p) => ({ id: p.id, name: p.full_name || p.email, email: p.email, grade: p.grade_level }));
}

function seatError(message: string, office: Office) {
  if (message.includes("government_one_seat_each")) return "That student already holds a seat. End their current term first.";
  if (message.includes("government_one_officer")) return `The ${OFFICE_LABEL[office]} seat is already filled. End that term first.`;
  return message;
}

export async function addMember(userId: string, office: Office, grade: number | null): Promise<GResult> {
  const c = await ctx("admin");
  if (!c) return fail("Only an administrator can change who is in government.");
  if (!uuid(userId)) return fail("Choose a student.");
  if (!OFFICES.includes(office)) return fail("Choose an office.");
  const { data: profile } = await c.supabase.from("profiles").select("grade_level").eq("id", userId).maybeSingle();
  if (!profile) return fail("That student could not be found.");
  const level = grade ?? profile.grade_level ?? null;
  if (office.endsWith("senator") && !(level && Number.isInteger(level) && level >= 1 && level <= 13)) return fail("A senator needs a grade (1 to 13).");
  const { academicYear } = await electionTz(c.supabase);
  const { data, error } = await c.supabase.from("government_members")
    .insert({ user_id: userId, office, grade_level: level, term: academicYear, created_by: c.user.id }).select("id").single();
  if (error) return fail(seatError(error.message, office));
  refresh();
  return ok(data?.id as string | undefined);
}

export async function changeOffice(id: string, office: Office): Promise<GResult> {
  const c = await ctx("admin");
  if (!c) return fail("Only an administrator can change who is in government.");
  if (!uuid(id) || !OFFICES.includes(office)) return fail("Choose an office.");
  const { error } = await c.supabase.from("government_members").update({ office }).eq("id", id).eq("status", "active");
  if (error) return fail(seatError(error.message, office));
  refresh();
  return ok();
}

export async function endMembership(id: string): Promise<GResult> {
  const c = await ctx("admin");
  if (!c) return fail("Only an administrator can change who is in government.");
  if (!uuid(id)) return fail("That seat no longer exists.");
  const { error } = await c.supabase.from("government_members")
    .update({ status: "ended", ended_on: new Date().toISOString().slice(0, 10) }).eq("id", id).eq("status", "active");
  if (error) return fail(error.message);
  refresh();
  return ok();
}
