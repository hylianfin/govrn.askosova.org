import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PageHero } from "@/components/public/page-hero";
import { getCurrentElection, getElectionEvents } from "@/lib/queries/elections";
import { formatWhen, validTimezone } from "@/lib/datetime";
import { cn } from "@/lib/cn";

export default async function ElectionTimelinePage() {
  const election = await getCurrentElection();
  const events = election ? await getElectionEvents(election.id) : [];
  const tz = validTimezone(election?.timezone) ? election!.timezone : "UTC";
  const now = Date.now();
  const nextId = events.find((e: any) => e.start_at && new Date(e.start_at).getTime() > now)?.id;
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <SiteHeader />
      <PageHero eyebrow="Campaign calendar" title="Election Timeline">
        Every milestone of the current election cycle, from first application to results.
      </PageHero>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6">
        <ol className="relative space-y-4 border-l-4 border-navy pl-8">
          {events.map((e: any, i: number) => {
            const past = e.end_at ? new Date(e.end_at).getTime() < now : e.start_at ? new Date(e.start_at).getTime() < now : false;
            const next = e.id === nextId;
            return (
              <li key={e.id} className="relative">
                <span className={cn(
                  "absolute -left-[3.05rem] top-3 flex h-9 w-9 items-center justify-center rounded-full border-4 border-paper font-display text-sm font-bold text-white",
                  next ? "bg-danger" : past ? "bg-primary" : "bg-navy/40",
                )}>{i + 1}</span>
                <div className={cn("rounded-xl border-2 bg-card p-5", next ? "border-danger shadow-[4px_4px_0_0_var(--danger)]" : "border-border")}>
                  {next && <span className="mb-2 inline-block rounded-full bg-danger px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white">Up next</span>}
                  <p className="font-display text-xl font-bold uppercase text-navy">{e.title}</p>
                  {e.description && <p className="mt-1 text-sm text-muted-foreground">{e.description}</p>}
                  <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-primary">
                    {formatWhen(e.start_at, e.end_at, tz)}
                    {e.location ? ` · ${e.location}` : ""}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
        {events.length === 0 && <p className="text-sm text-muted-foreground">Timeline not configured.</p>}
      </main>
      <SiteFooter />
    </div>
  );
}
