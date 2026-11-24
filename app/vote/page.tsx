import Link from "next/link";
import { CheckCircle2, Inbox, LogIn } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PageHero, SectionHeading } from "@/components/public/page-hero";
import { Button } from "@/components/ui/button";
import { PollBallot } from "@/components/votes/poll-ballot";
import { Results } from "@/components/votes/results";
import { getCurrentUser } from "@/lib/auth/session";
import { formatWhen } from "@/lib/datetime";
import { getElectionTimezone } from "@/lib/queries/government";
import { getMyVotedIds, getPolls, getSummaries, votesReady } from "@/lib/queries/votes";
import { isEnded, nowIso, type Poll, type PollSummary } from "@/lib/votes";

export const dynamic = "force-dynamic";

const HERO_TEXT = "Questions student government is putting to the whole school. One vote each, and your ballot is secret.";

export default async function VotePage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col bg-paper">
        <SiteHeader />
        <PageHero eyebrow="Your say" title="Student Votes">{HERO_TEXT}</PageHero>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6">
          <section className="rounded-xl border-2 border-navy bg-card p-6 text-center shadow-[4px_4px_0_0_var(--navy)] sm:p-10">
            <LogIn className="mx-auto h-8 w-8 text-primary" />
            <h2 className="mt-3 font-display text-3xl font-bold uppercase text-navy">Sign in to vote</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Use your school account. Everyone gets one vote on each question, and nobody can see what you chose.</p>
            <Button asChild size="lg" className="mt-5"><Link href="/sign-in?next=/vote">Sign in</Link></Button>
          </section>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const [ready, polls, voted, { timezone }] = await Promise.all([votesReady(), getPolls(), getMyVotedIds(), getElectionTimezone()]);
  const now = nowIso();
  const visible = polls.filter((p) => p.status !== "draft");
  const summaries = await getSummaries(visible.map((p) => p.id));
  const open = visible.filter((p) => !isEnded(p, now)).sort((a, b) => (a.closes_at ?? "9999").localeCompare(b.closes_at ?? "9999"));
  const finished = visible.filter((p) => isEnded(p, now)).sort((a, b) => (b.closed_at ?? b.closes_at ?? b.created_at).localeCompare(a.closed_at ?? a.closes_at ?? a.created_at));
  const waiting = open.filter((p) => !voted.has(p.id)).length;
  const when = (iso: string | null) => (iso ? formatWhen(iso, null, timezone) : null);

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <SiteHeader signedIn />
      <PageHero eyebrow="Your say" title="Student Votes">{HERO_TEXT}</PageHero>
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-12 px-4 py-12 sm:px-6">
        {!ready ? (
          <p className="rounded-xl border-2 border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">Student votes are being set up. Check back soon.</p>
        ) : (
          <>
            <section className="space-y-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <SectionHeading eyebrow={open.length ? (waiting ? `${waiting} waiting for you` : "You have voted on everything") : "Nothing open"} title="Open now" />
              </div>
              {open.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-border bg-card p-8 text-center">
                  <Inbox className="mx-auto h-7 w-7 text-muted-foreground" />
                  <p className="mt-2 font-medium">No votes are open right now.</p>
                  <p className="mt-1 text-sm text-muted-foreground">When student government puts a question to the school, it appears here and you get a notification.</p>
                </div>
              ) : (
                <div className="space-y-8">
                  {open.map((p) => (
                    <PollBallot
                      key={p.id}
                      poll={{ id: p.id, title: p.title, description: p.description, kind: p.kind, max_choices: p.max_choices, options: p.options }}
                      voted={voted.has(p.id)}
                      closesLabel={when(p.closes_at)}
                      summary={summaries[p.id] ?? null}
                    />
                  ))}
                </div>
              )}
            </section>

            {finished.length > 0 && (
              <section className="space-y-6">
                <SectionHeading eyebrow="Decided" title="Results" />
                <div className="space-y-5">
                  {finished.map((p) => <FinishedPoll key={p.id} poll={p} voted={voted.has(p.id)} summary={summaries[p.id] ?? null} closedLabel={when(p.closed_at ?? p.closes_at)} />)}
                </div>
              </section>
            )}
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function FinishedPoll({ poll, voted, summary, closedLabel }: { poll: Poll; voted: boolean; summary: PollSummary | null; closedLabel: string | null }) {
  return (
    <article className="overflow-hidden rounded-xl border-2 border-border bg-card">
      <div className="h-1.5 bg-primary" />
      <div className="space-y-4 p-5 sm:p-6">
        <header>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold uppercase tracking-wider text-danger">
            <span>{closedLabel ? `Closed ${closedLabel}` : "Closed"}</span>
            {voted && <span className="inline-flex items-center gap-1 text-success"><CheckCircle2 className="h-3.5 w-3.5" /> You voted</span>}
          </p>
          <h3 className="mt-1 font-display text-2xl font-bold uppercase leading-tight text-navy">{poll.title}</h3>
          {poll.description && <p className="mt-1.5 whitespace-pre-line text-sm text-foreground/80">{poll.description}</p>}
        </header>
        {summary?.options ? <Results summary={summary} final /> : <p className="text-sm text-muted-foreground">Results are not available.</p>}
      </div>
    </article>
  );
}
