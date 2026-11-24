import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader, Section } from "@/components/dashboard/primitives";
import { RosterManager } from "@/components/government/roster-manager";
import { OFFICE_DUTY, OFFICE_LABEL, OFFICERS, nameOf, type GovMember } from "@/lib/government";
import { getAllAttendance, getGovAccess, getMeetings, getPeople, getRoster } from "@/lib/queries/government";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const [access, roster, people, meetings, attendance] = await Promise.all([getGovAccess(), getRoster(), getPeople(), getMeetings(), getAllAttendance()]);

  // Attendance rate over the meetings that were actually held.
  const held = new Set(meetings.filter((m) => m.status === "completed").map((m) => m.id));
  const rate = (userId: string) => {
    const rows = attendance.filter((a) => a.user_id === userId && held.has(a.meeting_id));
    if (rows.length === 0) return null;
    return Math.round((rows.filter((a) => a.status === "present" || a.status === "late").length / rows.length) * 100);
  };

  const senators = roster.filter((m) => m.office.endsWith("senator"))
    .sort((a, b) => (a.grade_level ?? 99) - (b.grade_level ?? 99) || nameOf(people, a.user_id).localeCompare(nameOf(people, b.user_id)));
  const seatRows = roster.map((m) => ({ id: m.id, name: nameOf(people, m.user_id), office: m.office, grade: m.grade_level }));

  const rateCell = (m: GovMember) => {
    const r = rate(m.user_id);
    return r === null ? <span className="text-muted-foreground">No meetings yet</span> : <Badge variant={r >= 80 ? "success" : r >= 50 ? "warning" : "danger"}>{r}% attendance</Badge>;
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Operations" title="Members" description="The executive team and the senators who make up student government." />

      <Section title="Executive team">
        <ul className="grid gap-3 sm:grid-cols-2">
          {OFFICERS.map((o) => {
            const holder = roster.find((m) => m.office === o);
            return (
              <li key={o} className="space-y-1.5 rounded-lg border border-border p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{OFFICE_LABEL[o]}</p>
                  {holder ? rateCell(holder) : <Badge variant="warning">Vacant</Badge>}
                </div>
                <p className="text-lg font-semibold">{holder ? nameOf(people, holder.user_id) : "Nobody yet"}</p>
                <p className="text-sm text-muted-foreground">{OFFICE_DUTY[o]}</p>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title="Senate" description={`${senators.length} senator${senators.length === 1 ? "" : "s"}, by grade.`}>
        {senators.length === 0 ? <EmptyState>No senators have been seated yet.</EmptyState> : (
          <div className="-m-5 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-muted-foreground">
                <tr><th className="px-5 py-2.5 font-medium">Senator</th><th className="px-5 py-2.5 font-medium">Grade</th><th className="px-5 py-2.5 font-medium">Attendance</th></tr>
              </thead>
              <tbody>
                {senators.map((m) => (
                  <tr key={m.id} className="border-b border-border last:border-0">
                    <td className="px-5 py-3 font-medium">{nameOf(people, m.user_id)}</td>
                    <td className="px-5 py-3 tabular-nums">{m.grade_level ?? "—"}</td>
                    <td className="px-5 py-3">{rateCell(m)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {access?.admin && (
        <Section title="Manage seats" description="Only administrators seat or remove members. People with a seat see the Government console; the Secretary can run meetings and records.">
          <RosterManager seats={seatRows} />
        </Section>
      )}
    </div>
  );
}
