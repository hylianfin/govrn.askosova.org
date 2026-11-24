"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Check, Lock } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { castVote } from "@/lib/actions/votes";
import { choiceHint, type PollKind, type PollOption, type PollSummary } from "@/lib/votes";
import { Results } from "./results";

export type BallotPoll = {
  id: string; title: string; description: string | null; kind: PollKind; max_choices: number; options: PollOption[];
};

/** One open vote: pick, review, cast. Once cast it cannot be changed, and the card says so before the student commits. */
export function PollBallot({
  poll, voted, closesLabel, summary,
}: { poll: BallotPoll; voted: boolean; closesLabel: string | null; summary: PollSummary | null }) {
  const router = useRouter();
  const [picked, setPicked] = useState<string[]>([]);
  const [reviewing, setReviewing] = useState(false);
  const [cast, setCast] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const single = poll.kind === "single";
  const atMax = picked.length >= poll.max_choices;
  const hasVoted = voted || cast;
  const labels = poll.options.filter((o) => picked.includes(o.id)).map((o) => o.label);

  function toggle(id: string) {
    setError(null);
    setPicked((cur) => (single ? [id] : cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < poll.max_choices ? [...cur, id] : cur));
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const r = await castVote(poll.id, picked);
      if (!r.ok) { setError(r.error); setReviewing(false); return; }
      setCast(true);
      router.refresh();
    });
  }

  return (
    <article className="overflow-hidden rounded-xl border-2 border-navy bg-card shadow-[4px_4px_0_0_var(--navy)]">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-navy px-5 py-2.5 text-white">
        <p className="inline-flex items-center gap-2 font-display text-xs font-semibold uppercase tracking-[0.2em]">
          <span className="h-2 w-2 rounded-full bg-danger animate-pulse-ring" /> Voting open
        </p>
        {closesLabel && <p className="text-xs text-white/75">Closes {closesLabel}</p>}
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        <header>
          <h3 className="font-display text-2xl font-bold uppercase leading-tight text-navy sm:text-3xl">{poll.title}</h3>
          {poll.description && <p className="mt-2 whitespace-pre-line text-sm text-foreground/80">{poll.description}</p>}
        </header>

        {hasVoted ? (
          <div className="space-y-4">
            <p className="flex items-start gap-2.5 rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm font-medium text-success">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              <span>Your vote is in. Thank you for taking part.<span className="block font-normal text-success/90">Your choice is secret. Nobody can see what you picked.</span></span>
            </p>
            {summary?.options
              ? <Results summary={summary} final={false} />
              : <p className="text-sm text-muted-foreground">Results are shown when voting closes{summary ? ` · ${summary.voters} voted so far` : ""}.</p>}
          </div>
        ) : reviewing ? (
          <div className="space-y-4">
            <div className="rounded-lg border-2 border-primary bg-primary/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">Your vote</p>
              <ul className="mt-1.5 space-y-1">
                {labels.map((l) => <li key={l} className="flex items-center gap-2 text-lg font-semibold"><Check className="h-5 w-5 text-primary" />{l}</li>)}
              </ul>
            </div>
            <p className="flex items-start gap-2 text-sm text-muted-foreground"><Lock className="mt-0.5 h-4 w-4 shrink-0" /> Once you cast it you cannot change it. Your choice stays secret.</p>
            <div className="flex flex-wrap gap-2">
              <Button size="lg" disabled={pending} onClick={submit}>{pending ? "Casting…" : "Cast my vote"}</Button>
              <Button size="lg" variant="ghost" disabled={pending} onClick={() => setReviewing(false)}>Go back</Button>
            </div>
          </div>
        ) : (
          <fieldset className="space-y-3">
            <legend className="flex w-full items-baseline justify-between gap-3 text-sm">
              <span className="font-semibold text-navy">{choiceHint(poll.kind, poll.max_choices)}</span>
              {!single && <span className="tabular-nums text-muted-foreground">{picked.length} of {poll.max_choices} chosen</span>}
            </legend>
            <div className="space-y-2.5">
              {poll.options.map((o) => {
                const on = picked.includes(o.id);
                return (
                  <label key={o.id} className="relative block cursor-pointer">
                    <input
                      className="peer sr-only"
                      type={single ? "radio" : "checkbox"}
                      name={`poll-${poll.id}`}
                      checked={on}
                      disabled={!single && atMax && !on}
                      onChange={() => toggle(o.id)}
                    />
                    <span className="flex items-center gap-3 rounded-lg border-2 border-border bg-card px-4 py-3.5 text-[15px] font-medium transition-colors hover:border-primary/50 peer-checked:border-primary peer-checked:bg-primary/5 peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-disabled:cursor-not-allowed peer-disabled:opacity-45">
                      <span className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center border-2 border-input bg-card text-white transition-colors",
                        single ? "rounded-full" : "rounded-md",
                        on && "border-primary bg-primary",
                      )}>
                        {on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                      </span>
                      <span className="min-w-0">{o.label}</span>
                    </span>
                  </label>
                );
              })}
            </div>
            {error && (
              <p role="alert" className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
              </p>
            )}
            <Button size="lg" className="w-full sm:w-auto" disabled={picked.length === 0} onClick={() => setReviewing(true)}>Review my vote</Button>
          </fieldset>
        )}
      </div>
    </article>
  );
}
