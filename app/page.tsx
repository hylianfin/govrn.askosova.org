import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { Countdown } from "@/components/public/countdown";
import { SectionHeading } from "@/components/public/page-hero";
import { StageTracker } from "@/components/public/stage-tracker";
import { getCurrentElection, getElectionEvents, getAnnouncements } from "@/lib/queries/elections";
import { getConfig } from "@/lib/config-server";
import { formatWhen, validTimezone } from "@/lib/datetime";
import { STAGE_LABELS } from "@/lib/types";
import { ArrowRight, Megaphone, ShieldCheck, Vote, Users, Trophy, Mic2, CalendarDays } from "lucide-react";

function formatDate(d: string | null) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-GB", { dateStyle: "medium" });
}

const ticker = [
  "One school. One vote.",
  "4 executive seats",
  "10 senate seats",
  "Staff-verified eligibility",
  "Paper ballots on Election Day",
  "Your voice. Your school.",
];

const execSeats = [
  { title: "President", desc: "Leads the team and represents the whole student body." },
  { title: "Vice President", desc: "Backs the President and coordinates initiatives." },
  { title: "Secretary", desc: "Keeps records, communication and meeting minutes." },
  { title: "Treasurer", desc: "Owns the budget and financial planning." },
];

const steps = [
  { icon: Users, tag: "Step 1", title: "Apply", desc: "Run solo for the Senate or as a four-member Executive Team. Save drafts and submit before the deadline." },
  { icon: ShieldCheck, tag: "Step 2", title: "Get verified", desc: "Staff review behavior, grades and attendance. Nobody is declared eligible automatically." },
  { icon: Megaphone, tag: "Step 3", title: "Campaign", desc: "Approved teams prepare posters, videos and speeches. Staff review everything before it goes public." },
  { icon: Mic2, tag: "Step 4", title: "Debate", desc: "Present your platform, answer questions, then observe election silence." },
  { icon: Vote, tag: "Step 5", title: "Election Day", desc: "Students vote on paper ballots. Results are published once counted." },
];

export default async function HomePage() {
  const config = await getConfig();
  const election = await getCurrentElection();
  const events = election ? await getElectionEvents(election.id) : [];
  const announcements = await getAnnouncements(true);

  const tz = validTimezone(election?.timezone) ? election!.timezone : "UTC";
  const now = Date.now();
  const upcoming = events.filter((e: any) => e.start_at && new Date(e.start_at).getTime() > now);
  const next: any = upcoming[0];
  const stage = election?.current_stage;

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <SiteHeader />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden bg-navy text-white">
          <div className="absolute inset-0 bg-stripes" />
          <div className="absolute inset-0 bg-stars" />
          <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-primary blur-3xl opacity-60" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 font-display text-xs font-semibold uppercase tracking-[0.2em]">
                <span className="h-2 w-2 rounded-full bg-danger animate-pulse-ring" />
                {election?.title ?? `${config.organizationName} ${config.tagline}`}
                {election?.academic_year ? ` · ${election.academic_year}` : ""}
              </p>
              <h1 className="mt-6 font-display text-6xl font-bold uppercase leading-[0.9] tracking-tight sm:text-8xl">
                Your vote.
                <span className="block text-danger">Your voice.</span>
                <span className="block">Your school.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg text-white/75">
                The {config.organizationName} {config.tagline.toLowerCase()} is decided by students. Step up, run for a seat, and make the case for your class.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg" className="h-12 bg-danger px-7 font-display text-base uppercase tracking-wider hover:bg-danger/90">
                  <Link href="/dashboard/applications">Run for office <ArrowRight className="h-4 w-4" /></Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-12 border-white/40 bg-transparent px-7 font-display text-base uppercase tracking-wider text-white hover:bg-white/10 hover:text-white">
                  <Link href="/election-timeline">See the timeline</Link>
                </Button>
              </div>
            </div>

            {/* Ballot */}
            <div className="relative mx-auto w-full max-w-md rotate-1 rounded-xl bg-white p-1.5 text-navy shadow-2xl lg:rotate-2">
              <div className="rounded-lg border-2 border-dashed border-navy/25 p-6">
                <div className="flex items-center justify-between border-b-2 border-navy pb-3">
                  <span className="font-display text-xl font-bold uppercase tracking-wide">Official Ballot</span>
                  <Vote className="h-6 w-6 text-danger" />
                </div>
                <div className="mt-4 space-y-2.5">
                  {["President", "Vice President", "Secretary", "Treasurer"].map((p) => (
                    <div key={p} className="flex items-center gap-3 rounded-md border border-navy/15 px-3 py-2">
                      <span className="h-5 w-5 rounded-full border-2 border-navy/40" />
                      <span className="font-display text-sm font-semibold uppercase tracking-wide">{p}</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-3 rounded-md border border-navy/15 px-3 py-2">
                    <span className="h-5 w-5 rounded-full border-2 border-navy/40" />
                    <span className="font-display text-sm font-semibold uppercase tracking-wide">Student Senate</span>
                  </div>
                </div>
                <div className="mt-5 rounded-lg bg-muted p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-danger">
                    {stage ? `Now: ${STAGE_LABELS[stage as keyof typeof STAGE_LABELS] ?? stage}` : "Election status"}
                  </p>
                  {next ? (
                    <>
                      <p className="mt-1 text-sm font-semibold">Next: {next.title}</p>
                      <p className="mb-3 text-xs text-muted-foreground">{formatWhen(next.start_at, null, tz)}</p>
                      <Countdown to={next.start_at} />
                    </>
                  ) : (
                    <p className="mt-1 text-sm text-muted-foreground">Dates will be announced soon.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Ticker */}
        <div className="overflow-hidden bg-danger py-3 text-white" aria-hidden>
          <div className="flex w-max animate-ticker whitespace-nowrap">
            {[...ticker, ...ticker, ...ticker, ...ticker].map((t, i) => (
              <span key={i} className="flex items-center font-display text-sm font-semibold uppercase tracking-[0.25em]">
                <span className="px-6">{t}</span>
                <span className="text-white/50">★</span>
              </span>
            ))}
          </div>
        </div>

        {/* Road to election day */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <SectionHeading eyebrow="Campaign tracker" title="The road to Election Day">
            Eight stages from first application to final result. The red card is where we are right now.
          </SectionHeading>
          <div className="mt-8"><StageTracker stage={stage} /></div>
          {upcoming.length > 0 && (
            <div className="mt-8 grid gap-3 md:grid-cols-3">
              {upcoming.slice(0, 3).map((e: any, i: number) => (
                <div key={e.id} className="flex gap-3 rounded-lg border border-border bg-card p-4">
                  <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{i === 0 ? "Up next" : "Coming up"}</p>
                    <p className="font-semibold text-navy">{e.title}</p>
                    <p className="text-sm text-muted-foreground">{formatWhen(e.start_at, e.end_at, tz)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* The race */}
        <section className="bg-navy text-white">
          <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6">
            <SectionHeading light eyebrow="The race" title="Pick your seat">
              Two ways to compete. Go big with a full ticket, or take on a Senate seat for your class.
            </SectionHeading>
            <div className="mt-10 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
              <div className="rounded-2xl bg-white p-6 text-navy">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-2xl font-bold uppercase">Executive Team</h3>
                  <span className="rounded-full bg-primary px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">Ticket of 4</span>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {execSeats.map((s, i) => (
                    <div key={s.title} className="rounded-lg border-2 border-border p-4 transition-colors hover:border-primary">
                      <span className="font-display text-3xl font-bold text-danger">0{i + 1}</span>
                      <p className="font-display text-lg font-semibold uppercase">{s.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
                    </div>
                  ))}
                </div>
                <Button asChild className="mt-6 bg-primary font-display uppercase tracking-wider">
                  <Link href="/executive-team">Build your ticket <ArrowRight className="h-4 w-4" /></Link>
                </Button>
              </div>
              <div className="flex flex-col rounded-2xl bg-danger p-6 text-white">
                <Trophy className="h-8 w-8" />
                <h3 className="mt-3 font-display text-2xl font-bold uppercase">Student Senate</h3>
                <p className="mt-2 flex-1 text-white/85">Run on your own. Represent your class and help shape decisions across school life.</p>
                <div className="mt-6 border-t border-white/30 pt-4">
                  <span className="font-display text-6xl font-bold leading-none">10</span>
                  <span className="ml-2 font-display text-sm uppercase tracking-widest">seats open</span>
                </div>
                <Button asChild variant="outline" className="mt-5 border-white bg-transparent font-display uppercase tracking-wider text-white hover:bg-white hover:text-danger">
                  <Link href="/senate">Run for Senate</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <SectionHeading eyebrow="Fair play" title="How the election works" center>
            Every step is reviewable and auditable. Students see their own status; staff manage eligibility and approvals.
          </SectionHeading>
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-5">
            {steps.map((s) => (
              <div key={s.title} className="relative rounded-xl border-2 border-navy bg-card p-5 shadow-[4px_4px_0_0_var(--navy)]">
                <s.icon className="h-6 w-6 text-danger" />
                <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{s.tag}</p>
                <h3 className="font-display text-xl font-bold uppercase text-navy">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* News */}
        <section className="border-t border-border bg-card">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <SectionHeading eyebrow="Campaign trail" title="Latest news" />
              <Link href="/announcements" className="inline-flex items-center gap-1 font-display text-sm font-semibold uppercase tracking-wider text-primary hover:underline">
                All news <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            {announcements.length === 0 ? (
              <p className="mt-8 text-sm text-muted-foreground">No announcements yet. Check back soon.</p>
            ) : (
              <div className="mt-8 grid gap-6 md:grid-cols-3">
                {announcements.slice(0, 3).map((a: any) => (
                  <article key={a.id} className="overflow-hidden rounded-xl border border-border bg-background">
                    <div className="h-1.5 bg-danger" />
                    <div className="p-5">
                      <p className="text-xs font-bold uppercase tracking-wider text-danger">{formatDate(a.published_at || a.created_at)}</p>
                      <h3 className="mt-1 font-display text-xl font-bold uppercase leading-tight text-navy">{a.title}</h3>
                      <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{a.body}</p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* CTA */}
        <section className="relative overflow-hidden bg-primary text-white">
          <div className="absolute inset-0 bg-stripes" />
          <div className="relative mx-auto flex max-w-7xl flex-col items-start gap-6 px-4 py-14 sm:px-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-display text-4xl font-bold uppercase leading-none sm:text-5xl">Ready to run?</h2>
              <p className="mt-3 text-white/80">Applications take minutes to start. Save a draft and come back before the deadline.</p>
            </div>
            <Button asChild size="lg" className="h-12 bg-white px-8 font-display text-base uppercase tracking-wider text-primary hover:bg-white/90">
              <Link href="/dashboard/applications">Start your application</Link>
            </Button>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
