"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/dashboard/primitives";
import { deleteActionItem, saveActionItem, toggleActionItem, type ActionPatch } from "@/lib/actions/government";
import { dayLabel, nameOf, type ActionItem, type Person } from "@/lib/government";
import { ErrorNote, box, labelCls, useAction } from "./ui";

/** Follow-ups from meetings. On a meeting page `meetingId` ties new items to that meeting; on the Action items page it is omitted. */
export function ActionItems({
  items, people, assignees, canRun, today, meetingId, meetingTitles = {}, currentUserId,
}: {
  items: ActionItem[]; people: Person[]; assignees: Person[]; canRun: boolean; today: string;
  meetingId?: string; meetingTitles?: Record<string, string>; currentUserId?: string;
}) {
  const names = new Map(people.map((p) => [p.id, p]));
  const [adding, setAdding] = useState(false);
  const [p, setP] = useState<ActionPatch>({ title: "", assigneeId: "", dueOn: "", meetingId: meetingId ?? "" });
  const { run, pending, error } = useAction();
  const set = <K extends keyof ActionPatch>(k: K, v: ActionPatch[K]) => setP((x) => ({ ...x, [k]: v }));
  const open = items.filter((i) => !i.done);

  return (
    <div className="space-y-4">
      <ErrorNote message={error} />
      {items.length === 0 && !adding ? (
        <EmptyState>No action items yet.{canRun ? " Add what needs to happen after a meeting, who owns it and when it is due." : ""}</EmptyState>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {items.map((it) => {
            const overdue = !it.done && !!it.due_on && it.due_on < today;
            return (
              <li key={it.id} className="flex items-start gap-3 p-4">
                <input id={`action-${it.id}`} type="checkbox" checked={it.done} disabled={!canRun || pending} aria-label={`Done: ${it.title}`}
                  onChange={(e) => run(() => toggleActionItem(it.id, e.target.checked))} className="mt-1 h-4 w-4 accent-primary" />
                <div className="min-w-0 flex-1">
                  <p className={cn("font-medium", it.done && "text-muted-foreground line-through")}>{it.title}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span className={cn(it.assignee_id && it.assignee_id === currentUserId && "font-medium text-foreground")}>
                      {it.assignee_id ? `${nameOf(names, it.assignee_id)}${it.assignee_id === currentUserId ? " (you)" : ""}` : "Unassigned"}
                    </span>
                    {it.due_on && <span>· due {dayLabel(it.due_on)}</span>}
                    {overdue && <Badge variant="danger">Overdue</Badge>}
                    {!meetingId && it.meeting_id && meetingTitles[it.meeting_id] && <span>· from {meetingTitles[it.meeting_id]}</span>}
                  </p>
                </div>
                {canRun && (
                  <button type="button" aria-label={`Delete ${it.title}`} disabled={pending}
                    onClick={() => { if (confirm("Delete this action item?")) run(() => deleteActionItem(it.id)); }}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-danger/10 hover:text-danger"><Trash2 className="h-4 w-4" /></button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {items.length > 0 && <p className="text-xs text-muted-foreground">{open.length} open · {items.length - open.length} done</p>}

      {canRun && (adding ? (
        <form
          onSubmit={(e) => { e.preventDefault(); run(() => saveActionItem(null, p), () => { setAdding(false); setP({ title: "", assigneeId: "", dueOn: "", meetingId: meetingId ?? "" }); }); }}
          className="space-y-3 rounded-lg border border-dashed border-border bg-background p-4"
        >
          <label className={labelCls}>What needs to be done
            <input id="action-title" required value={p.title} onChange={(e) => set("title", e.target.value)} placeholder="Get three quotes for spirit week posters" className={cn(box, "w-full")} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={labelCls}>Owner
              <select id="action-assignee" value={p.assigneeId} onChange={(e) => set("assigneeId", e.target.value)} className={cn(box, "w-full")}>
                <option value="">Unassigned</option>
                {assignees.map((m) => <option key={m.id} value={m.id}>{m.full_name || "Member"}</option>)}
              </select>
            </label>
            <label className={labelCls}>Due
              <input id="action-due" type="date" value={p.dueOn} onChange={(e) => set("dueOn", e.target.value)} className={cn(box, "w-full")} />
            </label>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={pending}>Add action item</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </form>
      ) : (
        <Button variant="outline" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Add action item</Button>
      ))}
    </div>
  );
}
