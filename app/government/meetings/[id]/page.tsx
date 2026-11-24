import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/primitives";
import { MeetingWorkspace } from "@/components/government/meeting-workspace";
import { formatWhen, isoToWall } from "@/lib/datetime";
import { BODY_LABEL, membersFor, todayIn, type Person } from "@/lib/government";
import { draftMinutes } from "@/lib/minutes";
import { getElectionTimezone, getGovAccess, getMeetingBundle, getPeople, getRoster } from "@/lib/queries/government";

export const dynamic = "force-dynamic";

export default async function MeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  const [access, bundle, roster, people, { timezone }] = await Promise.all([
    getGovAccess(), getMeetingBundle(id), getRoster(), getPeople(), getElectionTimezone(),
  ]);
  if (!access || !bundle) notFound();

  const { meeting } = bundle;
  const expected = membersFor(meeting.body, roster);
  const person = (userId: string) => people.get(userId);
  const toPeople = (userIds: string[]) => userIds.map(person).filter((p): p is Person => !!p);
  const start = isoToWall(meeting.starts_at, timezone);
  const end = isoToWall(meeting.ends_at, timezone);
  const planned = meeting.ends_at ? Math.round((new Date(meeting.ends_at).getTime() - new Date(meeting.starts_at).getTime()) / 60000) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={BODY_LABEL[meeting.body]}
        title={meeting.title}
        actions={<Button asChild variant="outline"><Link href="/government/meetings"><ArrowLeft className="h-4 w-4" /> All meetings</Link></Button>}
      />
      <MeetingWorkspace
        meeting={meeting}
        whenLabel={formatWhen(meeting.starts_at, meeting.ends_at, timezone)}
        approvedLabel={meeting.minutes_approved_at ? formatWhen(meeting.minutes_approved_at, null, timezone) : null}
        editPatch={{ title: meeting.title, body: meeting.body, date: start.date, startTime: start.time, endTime: end.time, location: meeting.location ?? "" }}
        plannedMinutes={planned && planned > 0 ? planned : null}
        agenda={bundle.agenda}
        attendance={bundle.attendance}
        motions={bundle.motions}
        actions={bundle.actions}
        people={[...people.values()]}
        expected={expected}
        voters={toPeople(expected.map((m) => m.user_id))}
        assignees={toPeople(roster.map((m) => m.user_id))}
        today={todayIn(timezone)}
        draft={draftMinutes({
          meeting, timezone, expected, attendance: bundle.attendance, agenda: bundle.agenda,
          motions: bundle.motions, actions: bundle.actions, people: [...people.values()],
        })}
        canRun={access.canRun}
        canMakeMotions={access.canSee}
        admin={access.admin}
        currentUserId={access.user.id}
      />
    </div>
  );
}
