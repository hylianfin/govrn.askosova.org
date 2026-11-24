import Link from "next/link";
import { CalendarDays, ChevronRight, ListChecks, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader, Section } from "@/components/dashboard/primitives";
import { NewMeeting } from "@/components/government/meeting-form";
import { formatWhen } from "@/lib/datetime";
import { BODY_LABEL, MEETING_STATUS, MINUTES_STATUS, type GovMeeting } from "@/lib/government";
import { getAgendaCounts, getElectionTimezone, getGovAccess, getMeetings } from "@/lib/queries/government";

export const dynamic = "force-dynamic";

export default async function MeetingsPage() {
  const [access, meetings, agendaCounts, { timezone }] = await Promise.all([getGovAccess(), getMeetings(), getAgendaCounts(), getElectionTimezone()]);
  const live = (m: GovMeeting) => m.status === "scheduled" || m.status === "in_progress";
  const upcoming = meetings.filter(live).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const past = meetings.filter((m) => !live(m));

  const row = (m: GovMeeting) => (
    <li key={m.id}>
      <Link href={`/government/meetings/${m.id}`} className="flex items-center gap-3 p-4 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{m.title}</p>
            <Badge variant={MEETING_STATUS[m.status].variant}>{MEETING_STATUS[m.status].label}</Badge>
            {m.status === "completed" && <Badge variant={MINUTES_STATUS[m.minutes_status].variant}>{MINUTES_STATUS[m.minutes_status].label}</Badge>}
          </div>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {formatWhen(m.starts_at, m.ends_at, timezone)}</span>
            {m.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {m.location}</span>}
            <span>{BODY_LABEL[m.body]}</span>
            <span className="inline-flex items-center gap-1"><ListChecks className="h-3.5 w-3.5" /> {agendaCounts.get(m.id) ?? 0} agenda items</span>
          </p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Link>
    </li>
  );

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Operations" title="Meetings" description="Senate, executive team and joint sessions: agenda, attendance, motions, minutes." />
      {access?.canRun && <NewMeeting />}
      <Section title="Upcoming" description="Scheduled and in session.">
        {upcoming.length === 0
          ? <EmptyState>No meetings are scheduled.{access?.canRun ? " Schedule the next one above." : ""}</EmptyState>
          : <ul className="-m-5 divide-y divide-border">{upcoming.map(row)}</ul>}
      </Section>
      <Section title="Past meetings" description="Completed and cancelled, newest first.">
        {past.length === 0 ? <EmptyState>Nothing here yet.</EmptyState> : <ul className="-m-5 divide-y divide-border">{past.map(row)}</ul>}
      </Section>
    </div>
  );
}
