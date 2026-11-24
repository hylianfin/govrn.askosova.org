// Student government: offices, meetings and the labels the pages share.

export type Office = "hs_president" | "hs_vice_president" | "hs_secretary" | "hs_treasurer" | "ms_president" | "ms_vice_president" | "ms_secretary" | "ms_treasurer" | "hs_senator" | "ms_senator";
export type MeetingBody = "senate" | "executive" | "joint";
export type MeetingStatus = "scheduled" | "in_progress" | "completed" | "cancelled";
export type MinutesStatus = "none" | "draft" | "approved";
export type AttendanceStatus = "present" | "late" | "excused" | "absent";
export type MotionStatus = "pending" | "passed" | "failed" | "tabled" | "withdrawn";
export type BallotVisibility = "open" | "anonymous";
export type AgendaKind = "report" | "discussion" | "motion" | "announcement" | "other";
type Variant = "secondary" | "success" | "warning" | "danger" | "info" | "outline" | "default";

export interface GovMember {
  id: string; user_id: string; office: Office; grade_level: number | null; term: string | null;
  status: "active" | "ended"; started_on: string; ended_on: string | null; note: string | null;
}
export interface GovMeeting {
  id: string; display_code: string; title: string; body: MeetingBody; starts_at: string; ends_at: string | null; location: string | null;
  status: MeetingStatus; minutes: string | null; minutes_status: MinutesStatus; minutes_approved_at: string | null;
}
export interface AgendaItem {
  id: string; meeting_id: string; position: number; title: string; kind: AgendaKind; presenter_id: string | null;
  minutes_allotted: number | null; notes: string | null; done: boolean;
}
export interface AttendanceRow { meeting_id: string; user_id: string; status: AttendanceStatus; note: string | null }
export interface Motion {
  id: string; meeting_id: string; agenda_item_id: string | null; text: string; moved_by: string | null; seconded_by: string | null;
  status: MotionStatus; voting_open: boolean; ballot_visibility: BallotVisibility; votes_yes: number; votes_no: number; votes_abstain: number; voted_at: string | null; created_at: string;
}
export interface ActionItem {
  id: string; meeting_id: string | null; title: string; assignee_id: string | null; due_on: string | null; done: boolean; done_at: string | null;
}
export interface Person { id: string; full_name: string | null; grade_level: number | null }

export const OFFICES: Office[] = ["hs_president", "hs_vice_president", "hs_secretary", "hs_treasurer", "ms_president", "ms_vice_president", "ms_secretary", "ms_treasurer", "hs_senator", "ms_senator"];
export const OFFICERS: Office[] = OFFICES.filter((office) => !office.endsWith("senator"));

export const OFFICE_LABEL: Record<Office, string> = {
  hs_president: "HS President", hs_vice_president: "HS Vice President", hs_secretary: "HS Secretary", hs_treasurer: "HS Treasurer",
  ms_president: "MS President", ms_vice_president: "MS Vice President", ms_secretary: "MS Secretary", ms_treasurer: "MS Treasurer",
  hs_senator: "HS Senator", ms_senator: "MS Senator",
};
export const OFFICE_DUTY: Record<Office, string> = {
  hs_president: "Leads High School student government.", hs_vice_president: "Supports the High School President and leads committees.", hs_secretary: "Maintains High School meeting records.", hs_treasurer: "Manages High School event finances and ticket sales.",
  ms_president: "Leads Middle School student government.", ms_vice_president: "Supports the Middle School President and leads committees.", ms_secretary: "Maintains Middle School meeting records.", ms_treasurer: "Manages Middle School event finances and ticket sales.",
  hs_senator: "Represents High School students in Senate meetings.", ms_senator: "Represents Middle School students in Senate meetings.",
};
export const BODY_LABEL: Record<MeetingBody, string> = { senate: "Senate", executive: "Executive team", joint: "Joint session" };
export const BODY_ABOUT: Record<MeetingBody, string> = {
  senate: "Senators",
  executive: "President, Vice President, Secretary and Treasurer",
  joint: "Senators and the executive team together",
};

export const MEETING_STATUS: Record<MeetingStatus, { label: string; variant: Variant }> = {
  scheduled: { label: "Scheduled", variant: "info" },
  in_progress: { label: "In session", variant: "success" },
  completed: { label: "Completed", variant: "secondary" },
  cancelled: { label: "Cancelled", variant: "danger" },
};
export const MINUTES_STATUS: Record<MinutesStatus, { label: string; variant: Variant }> = {
  none: { label: "No minutes", variant: "outline" },
  draft: { label: "Minutes in draft", variant: "warning" },
  approved: { label: "Minutes approved", variant: "success" },
};
export const ATTENDANCE_LABEL: Record<AttendanceStatus, string> = { present: "Present", late: "Late", excused: "Excused", absent: "Absent" };
export const ATTENDANCE_VARIANT: Record<AttendanceStatus, Variant> = { present: "success", late: "warning", excused: "info", absent: "danger" };
export const MOTION_STATUS: Record<MotionStatus, { label: string; variant: Variant }> = {
  pending: { label: "Awaiting vote", variant: "warning" },
  passed: { label: "Passed", variant: "success" },
  failed: { label: "Failed", variant: "danger" },
  tabled: { label: "Tabled", variant: "secondary" },
  withdrawn: { label: "Withdrawn", variant: "secondary" },
};
export const AGENDA_KIND_LABEL: Record<AgendaKind, string> = {
  report: "Report", discussion: "Discussion", motion: "Motion", announcement: "Announcement", other: "Other",
};

/** Who is expected at a meeting of this body. */
export function membersFor(body: MeetingBody, members: GovMember[]) {
  const active = members.filter((m) => m.status === "active");
  if (body === "senate") return active.filter((m) => m.office.endsWith("senator"));
  if (body === "executive") return active.filter((m) => !m.office.endsWith("senator"));
  return active;
}

/** A majority of the people expected. */
export function quorumOf(expected: number) {
  return expected > 0 ? Math.floor(expected / 2) + 1 : 0;
}

export function nameOf(people: Map<string, Person>, id: string | null | undefined) {
  if (!id) return "Nobody";
  return people.get(id)?.full_name?.trim() || "Former member";
}

/** "2026-11-12" shown as "Thu, 12 Nov". These are calendar days, so there is no timezone shift. */
export function dayLabel(date: string | null | undefined) {
  if (!date) return "";
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return date;
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(d);
}

/** "2026-11-12" plus `n` days, as "YYYY-MM-DD". */
export function addDays(date: string, n: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Today's date as "YYYY-MM-DD" on the election's wall clock. */
export function todayIn(timezone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
