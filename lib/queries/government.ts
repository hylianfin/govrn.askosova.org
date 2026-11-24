import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import { validTimezone } from "@/lib/datetime";
import type {
  ActionItem, AgendaItem, AttendanceRow, GovMeeting, GovMember, Motion, Person,
} from "@/lib/government";

/** Who the signed-in person is in government: their seat, and whether they may change records. Cached per request. */
export const getGovAccess = cache(async () => {
  const user = await getCurrentUser();
  if (!user) return null;
  const admin = user.roles.includes("admin");
  const supabase = await createClient();
  const { data } = await supabase.from("government_members").select("*").eq("user_id", user.id).eq("status", "active").maybeSingle();
  const seat = (data as GovMember | null) ?? null;
  // Keep the client permissions in sync with can_run_government in the database:
  // every executive officer runs meetings; senators can participate and make motions.
  return { user, admin, seat, canSee: admin || !!seat, canRun: admin || (!!seat && !seat.office.endsWith("senator")) };
});

/** True once migration 0034 has been applied. Pages show a setup notice instead of failing when it has not. */
export const governmentReady = cache(async () => {
  const supabase = await createClient();
  const { error } = await supabase.from("government_members").select("id", { count: "exact", head: true });
  return !error;
});

export async function getElectionTimezone() {
  const supabase = await createClient();
  const { data } = await supabase.from("elections").select("timezone, title, academic_years(label)").order("created_at", { ascending: false }).limit(1).maybeSingle();
  const year = Array.isArray(data?.academic_years) ? data.academic_years[0] : data?.academic_years;
  return {
    timezone: validTimezone(data?.timezone) ? (data!.timezone as string) : "UTC",
    academicYear: typeof year?.label === "string" ? year.label : null,
    title: (data?.title as string | undefined) ?? null,
  };
}

export async function getRoster(includeEnded = false): Promise<GovMember[]> {
  const supabase = await createClient();
  let q = supabase.from("government_members").select("*").order("started_on");
  if (!includeEnded) q = q.eq("status", "active");
  const { data } = await q;
  return (data ?? []) as GovMember[];
}

export async function getPeople(): Promise<Map<string, Person>> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("gov_people");
  return new Map(((data ?? []) as Person[]).map((p) => [p.id, p]));
}

export async function getMeetings(): Promise<GovMeeting[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("gov_meetings").select("*").order("starts_at", { ascending: false });
  return (data ?? []) as GovMeeting[];
}

export async function getMeetingBundle(id: string) {
  const supabase = await createClient();
  const { data: meeting } = await supabase.from("gov_meetings").select("*").eq("id", id).maybeSingle();
  if (!meeting) return null;
  const [agenda, attendance, motions, actions] = await Promise.all([
    supabase.from("gov_agenda_items").select("*").eq("meeting_id", id).order("position").order("created_at"),
    supabase.from("gov_attendance").select("*").eq("meeting_id", id),
    supabase.from("gov_motions").select("*").eq("meeting_id", id).order("created_at"),
    supabase.from("gov_action_items").select("*").eq("meeting_id", id).order("created_at"),
  ]);
  return {
    meeting: meeting as GovMeeting,
    agenda: (agenda.data ?? []) as AgendaItem[],
    attendance: (attendance.data ?? []) as AttendanceRow[],
    motions: (motions.data ?? []) as Motion[],
    actions: (actions.data ?? []) as ActionItem[],
  };
}

export async function getActionItems(): Promise<ActionItem[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("gov_action_items").select("*").order("done").order("due_on", { ascending: true, nullsFirst: false });
  return (data ?? []) as ActionItem[];
}

export async function getAllAttendance(): Promise<AttendanceRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("gov_attendance").select("*");
  return (data ?? []) as AttendanceRow[];
}

export async function getAgendaCounts(): Promise<Map<string, number>> {
  const supabase = await createClient();
  const { data } = await supabase.from("gov_agenda_items").select("meeting_id");
  const counts = new Map<string, number>();
  for (const r of (data ?? []) as { meeting_id: string }[]) counts.set(r.meeting_id, (counts.get(r.meeting_id) ?? 0) + 1);
  return counts;
}

export async function getRecentMotions(limit = 5): Promise<Motion[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("gov_motions").select("*").in("status", ["passed", "failed"]).order("voted_at", { ascending: false }).limit(limit);
  return (data ?? []) as Motion[];
}
