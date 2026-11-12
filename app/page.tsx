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
            {r.kind === "exec" ? (
              <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="bg-navy font-display text-xs uppercase tracking-wider text-white">
                    <tr>
                      <th className="px-4 py-3 w-14">No.</th><th className="px-4 py-3">Team</th>
                      {Object.values(ROLE).map((x) => <th key={x} className="px-4 py-3">{x}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {r.candidates.map((c) => (
                      <tr key={c.num}>
                        <td className="px-4 py-3 font-display text-xl font-bold text-danger">{c.num}</td>
                        <td className="px-4 py-3 font-display text-base font-semibold uppercase text-navy">{c.label}</td>
                        {Object.keys(ROLE).map((k) => <td key={k} className="px-4 py-3">{c.members.find((m) => m.role === k)?.name ?? ""}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
                <table className="w-full text-left text-sm">
                  <thead className="bg-navy font-display text-xs uppercase tracking-wider text-white">
                    <tr><th className="px-4 py-3 w-14">No.</th><th className="px-4 py-3">Name</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {r.candidates.map((c) => (
                      <tr key={c.num}>
                        <td className="px-4 py-2.5 font-display text-lg font-bold text-danger">{c.num}</td>
                        <td className="px-4 py-2.5 font-medium">{c.label}{c.sub ? <span className="ml-2 text-muted-foreground">{c.sub}</span> : null}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))}
      </main>
      <SiteFooter />
    </div>
  );
}
