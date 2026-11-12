import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PageHero } from "@/components/public/page-hero";
import { createClient } from "@/lib/supabase/server";
import { getConfig } from "@/lib/config-server";
import { raceLabel } from "@/lib/config";

export const dynamic = "force-dynamic";

type Entry = { num: number; label: string; sub: string | null; members: { role: string; name: string }[] };
type Race = { race: string; school: string; schoolLabel: string; kind: "exec" | "senate"; candidates: Entry[] };

const ROLE: Record<string, string> = { president: "President", vice_president: "Vice President", secretary: "Secretary", treasurer: "Treasurer" };

// The public page: just who is running, per race, in ballot order.
export default async function HomePage() {
  const [supabase, config] = await Promise.all([createClient(), getConfig()]);
  const { data } = await supabase.rpc("public_candidates");
  const races = (data ?? []) as Race[];

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <SiteHeader />
      <PageHero eyebrow={config.organizationName} title="Who is running" />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-10 px-4 py-12 sm:px-6">
        {races.length === 0 && <p className="text-muted-foreground">The candidates will be listed here soon.</p>}
        {races.map((r) => (
          <section key={r.race}>
            <h2 className="border-b-2 border-navy pb-2 font-display text-2xl font-bold uppercase text-navy">{raceLabel(config, r.race)}</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {r.candidates.map((c) => (
                <li key={c.num} className="flex gap-4 rounded-xl border border-border bg-card p-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy font-display text-lg font-bold text-white">{c.num}</span>
                  <div className="min-w-0">
                    <p className="font-display text-lg font-semibold uppercase leading-tight text-navy">{c.label}</p>
                    {c.members.length > 0
                      ? <ul className="mt-1 space-y-0.5 text-sm text-muted-foreground">{c.members.map((m) => <li key={m.role}>{ROLE[m.role] ?? m.role}: <span className="font-medium text-foreground">{m.name}</span></li>)}</ul>
                      : c.sub && <p className="mt-0.5 text-sm text-muted-foreground">{c.sub}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>
      <SiteFooter />
    </div>
  );
}
