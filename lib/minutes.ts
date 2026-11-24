import { formatWhen } from "@/lib/datetime";
import {
  ATTENDANCE_LABEL, BODY_LABEL, quorumOf, type ActionItem, type AgendaItem, type AttendanceRow, type AttendanceStatus,
  type GovMeeting, type GovMember, type Motion, type Person,
} from "@/lib/government";

/** A first draft of the minutes from what was recorded in the meeting. The secretary edits it before approval. */
export function draftMinutes(i: {
  meeting: GovMeeting; timezone: string; expected: GovMember[]; attendance: AttendanceRow[]; agenda: AgendaItem[];
  motions: Motion[]; actions: ActionItem[]; people: Person[];
}) {
  const name = (id: string | null) => (id ? i.people.find((p) => p.id === id)?.full_name?.trim() || "a former member" : "nobody");
  const byUser = new Map(i.attendance.map((a) => [a.user_id, a.status]));
  const out: string[] = [];

  out.push(`${BODY_LABEL[i.meeting.body]} meeting: ${i.meeting.title}`);
  out.push([formatWhen(i.meeting.starts_at, i.meeting.ends_at, i.timezone), i.meeting.location].filter(Boolean).join(" · "));

  out.push("", "ATTENDANCE");
  for (const s of ["present", "late", "excused", "absent"] as AttendanceStatus[]) {
    const who = i.expected.filter((m) => byUser.get(m.user_id) === s).map((m) => name(m.user_id));
    if (who.length) out.push(`${ATTENDANCE_LABEL[s]}: ${who.join(", ")}`);
  }
  const unmarked = i.expected.filter((m) => !byUser.has(m.user_id)).map((m) => name(m.user_id));
  if (unmarked.length) out.push(`Not recorded: ${unmarked.join(", ")}`);
  const here = i.expected.filter((m) => ["present", "late"].includes(byUser.get(m.user_id) ?? "")).length;
  const need = quorumOf(i.expected.length);
  if (i.expected.length) out.push(`Quorum: ${here >= need ? "met" : "not met"} (${here} of ${i.expected.length} here, ${need} needed).`);

  if (i.agenda.length) {
    out.push("", "AGENDA AND DISCUSSION");
    i.agenda.forEach((a, n) => {
      const bits = [a.presenter_id ? name(a.presenter_id) : "", a.minutes_allotted ? `${a.minutes_allotted} min` : ""].filter(Boolean).join(", ");
      out.push(`${n + 1}. ${a.title}${bits ? ` (${bits})` : ""}${a.done ? "" : " [not discussed]"}`);
      if (a.notes) out.push(`   ${a.notes.replace(/\n/g, "\n   ")}`);
    });
  }

  if (i.motions.length) {
    out.push("", "MOTIONS");
    i.motions.forEach((m, n) => {
      out.push(`${n + 1}. ${m.text}`);
      const who = `Moved by ${name(m.moved_by)}${m.seconded_by ? `, seconded by ${name(m.seconded_by)}` : ""}.`;
      const result = m.status === "passed" || m.status === "failed"
        ? `${m.status === "passed" ? "Passed" : "Failed"} ${m.votes_yes} to ${m.votes_no}${m.votes_abstain ? `, ${m.votes_abstain} abstained` : ""}.`
        : m.status === "pending" ? "No vote recorded." : `${m.status === "tabled" ? "Tabled" : "Withdrawn"}.`;
      out.push(`   ${who} ${result}`);
    });
  }

  if (i.actions.length) {
    out.push("", "ACTION ITEMS");
    for (const a of i.actions) {
      out.push(`- ${a.title} (${a.assignee_id ? name(a.assignee_id) : "unassigned"}${a.due_on ? `, due ${a.due_on}` : ""})`);
    }
  }
  return out.join("\n");
}
