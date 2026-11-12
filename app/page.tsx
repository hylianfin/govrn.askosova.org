import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PageHero } from "@/components/public/page-hero";
import { HomeBoard, type Race } from "@/components/public/home-board";
import { createClient } from "@/lib/supabase/server";
import { getConfig } from "@/lib/config-server";
import { getAnnouncements } from "@/lib/queries/elections";
import { ChevronDown, Megaphone } from "lucide-react";

export const dynamic = "force-dynamic";

// The public page: who is running, per race, in ballot order, and the votes live once counting has started.
export default async function HomePage() {
  const [supabase, config] = await Promise.all([createClient(), getConfig()]);
  const [{ data: candidates }, { data: results, error }, notices] = await Promise.all([supabase.rpc("public_candidates"), supabase.rpc("public_results"), getAnnouncements(true)]);

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <SiteHeader />
      <PageHero eyebrow={config.organizationName} title={!error && results?.status && results.status !== "not_started" ? "Election results" : "Who is running"} />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-10 px-4 py-12 sm:px-6">
        {notices.length > 0 && (
          <details open className="group" id="notices">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 border-b-2 border-navy pb-2 [&::-webkit-details-marker]:hidden">
              <h2 className="flex items-center gap-2 font-display text-2xl font-bold uppercase text-navy"><Megaphone className="h-5 w-5 text-danger" /> Announcements <span className="rounded-full bg-danger px-2 py-0.5 align-middle font-sans text-xs font-semibold text-white">{notices.length}</span></h2>
              <ChevronDown className="h-6 w-6 shrink-0 text-navy transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <ul className="mt-4 space-y-3">
              {notices.map((n: any) => (
                <li key={n.id} className="rounded-xl border border-border border-l-4 border-l-danger bg-card p-4">
                  <p className="font-display text-lg font-semibold uppercase leading-tight text-navy">{n.title}</p>
                  <p className="text-xs text-muted-foreground">{new Date(n.published_at || n.created_at).toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" })}</p>
                  <p className="mt-2 whitespace-pre-line text-sm">{n.body}</p>
                </li>
              ))}
            </ul>
          </details>
        )}
        <HomeBoard config={config} candidates={(candidates ?? []) as Race[]} results={error ? null : results} />
      </main>
      <SiteFooter />
    </div>
  );
}
