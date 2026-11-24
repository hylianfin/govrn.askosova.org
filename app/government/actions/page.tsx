import { PageHeader } from "@/components/dashboard/primitives";
import { ActionItems } from "@/components/government/action-items";
import { todayIn, type Person } from "@/lib/government";
import { getActionItems, getElectionTimezone, getGovAccess, getMeetings, getPeople, getRoster } from "@/lib/queries/government";

export const dynamic = "force-dynamic";

export default async function ActionItemsPage() {
  const [access, items, roster, people, meetings, { timezone }] = await Promise.all([
    getGovAccess(), getActionItems(), getRoster(), getPeople(), getMeetings(), getElectionTimezone(),
  ]);
  const assignees = roster.map((m) => people.get(m.user_id)).filter((p): p is Person => !!p);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Operations" title="Action items" description="What government members agreed to do, who owns it and when it is due." />
      <ActionItems
        items={items}
        people={[...people.values()]}
        assignees={assignees}
        canRun={!!access?.canRun}
        today={todayIn(timezone)}
        meetingTitles={Object.fromEntries(meetings.map((m) => [m.id, m.title]))}
        currentUserId={access?.user.id}
      />
    </div>
  );
}
