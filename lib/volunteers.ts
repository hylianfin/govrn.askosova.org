export type AssignmentStatus = "assigned" | "accepted" | "declined" | "in_progress" | "completed" | "no_show";

export const ASSIGNMENT_LABEL: Record<AssignmentStatus, string> = {
  assigned: "Awaiting reply", accepted: "Accepted", declined: "Declined", in_progress: "Checked in", completed: "Completed", no_show: "No-show",
};
export const ASSIGNMENT_VARIANT: Record<AssignmentStatus, "secondary" | "success" | "warning" | "danger" | "info"> = {
  assigned: "warning", accepted: "info", declined: "secondary", in_progress: "info", completed: "success", no_show: "danger",
};
/** Statuses that take up a slot on a shift. */
export const ACTIVE: AssignmentStatus[] = ["assigned", "accepted", "in_progress", "completed"];

const hoursBetween = (a?: string | null, b?: string | null) => (a && b ? Math.max(0, (new Date(b).getTime() - new Date(a).getTime()) / 36e5) : null);

/** Best guess at hours worked: actual check-in/out if present, otherwise the scheduled shift length. */
export function estimateHours(a: { checked_in_at?: string | null; checked_out_at?: string | null }, t: { starts_at?: string | null; ends_at?: string | null }) {
  const h = hoursBetween(a.checked_in_at, a.checked_out_at) ?? hoursBetween(t.starts_at, t.ends_at);
  return h == null ? 0 : Math.round(h * 4) / 4;
}

export const fmtHours = (h: number) => `${Number.isInteger(h) ? h : h.toFixed(2).replace(/0$/, "")} h`;

export function overlaps(a: { starts_at?: string | null; ends_at?: string | null }, b: { starts_at?: string | null; ends_at?: string | null }) {
  if (!a.starts_at || !a.ends_at || !b.starts_at || !b.ends_at) return false;
  return new Date(a.starts_at) < new Date(b.ends_at) && new Date(b.starts_at) < new Date(a.ends_at);
}
