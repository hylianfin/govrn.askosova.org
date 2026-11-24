import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/dashboard/primitives";
import { PollManager, type ManagedPoll } from "@/components/votes/poll-manager";
import { formatWhen, isoToWall } from "@/lib/datetime";
import { getElectionTimezone, getGovAccess } from "@/lib/queries/government";
import { getPolls, getSummaries, votesReady } from "@/lib/queries/votes";
import { nowIso } from "@/lib/votes";

export const dynamic = "force-dynamic";

export default async function StudentVotesPage() {
  const [access, ready, polls, { timezone }] = await Promise.all([getGovAccess(), votesReady(), getPolls(), getElectionTimezone()]);
  const summaries = await getSummaries(polls.filter((p) => p.status !== "draft").map((p) => p.id));

  const managed: ManagedPoll[] = polls.map((p) => {
    const close = isoToWall(p.closes_at, timezone);
    return {
      ...p,
      closesLabel: p.closes_at ? formatWhen(p.closes_at, null, timezone) : null,
      editPatch: {
        title: p.title, description: p.description ?? "", kind: p.kind, maxChoices: p.max_choices,
        options: p.options.map((o) => o.label), closeDate: close.date, closeTime: close.time || "15:00", showResults: p.show_results,
      },
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations"
        title="Student votes"
        description="Put a question to the whole school. Every student votes once from the Vote page and nobody can see who chose what."
      />
      {!ready ? (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p>Student votes are not set up in the database yet. Apply <code className="rounded bg-muted px-1 py-0.5 text-xs">0035_student_votes.sql</code> and reload this page.</p>
        </div>
      ) : (
        <PollManager polls={managed} summaries={summaries} canRun={!!access?.canRun} now={nowIso()} />
      )}
    </div>
  );
}
