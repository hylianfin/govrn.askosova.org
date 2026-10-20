import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getCurrentElection, getElectionEvents } from "@/lib/queries/elections";
import { formatWhen, validTimezone } from "@/lib/datetime";

export default async function ElectionTimelinePage() {
  const election = await getCurrentElection();
  const events = election ? await getElectionEvents(election.id) : [];
  const tz = validTimezone(election?.timezone) ? election!.timezone : "UTC";
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto max-w-4xl flex-1 px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-bold text-primary">Election Timeline</h1>
        <p className="mt-2 text-muted-foreground">Milestones for the current election cycle.</p>
        <ol className="mt-8 space-y-3">
          {events.map((e: any) => (
            <li key={e.id} className="rounded-lg border border-border bg-card p-4">
              <p className="font-medium">{e.title}</p>
              <p className="text-sm text-muted-foreground">{e.description}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatWhen(e.start_at, e.end_at, tz)}
                {e.location ? ` · ${e.location}` : ""}
              </p>
            </li>
          ))}
          {events.length === 0 && <p className="text-sm text-muted-foreground">Timeline not configured.</p>}
        </ol>
      </main>
      <SiteFooter />
    </div>
  );
}