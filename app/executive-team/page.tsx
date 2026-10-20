import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto max-w-4xl flex-1 px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-bold text-primary">Executive Team</h1>
        <p className="mt-2 text-muted-foreground">
          Executive candidates apply as a team of four: President, Vice President, Secretary, and Treasurer.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Eligibility</CardTitle></CardHeader>
            <CardContent className="text-sm">
              <ul className="list-disc space-y-1 pl-5">
                {(rules ?? []).map((r: any) => (
                  <li key={r.id}>
                    {r.label}
                    {r.description ? <span className="block text-xs text-muted-foreground">{r.description}</span> : null}
                  </li>
                ))}
                {(rules ?? []).length === 0 && <li className="list-none text-muted-foreground">Eligibility rules not configured.</li>}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Workflow</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <ol className="list-decimal space-y-1 pl-5 text-sm">
                {events.map((e: any) => (
                  <li key={e.id}>
                    {e.title}
                    {e.start_at ? (
                      <span className="block text-xs text-muted-foreground">
                        {formatDay(e.start_at, tz)}
                        {e.end_at && formatDay(e.end_at, tz) !== formatDay(e.start_at, tz) ? ` – ${formatDay(e.end_at, tz)}` : ""}
                      </span>
                    ) : null}
                  </li>
                ))}
                {events.length === 0 && <li className="list-none text-muted-foreground">Timeline not configured.</li>}
              </ol>
              <Button asChild className="mt-1"><Link href="/dashboard/applications/executive-team">Start an application</Link></Button>
            </CardContent>
          </Card>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
