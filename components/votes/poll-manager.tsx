"use client";

import { useState } from "react";
import { CalendarClock, EyeOff, Lock, Pencil, Play, Plus, Square, Trash2, Vote, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/dashboard/primitives";
import { ErrorNote, box, labelCls, useAction } from "@/components/government/ui";
import { deletePoll, savePoll, setPollStatus, type PollPatch } from "@/lib/actions/votes";
import { MAX_OPTIONS, MIN_OPTIONS, POLL_STATUS, choiceHint, isEnded, type Poll, type PollKind, type PollSummary, type ShowResults } from "@/lib/votes";
import { Results } from "./results";

export type ManagedPoll = Poll & { editPatch: PollPatch; closesLabel: string | null };

const NEW: PollPatch = { title: "", description: "", kind: "single", maxChoices: 2, options: ["", ""], closeDate: "", closeTime: "15:00", showResults: "after_close" };

export function PollManager({
  polls, summaries, canRun, now,
}: { polls: ManagedPoll[]; summaries: Record<string, PollSummary | null>; canRun: boolean; now: string }) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const { run, pending, error } = useAction();

  return (
    <div className="space-y-6">
      <ErrorNote message={error} />
      {canRun && (editing === "new"
        ? <PollEditor onDone={() => setEditing(null)} initial={NEW} />
        : <Button onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> New vote</Button>)}

      {polls.length === 0 && editing !== "new" ? (
        <EmptyState>No votes yet.{canRun ? " Create one to put a question to the whole school." : ""}</EmptyState>
      ) : (
        <ul className="space-y-4">
          {polls.map((p) => {
            const status = POLL_STATUS[p.status];
            const summary = summaries[p.id];
            const ended = isEnded(p, now);
            return (
              <li key={p.id} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                {editing === p.id ? (
                  <div className="p-5"><PollEditor pollId={p.id} initial={p.editPatch} onDone={() => setEditing(null)} /></div>
                ) : (
                  <div className="space-y-4 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={status.variant}>{status.label}</Badge>
                          {p.status === "open" && ended && <Badge variant="warning">Closing time passed</Badge>}
                          <Badge variant="outline">{choiceHint(p.kind, p.max_choices)}</Badge>
                        </div>
                        <h3 className="text-lg font-semibold leading-snug">{p.title}</h3>
                        {p.description && <p className="max-w-2xl whitespace-pre-line text-sm text-muted-foreground">{p.description}</p>}
                        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" /> {p.closesLabel ? `Closes ${p.closesLabel}` : "Closes when you close it"}</span>
                          <span className="inline-flex items-center gap-1"><EyeOff className="h-3.5 w-3.5" /> {p.show_results === "live" ? "Voters see live results" : "Voters see results after it closes"}</span>
                        </p>
                      </div>
                      {canRun && (
                        <div className="flex flex-wrap gap-2">
                          {p.status === "draft" && (
                            <>
                              <Button disabled={pending} onClick={() => { if (confirm(`Open voting on "${p.title}"? Every student is notified, and the question and options cannot be changed afterwards.`)) run(() => setPollStatus(p.id, "open")); }}>
                                <Play className="h-4 w-4" /> Open voting
                              </Button>
                              <Button variant="outline" onClick={() => setEditing(p.id)}><Pencil className="h-4 w-4" /> Edit</Button>
                              <Button variant="ghost" disabled={pending} className="text-danger hover:bg-danger/10 hover:text-danger"
                                onClick={() => { if (confirm(`Delete the draft "${p.title}"?`)) run(() => deletePoll(p.id)); }}><Trash2 className="h-4 w-4" /> Delete</Button>
                            </>
                          )}
                          {p.status === "open" && (
                            <Button variant="outline" disabled={pending} onClick={() => { if (confirm(`Close voting on "${p.title}"? Results are then shown to everyone and nobody can vote.`)) run(() => setPollStatus(p.id, "closed")); }}>
                              <Square className="h-4 w-4" /> Close voting
                            </Button>
                          )}
                        </div>
                      )}
                    </div>

                    {p.status === "draft" ? (
                      <ol className="flex flex-wrap gap-2">
                        {p.options.map((o) => <li key={o.id} className="rounded-md border border-border bg-background px-2.5 py-1 text-sm">{o.label}</li>)}
                      </ol>
                    ) : summary?.options ? (
                      <div className="rounded-lg border border-border bg-background p-4">
                        <p className="mb-3 flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Lock className="h-3.5 w-3.5" /> You see live counts because you run votes. Ballots are secret.</p>
                        <Results summary={summary} final={ended} />
                      </div>
                    ) : null}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function PollEditor({ pollId, initial, onDone }: { pollId?: string; initial: PollPatch; onDone: () => void }) {
  const [p, setP] = useState<PollPatch>(initial);
  const { run, pending, error } = useAction();
  const key = pollId ?? "new";
  const set = <K extends keyof PollPatch>(k: K, v: PollPatch[K]) => setP((x) => ({ ...x, [k]: v }));
  const filled = p.options.filter((o) => o.trim()).length;
  const maxPick = Math.max(2, Math.min(filled - 1, MAX_OPTIONS - 1));
  const setOption = (i: number, v: string) => set("options", p.options.map((o, n) => (n === i ? v : o)));

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); run(() => savePoll(pollId ?? null, p), onDone); }}
      className="space-y-5 rounded-xl border border-border bg-card p-5 shadow-sm"
    >
      <div className="flex items-center gap-2 text-sm font-semibold"><Vote className="h-4 w-4 text-primary" /> {pollId ? "Edit draft" : "New student vote"}</div>

      <label className={labelCls}>Question
        <input id={`poll-title-${key}`} required maxLength={200} value={p.title} onChange={(e) => set("title", e.target.value)} placeholder="Which theme should spirit week have?" className={cn(box, "w-full text-base")} />
      </label>
      <label className={labelCls}>More detail (optional)
        <textarea id={`poll-desc-${key}`} rows={2} maxLength={2000} value={p.description} onChange={(e) => set("description", e.target.value)} placeholder="Why this is being asked and what happens with the answer."
          className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
      </label>

      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-muted-foreground">How many can a student pick?</legend>
        <div className="flex flex-wrap items-center gap-2">
          {([["single", "One choice"], ["multiple", "Choose several"]] as [PollKind, string][]).map(([k, label]) => (
            <label key={k} className={cn("cursor-pointer rounded-md border px-3 py-2 text-sm font-medium transition-colors", p.kind === k ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:bg-muted")}>
              <input type="radio" name={`poll-kind-${key}`} className="sr-only" checked={p.kind === k} onChange={() => set("kind", k)} /> {label}
            </label>
          ))}
          {p.kind === "multiple" && (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">up to
              <select id={`poll-max-${key}`} value={Math.min(p.maxChoices, maxPick)} onChange={(e) => set("maxChoices", Number(e.target.value))} className={cn(box, "h-9 w-20")}>
                {Array.from({ length: maxPick - 1 }, (_, i) => i + 2).map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          )}
        </div>
        {p.kind === "multiple" && filled < 3 && <p className="text-xs text-warning">Choose-several needs at least 3 options.</p>}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-muted-foreground">Options ({filled} of {MAX_OPTIONS})</legend>
        <ul className="space-y-2">
          {p.options.map((o, i) => (
            <li key={i} className="flex items-center gap-2">
              <input id={`poll-opt-${key}-${i}`} aria-label={`Option ${i + 1}`} maxLength={120} value={o} onChange={(e) => setOption(i, e.target.value)} placeholder={`Option ${i + 1}`} className={cn(box, "flex-1")} />
              {p.options.length > MIN_OPTIONS && (
                <button type="button" aria-label={`Remove option ${i + 1}`} onClick={() => set("options", p.options.filter((_, n) => n !== i))} className="rounded-md p-2 text-muted-foreground hover:bg-danger/10 hover:text-danger"><X className="h-4 w-4" /></button>
              )}
            </li>
          ))}
        </ul>
        {p.options.length < MAX_OPTIONS && (
          <Button type="button" size="sm" variant="outline" onClick={() => set("options", [...p.options, ""])}><Plus className="h-4 w-4" /> Add option</Button>
        )}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid grid-cols-2 gap-3">
          <label className={labelCls}>Closes on
            <input id={`poll-date-${key}`} type="date" value={p.closeDate} onChange={(e) => set("closeDate", e.target.value)} className={cn(box, "w-full")} />
          </label>
          <label className={labelCls}>At
            <input id={`poll-time-${key}`} type="time" value={p.closeTime} onChange={(e) => set("closeTime", e.target.value)} disabled={!p.closeDate} className={cn(box, "w-full disabled:opacity-50")} />
          </label>
        </div>
        <label className={labelCls}>Results for voters
          <select id={`poll-results-${key}`} value={p.showResults} onChange={(e) => set("showResults", e.target.value as ShowResults)} className={cn(box, "w-full")}>
            <option value="after_close">Show after voting closes (recommended)</option>
            <option value="live">Show live while voting</option>
          </select>
        </label>
      </div>
      <p className="text-xs text-muted-foreground">Leave the closing date blank to close it yourself. You always see live counts. Nobody can see who voted for what.</p>

      <ErrorNote message={error} />
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>{pollId ? "Save changes" : "Save as draft"}</Button>
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </form>
  );
}
