"use client";

import { CheckCheck, Eraser } from "lucide-react";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/dashboard/primitives";
import { setAttendance, setAttendanceMany } from "@/lib/actions/government";
import {
  ATTENDANCE_LABEL, ATTENDANCE_VARIANT, OFFICE_LABEL, quorumOf, type AttendanceRow, type AttendanceStatus, type GovMember, type Person,
} from "@/lib/government";
import { ErrorNote, useAction } from "./ui";

const STATUSES: AttendanceStatus[] = ["present", "late", "excused", "absent"];
const ACTIVE_STYLE: Record<AttendanceStatus, string> = {
  present: "border-success bg-success text-white",
  late: "border-warning bg-warning text-white",
  excused: "border-primary bg-primary text-primary-foreground",
  absent: "border-danger bg-danger text-white",
};

export function AttendancePanel({
  meetingId, expected, attendance, people, canRun,
}: { meetingId: string; expected: GovMember[]; attendance: AttendanceRow[]; people: Person[]; canRun: boolean }) {
  const names = new Map(people.map((p) => [p.id, p]));
  const byUser = new Map(attendance.map((a) => [a.user_id, a.status]));
  const { run, pending, error } = useAction();

  if (expected.length === 0) return <EmptyState>Nobody is expected at this meeting yet. Add members on the Members page.</EmptyState>;

  const here = expected.filter((m) => ["present", "late"].includes(byUser.get(m.user_id) ?? "")).length;
  const marked = expected.filter((m) => byUser.has(m.user_id)).length;
  const need = quorumOf(expected.length);
  const quorum = here >= need;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
        <div className="min-w-0 flex-1">
          <p className="text-2xl font-semibold tabular-nums">{here}<span className="text-base text-muted-foreground"> / {expected.length} here</span></p>
          <p className="text-xs text-muted-foreground">{marked} of {expected.length} marked · {need} needed for quorum</p>
        </div>
        {marked > 0 && <Badge variant={quorum ? "success" : "danger"}>{quorum ? "Quorum met" : `Short by ${need - here}`}</Badge>}
        {canRun && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => setAttendanceMany(meetingId, expected.map((m) => m.user_id), "present"))}>
              <CheckCheck className="h-4 w-4" /> Everyone present
            </Button>
            <Button size="sm" variant="ghost" disabled={pending || marked === 0} onClick={() => run(() => setAttendanceMany(meetingId, expected.map((m) => m.user_id), null))}>
              <Eraser className="h-4 w-4" /> Clear
            </Button>
          </div>
        )}
      </div>
      <ErrorNote message={error} />

      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {expected.map((m) => {
          const status = byUser.get(m.user_id);
          const person = names.get(m.user_id);
          return (
            <li key={m.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-4 sm:p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{person?.full_name || "Member"}</p>
                <p className="text-xs text-muted-foreground">{OFFICE_LABEL[m.office]}{m.grade_level ? ` · Grade ${m.grade_level}` : ""}</p>
              </div>
              {canRun ? (
                <div role="group" aria-label={`Attendance for ${person?.full_name ?? "member"}`} className="flex flex-wrap gap-1">
                  {STATUSES.map((s) => {
                    const on = status === s;
                    return (
                      <button key={s} type="button" aria-pressed={on} disabled={pending}
                        onClick={() => run(() => setAttendance(meetingId, m.user_id, on ? null : s))}
                        className={cn("rounded-md border px-2.5 py-1 text-xs font-medium transition-colors", on ? ACTIVE_STYLE[s] : "border-border bg-card text-muted-foreground hover:bg-muted")}>
                        {ATTENDANCE_LABEL[s]}
                      </button>
                    );
                  })}
                </div>
              ) : status ? <Badge variant={ATTENDANCE_VARIANT[status]}>{ATTENDANCE_LABEL[status]}</Badge> : <span className="text-xs text-muted-foreground">Not recorded</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
