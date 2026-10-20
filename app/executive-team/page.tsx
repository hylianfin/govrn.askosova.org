import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PageHero } from "@/components/public/page-hero";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentElection, getElectionEvents } from "@/lib/queries/elections";
import { formatDay, validTimezone } from "@/lib/datetime";

export default async function ExecutiveTeamPage() {
  const supabase = await createClient();
  const [election, { data: rules }] = await Promise.all([
    getCurrentElection(),
    supabase.from("eligibility_rules").select("*").eq("scope", "executive").eq("is_active", true).order("display_order"),
  ]);

  const events = election ? await getElectionEvents(election.id) : [];
  const tz = validTimezone(election?.timezone) ? election!.timezone : "UTC";

  const seats = ["President", "Vice President", "Secretary", "Treasurer"];

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <SiteHeader />
      <PageHero eyebrow="Run as a ticket" title="Executive Team">
        Executive candidates apply as a team of four. Recruit your running mates and make your case.
      </PageHero>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12 sm:px-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {seats.map((s, i) => (
            <div key={s} className="rounded-xl bg-navy p-4 text-white">
              <span className="font-display text-3xl font-bold text-danger">0{i + 1}</span>
              <p className="font-display text-lg font-semibold uppercase">{s}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <section className="rounded-xl border-2 border-navy bg-card p-6 shadow-[4px_4px_0_0_var(--navy)]">
            <h2 className="font-display text-2xl font-bold uppercase text-navy">Eligibility</h2>
            <ul className="mt-4 space-y-3 text-sm">
              {(rules ?? []).map((r: any) => (
                <li key={r.id} className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <span>
                    {r.label}
                    {r.description ? <span className="block text-xs text-muted-foreground">{r.description}</span> : null}
                  </span>
                </li>
              ))}
              {(rules ?? []).length === 0 && <li className="text-muted-foreground">Eligibility rules not configured.</li>}
            </ul>
          </section>
          <section className="rounded-xl border-2 border-border bg-card p-6">
            <h2 className="font-display text-2xl font-bold uppercase text-navy">Workflow</h2>
            <ol className="mt-4 space-y-3 text-sm">
              {events.map((e: any, i: number) => (
                <li key={e.id} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary font-display text-xs font-bold text-white">{i + 1}</span>
                  <span>
                    {e.title}
                    {e.start_at ? (
                      <span className="block text-xs text-muted-foreground">
                        {formatDay(e.start_at, tz)}
                        {e.end_at && formatDay(e.end_at, tz) !== formatDay(e.start_at, tz) ? ` – ${formatDay(e.end_at, tz)}` : ""}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
              {events.length === 0 && <li className="text-muted-foreground">Timeline not configured.</li>}
            </ol>
            <Button asChild className="mt-6 bg-danger font-display uppercase tracking-wider hover:bg-danger/90">
              <Link href="/dashboard/applications/executive-team">Start an application</Link>
            </Button>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
