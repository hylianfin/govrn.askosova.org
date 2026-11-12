import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PageHero } from "@/components/public/page-hero";
import { HomeBoard, type Race } from "@/components/public/home-board";
import { createClient } from "@/lib/supabase/server";
import { getConfig } from "@/lib/config-server";

export const dynamic = "force-dynamic";

// The public page: who is running, per race, in ballot order, and the votes live once counting has started.
export default async function HomePage() {
  const [supabase, config] = await Promise.all([createClient(), getConfig()]);
  const [{ data: candidates }, { data: results, error }] = await Promise.all([supabase.rpc("public_candidates"), supabase.rpc("public_results")]);

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <SiteHeader />
      <PageHero eyebrow={config.organizationName} title={!error && results?.status && results.status !== "not_started" ? "Election results" : "Who is running"} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12 sm:px-6">
        <HomeBoard config={config} candidates={(candidates ?? []) as Race[]} results={error ? null : results} />
      </main>
      <SiteFooter />
    </div>
  );
}
