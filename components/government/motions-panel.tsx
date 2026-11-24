"use client";

import { useState } from "react";
import { Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/dashboard/primitives";
import { castMotionVote, deleteMotion, saveMotion, setMotionStatus, setMotionVoting, type MotionPatch } from "@/lib/actions/government";
import { MOTION_STATUS, nameOf, type AgendaItem, type Motion, type Person } from "@/lib/government";
import { ErrorNote, box, labelCls, useAction } from "./ui";

const EMPTY: MotionPatch = { text: "", movedBy: "", secondedBy: "", agendaItemId: "", ballotVisibility: "open" };

export function MotionsPanel({
  meetingId, motions, agenda, people, voters, canRun, canMakeMotions, currentUserId,
}: {
  meetingId: string; motions: Motion[]; agenda: AgendaItem[]; people: Person[]; voters: Person[]; canRun: boolean; canMakeMotions: boolean; currentUserId: string;
}) {
  const names = new Map(people.map((p) => [p.id, p]));
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const { run, pending, error } = useAction();

  return (
    <div className="space-y-4">
      <ErrorNote message={error} />
      {motions.length === 0 && editing !== "new" ? (
        <EmptyState>No motions yet.{canMakeMotions ? " Add each motion as it is moved, then open the live ballot when it is ready." : ""}</EmptyState>
      ) : (
        <ol className="space-y-3">
          {motions.map((m, i) => {
            const status = MOTION_STATUS[m.status];
            const item = agenda.find((a) => a.id === m.agenda_item_id);
            const voted = m.status === "passed" || m.status === "failed";
            return (
              <li key={m.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                {editing === m.id ? (
                  <MotionForm meetingId={meetingId} motion={m} agenda={agenda} voters={voters} onDone={() => setEditing(null)} />
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Motion {i + 1}{item ? ` · ${item.title}` : ""}</p>
                      <div className="flex flex-wrap gap-2"><Badge variant={status.variant}>{status.label}</Badge><Badge variant="outline">{m.ballot_visibility === "anonymous" ? "Anonymous ballot" : "Open ballot"}</Badge></div>
                    </div>
                    <p className="whitespace-pre-wrap font-medium">{m.text}</p>
                    <p className="text-xs text-muted-foreground">
                      Moved by {nameOf(names, m.moved_by)}{m.seconded_by ? `, seconded by ${nameOf(names, m.seconded_by)}` : ", not yet seconded"}
                    </p>
                    {(voted || m.voting_open) && (
                      <dl className="grid max-w-xs grid-cols-3 gap-2 text-center">
                        {([["Yes", m.votes_yes, "text-success"], ["No", m.votes_no, "text-danger"], ["Abstain", m.votes_abstain, "text-muted-foreground"]] as const).map(([label, n, tone]) => (
                          <div key={label} className="rounded-lg border border-border p-2">
                            <dt className="text-xs text-muted-foreground">{label}</dt>
                            <dd className={cn("text-xl font-semibold tabular-nums", tone)}>{n}</dd>
                          </div>
                        ))}
                      </dl>
                    )}

                    {canRun && (
                      <div className="flex flex-wrap gap-2">
                        {m.status === "pending" ? (
                          <>
                            <Button size="sm" variant={m.voting_open ? "default" : "outline"} disabled={pending} onClick={() => run(() => setMotionVoting(m.id, !m.voting_open))}>{m.voting_open ? "Close live vote" : "Open live vote"}</Button>
                            <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => setMotionStatus(m.id, "tabled"))}>Table</Button>
                            <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => setMotionStatus(m.id, "withdrawn"))}>Withdraw</Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditing(m.id)}><Pencil className="h-4 w-4" /> Edit</Button>
                            <Button size="sm" variant="ghost" disabled={pending} className="text-danger hover:bg-danger/10 hover:text-danger"
                              onClick={() => { if (confirm("Delete this motion?")) run(() => deleteMotion(m.id)); }}><Trash2 className="h-4 w-4" /> Delete</Button>
                          </>
                        ) : (
                          <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => setMotionStatus(m.id, "pending"))}>
                            <RotateCcw className="h-4 w-4" /> Reopen{voted ? " and clear the vote" : ""}
                          </Button>
                        )}
                      </div>
                    )}
                    {m.voting_open && voters.some((v) => v.id === currentUserId) && <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => run(() => castMotionVote(m.id, "yes"))}>Yes</Button><Button size="sm" variant="outline" onClick={() => run(() => castMotionVote(m.id, "no"))}>No</Button><Button size="sm" variant="outline" onClick={() => run(() => castMotionVote(m.id, "abstain"))}>Abstain</Button></div>}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {canMakeMotions && (editing === "new"
        ? <MotionForm meetingId={meetingId} agenda={agenda} voters={voters} onDone={() => setEditing(null)} />
        : <Button variant="outline" onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> Add motion</Button>)}
    </div>
  );
}

function MotionForm({
  meetingId, motion, agenda, voters, onDone,
}: { meetingId: string; motion?: Motion; agenda: AgendaItem[]; voters: Person[]; onDone: () => void }) {
  const [p, setP] = useState<MotionPatch>(motion
    ? { text: motion.text, movedBy: motion.moved_by ?? "", secondedBy: motion.seconded_by ?? "", agendaItemId: motion.agenda_item_id ?? "", ballotVisibility: motion.ballot_visibility ?? "open" }
    : EMPTY);
  const { run, pending, error } = useAction();
  const set = <K extends keyof MotionPatch>(k: K, v: MotionPatch[K]) => setP((x) => ({ ...x, [k]: v }));
  const key = motion?.id ?? "new";

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); run(() => saveMotion(meetingId, motion?.id ?? null, p), onDone); }}
      className="space-y-3 rounded-lg border border-dashed border-border bg-background p-4"
    >
      <label className={labelCls}>Motion, as it was moved
        <textarea id={`motion-text-${key}`} required rows={3} value={p.text} onChange={(e) => set("text", e.target.value)}
          placeholder="Move to approve a $150 budget for spirit week posters."
          className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className={labelCls}>Moved by
          <select id={`motion-moved-${key}`} value={p.movedBy} onChange={(e) => set("movedBy", e.target.value)} className={cn(box, "w-full")}>
            <option value="">Not recorded</option>
            {voters.map((m) => <option key={m.id} value={m.id}>{m.full_name || "Member"}</option>)}
          </select>
        </label>
        <label className={labelCls}>Seconded by
          <select id={`motion-seconded-${key}`} value={p.secondedBy} onChange={(e) => set("secondedBy", e.target.value)} className={cn(box, "w-full")}>
            <option value="">Not yet seconded</option>
            {voters.filter((m) => m.id !== p.movedBy).map((m) => <option key={m.id} value={m.id}>{m.full_name || "Member"}</option>)}
          </select>
        </label>
        <label className={labelCls}>Agenda item
          <select id={`motion-item-${key}`} value={p.agendaItemId} onChange={(e) => set("agendaItemId", e.target.value)} className={cn(box, "w-full")}>
            <option value="">None</option>
            {agenda.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
          </select>
        </label>
      </div>
      <fieldset className="rounded-lg border border-border p-3">
        <legend className="px-1 text-xs font-semibold text-foreground">Ballot visibility</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex cursor-pointer gap-2 rounded-md border border-border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5">
            <input type="radio" name={`visibility-${key}`} value="open" checked={p.ballotVisibility === "open"} disabled={!!motion?.voting_open} onChange={() => set("ballotVisibility", "open")} />
            <span><strong className="block">Open</strong><span className="text-xs text-muted-foreground">Names and choices appear on the TV board.</span></span>
          </label>
          <label className="flex cursor-pointer gap-2 rounded-md border border-border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5">
            <input type="radio" name={`visibility-${key}`} value="anonymous" checked={p.ballotVisibility === "anonymous"} disabled={!!motion?.voting_open} onChange={() => set("ballotVisibility", "anonymous")} />
            <span><strong className="block">Anonymous</strong><span className="text-xs text-muted-foreground">Only totals appear; nobody is linked to a choice.</span></span>
          </label>
        </div>
        {motion?.voting_open && <p className="mt-2 text-xs text-muted-foreground">Visibility is locked while voting is open.</p>}
      </fieldset>
      <ErrorNote message={error} />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>{motion ? "Save motion" : "Add motion"}</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </form>
  );
}
