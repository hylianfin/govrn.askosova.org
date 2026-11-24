import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, ClipboardList, Landmark, ListChecks, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader, Section, StatTile } from "@/components/dashboard/primitives";
import { formatWhen, isoToWall } from "@/lib/datetime";
import {
  BODY_LABEL, MEETING_STATUS, MOTION_STATUS, OFFICE_LABEL, OFFICERS, addDays, dayLabel, todayIn, type GovMeeting,
} from "@/lib/government";
import {
  getActionItems, getAgendaCounts, getAllAttendance, getElectionTimezone, getGovAccess, getMeetings, getRecentMotions, getRoster,
} from "@/lib/queries/government";

export const dynamic = "force-dynamic";

type Todo = { key: string; text: string; href: string; tone: "danger" | "warning" | "info" };

export default async function GovernmentOverviewPage() {
  const [access, roster, meetings, actions, attendance, agendaCounts, motions, { timezone, title }] = await Promise.all([
    getGovAccess(), getRoster(), getMeetings(), getActionItems(), getAllAttendance(), getAgendaCounts(), getRecentMotions(5), getElectionTimezone(),
  ]);
  const me = access?.user.id ?? "";
  const canRun = !!access?.canRun;
  const today = todayIn(timezone);
  const soon = addDays(today, 7);
  const dayOf = (m: GovMeeting) => isoToWall(m.starts_at, timezone).date;

  const live = meetings.filter((m) => m.status === "scheduled" || m.status === "in_progress").sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const next = live[0];
  const held = meetings.filter((m) => m.status === "completed").length;
  const senators = roster.filter((m) => m.office.endsWith("senator")).length;
  const filled = OFFICERS.filter((o) => roster.some((m) => m.office === o));
  const open = actions.filter((a) => !a.done);
  const overdue = open.filter((a) => a.due_on && a.due_on < today);
  const mine = open.filter((a) => a.assignee_id === me);
  const hasAttendance = new Set(attendance.map((a) => a.meeting_id));
  const titles = new Map(meetings.map((m) => [m.id, m.title]));

  // What the secretary should do next, worked out from the records.
  const todos: Todo[] = [];
  for (const m of live) {
    const d = dayOf(m);
    if (m.status === "scheduled" && d < today) todos.push({ key: `late-${m.id}`, tone: "danger", text: `"${m.title}" was due on ${dayLabel(d)} and never started. Start it, reschedule it or cancel it.`, href: `/government/meetings/${m.id}` });
    else if (m.status === "scheduled" && d <= soon && !agendaCounts.get(m.id)) todos.push({ key: `agenda-${m.id}`, tone: "warning", text: `Draft the agenda for "${m.title}" (${dayLabel(d)}).`, href: `/government/meetings/${m.id}` });
    if (m.status === "in_progress" && !hasAttendance.has(m.id)) todos.push({ key: `att-${m.id}`, tone: "info", text: `Take attendance for "${m.title}", which is in session.`, href: `/government/meetings/${m.id}` });
  }
  for (const m of meetings.filter((x) => x.status === "completed")) {
    if (!hasAttendance.has(m.id)) todos.push({ key: `att-${m.id}`, tone: "warning", text: `No attendance was recorded for "${m.title}".`, href: `/government/meetings/${m.id}` });
    if (m.minutes_status === "none") todos.push({ key: `min-${m.id}`, tone: "warning", text: `Write the minutes for "${m.title}".`, href: `/government/meetings/${m.id}` });
    if (m.minutes_status === "draft") todos.push({ key: `app-${m.id}`, tone: "info", text: `Get the minutes for "${m.title}" approved.`, href: `/government/meetings/${m.id}` });
  }
  if (overdue.length) todos.push({ key: "overdue", tone: "danger", text: `${overdue.length} action item${overdue.length === 1 ? " is" : "s are"} overdue.`, href: "/government/actions" });
  for (const o of OFFICERS) if (!filled.includes(o)) todos.push({ key: `vacant-${o}`, tone: "info", text: `The ${OFFICE_LABEL[o]} seat is vacant.`, href: "/government/members" });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Government console"
        title="Student government"
        description={title ? `${title}: meetings, members and the secretary's records.` : "Meetings, members and the secretary's records."}
        actions={canRun ? <Button asChild><Link href="/government/meetings">Schedule a meeting</Link></Button> : undefined}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Members" value={roster.length} hint={`${senators} senators · ${filled.length} of ${OFFICERS.length} offices filled`} icon={<Users className="h-5 w-5" />} href="/government/members" />
        <StatTile label="Next meeting" value={next ? dayLabel(dayOf(next)) : "None"} hint={next?.title ?? "Nothing scheduled"} icon={<CalendarDays className="h-5 w-5" />} href={next ? `/government/meetings/${next.id}` : "/government/meetings"} />
        <StatTile label="Meetings held" value={held} hint={`${live.length} coming up`} icon={<Landmark className="h-5 w-5" />} href="/government/meetings" />
        <StatTile label="Open action items" value={open.length} hint={overdue.length ? `${overdue.length} overdue` : "None overdue"} tone={overdue.length ? "danger" : "default"} icon={<ListChecks className="h-5 w-5" />} href="/government/actions" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Section title="Next meeting" action={next && <Badge variant={MEETING_STATUS[next.status].variant}>{MEETING_STATUS[next.status].label}</Badge>}>
            {next ? (
              <div className="space-y-3">
                <div>
                  <p className="text-lg font-semibold">{next.title}</p>
                  <p className="text-sm text-muted-foreground">{BODY_LABEL[next.body]} · {formatWhen(next.starts_at, next.ends_at, timezone)}{next.location ? ` · ${next.location}` : ""}</p>
                </div>
                <p className="text-sm text-muted-foreground">{agendaCounts.get(next.id) ?? 0} agenda items</p>
                <Button asChild variant="outline"><Link href={`/government/meetings/${next.id}`}>Open meeting <ArrowRight className="h-4 w-4" /></Link></Button>
              </div>
            ) : <EmptyState>No meetings are scheduled.</EmptyState>}
          </Section>

          <Section title="Recent decisions" description="The last motions that went to a vote.">
            {motions.length === 0 ? <EmptyState>No votes have been recorded yet.</EmptyState> : (
              <ul className="divide-y divide-border">
                {motions.map((m) => (
                  <li key={m.id}>
                    <Link href={`/government/meetings/${m.meeting_id}`} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0 hover:text-primary">
                      <Badge variant={MOTION_STATUS[m.status].variant}>{MOTION_STATUS[m.status].label}</Badge>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{m.text}</p>
                        <p className="text-xs text-muted-foreground">{m.votes_yes} yes · {m.votes_no} no · {m.votes_abstain} abstain · {titles.get(m.meeting_id) ?? "Meeting"}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <div className="space-y-6">
          {canRun && (
            <Section title="Secretary desk" description="What needs doing, worked out from the records.">
              {todos.length === 0 ? (
                <p className="flex items-center gap-2 text-sm text-success"><CheckCircle2 className="h-4 w-4" /> Nothing is waiting. The records are up to date.</p>
              ) : (
                <ul className="space-y-2">
                  {todos.map((t) => (
                    <li key={t.key}>
                      <Link href={t.href} className="flex items-start gap-2 rounded-lg border border-border p-3 text-sm transition-colors hover:bg-muted/60">
                        {t.tone === "danger" ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" /> : <ClipboardList className={`mt-0.5 h-4 w-4 shrink-0 ${t.tone === "warning" ? "text-warning" : "text-primary"}`} />}
                        <span>{t.text}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          )}

          <Section title="Assigned to you" action={<Link href="/government/actions" className="text-sm font-medium text-primary hover:underline">All items</Link>}>
            {mine.length === 0 ? <EmptyState>Nothing is assigned to you.</EmptyState> : (
              <ul className="space-y-2">
                {mine.map((a) => (
                  <li key={a.id} className="rounded-lg border border-border p-3 text-sm">
                    <p className="font-medium">{a.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.due_on ? `Due ${dayLabel(a.due_on)}` : "No due date"}{a.due_on && a.due_on < today ? " · overdue" : ""}
                      {a.meeting_id && titles.get(a.meeting_id) ? ` · ${titles.get(a.meeting_id)}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
