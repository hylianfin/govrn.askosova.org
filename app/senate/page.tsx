import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PageHero } from "@/components/public/page-hero";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

export default function SenatePage() {
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <SiteHeader />
      <PageHero eyebrow="Run solo" title="Student Senate">
        Apply individually to represent your class and contribute to school decisions.
      </PageHero>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12 sm:px-6">
        <div className="grid gap-6 md:grid-cols-[1.2fr_1fr]">
          <section className="rounded-xl border-2 border-navy bg-card p-6 shadow-[4px_4px_0_0_var(--navy)]">
            <h2 className="font-display text-2xl font-bold uppercase text-navy">Who can run</h2>
            <ul className="mt-4 space-y-3 text-sm">
              {[
                "No suspensions during the current academic year.",
                "No filed detentions during the current academic year.",
                "Attendance and community-service rules apply (see admin-configured rules).",
              ].map((t) => (
                <li key={t} className="flex gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />{t}</li>
              ))}
            </ul>
          </section>
          <section className="flex flex-col rounded-xl bg-danger p-6 text-white">
            <h2 className="font-display text-2xl font-bold uppercase">Throw your hat in</h2>
            <p className="mt-2 flex-1 text-white/85">Complete the Senate application form and submit before the deadline. Drafts are saved automatically.</p>
            <Button asChild className="mt-5 bg-white font-display uppercase tracking-wider text-danger hover:bg-white/90">
              <Link href="/dashboard/applications/senate">Start an application</Link>
            </Button>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
