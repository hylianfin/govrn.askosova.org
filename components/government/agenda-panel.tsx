"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/dashboard/primitives";
import {
  deleteAgendaItem, moveAgendaItem, saveAgendaItem, toggleAgendaItem, type AgendaPatch,
} from "@/lib/actions/government";
import { AGENDA_KIND_LABEL, nameOf, type AgendaItem, type AgendaKind, type Person } from "@/lib/government";
import { ErrorNote, box, labelCls, useAction } from "./ui";

const KINDS = Object.keys(AGENDA_KIND_LABEL) as AgendaKind[];
const EMPTY: AgendaPatch = { title: "", kind: "discussion", presenterId: "", minutes: "", notes: "" };

export function AgendaPanel({
  meetingId, items, people, presenters, canRun, plannedMinutes,
}: {
  meetingId: string; items: AgendaItem[]; people: Person[]; presenters: Person[]; canRun: boolean; plannedMinutes: number | null;
}) {
  const names = new Map(people.map((p) => [p.id, p]));
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const { run, pending, error } = useAction();
  const total = items.reduce((n, i) => n + (i.minutes_allotted ?? 0), 0);

  return (
    <div className="space-y-4">
      <ErrorNote message={error} />
      {items.length === 0 && editing !== "new" ? (
        <EmptyState>No agenda yet.{canRun ? " Add the items members should expect, in the order they will be taken." : ""}</EmptyState>
      ) : (
        <ol className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {items.map((it, i) => (
            <li key={it.id} className="p-4">
              {editing === it.id ? (
                <ItemForm meetingId={meetingId} item={it} presenters={presenters} onDone={() => setEditing(null)} />
              ) : (
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className={cn("font-medium", it.done && "text-muted-foreground line-through")}>{it.title}</p>
                      <Badge variant="outline">{AGENDA_KIND_LABEL[it.kind]}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {it.presenter_id ? `Presented by ${nameOf(names, it.presenter_id)}` : "No presenter"}
                      {it.minutes_allotted ? ` · ${it.minutes_allotted} min` : ""}
                    </p>
                    {it.notes && <p className="mt-1.5 whitespace-pre-wrap text-sm text-muted-foreground">{it.notes}</p>}
                  </div>
                  {canRun && (
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button type="button" aria-label={it.done ? "Mark not discussed" : "Mark discussed"} aria-pressed={it.done} disabled={pending}
                        onClick={() => run(() => toggleAgendaItem(it.id, !it.done))}
                        className={cn("rounded-md p-1.5 hover:bg-muted", it.done ? "text-success" : "text-muted-foreground")}><Check className="h-4 w-4" /></button>
                      <button type="button" aria-label="Move up" disabled={pending || i === 0} onClick={() => run(() => moveAgendaItem(meetingId, it.id, -1))}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                      <button type="button" aria-label="Move down" disabled={pending || i === items.length - 1} onClick={() => run(() => moveAgendaItem(meetingId, it.id, 1))}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                      <button type="button" aria-label="Edit item" onClick={() => setEditing(it.id)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"><Pencil className="h-4 w-4" /></button>
                      <button type="button" aria-label="Delete item" disabled={pending}
                        onClick={() => { if (confirm(`Remove "${it.title}" from the agenda?`)) run(() => deleteAgendaItem(it.id)); }}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-danger/10 hover:text-danger"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}

      {items.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {items.filter((i) => i.done).length} of {items.length} items discussed
          {total > 0 && <> · {total} min planned{plannedMinutes ? ` of ${plannedMinutes} min scheduled` : ""}</>}
          {plannedMinutes && total > plannedMinutes && <span className="font-medium text-warning"> (over time)</span>}
        </p>
      )}

      {canRun && (editing === "new"
        ? <ItemForm meetingId={meetingId} presenters={presenters} onDone={() => setEditing(null)} />
        : <Button variant="outline" onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> Add agenda item</Button>)}
    </div>
  );
}

function ItemForm({
  meetingId, item, presenters, onDone,
}: { meetingId: string; item?: AgendaItem; presenters: Person[]; onDone: () => void }) {
  const [p, setP] = useState<AgendaPatch>(item
    ? { title: item.title, kind: item.kind, presenterId: item.presenter_id ?? "", minutes: item.minutes_allotted ? String(item.minutes_allotted) : "", notes: item.notes ?? "" }
    : EMPTY);
  const { run, pending, error } = useAction();
  const set = <K extends keyof AgendaPatch>(k: K, v: AgendaPatch[K]) => setP((x) => ({ ...x, [k]: v }));
  const key = item?.id ?? "new";

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); run(() => saveAgendaItem(meetingId, item?.id ?? null, p), onDone); }}
      className="space-y-3 rounded-lg border border-dashed border-border bg-background p-4"
    >
      <div className="grid gap-3 sm:grid-cols-6">
        <label className={cn(labelCls, "sm:col-span-4")}>Item
          <input id={`agenda-title-${key}`} required value={p.title} onChange={(e) => set("title", e.target.value)} placeholder="Spirit week budget" className={cn(box, "w-full")} />
        </label>
        <label className={cn(labelCls, "sm:col-span-2")}>Type
          <select id={`agenda-kind-${key}`} value={p.kind} onChange={(e) => set("kind", e.target.value as AgendaKind)} className={cn(box, "w-full")}>
            {KINDS.map((k) => <option key={k} value={k}>{AGENDA_KIND_LABEL[k]}</option>)}
          </select>
        </label>
        <label className={cn(labelCls, "sm:col-span-4")}>Presenter
          <select id={`agenda-presenter-${key}`} value={p.presenterId} onChange={(e) => set("presenterId", e.target.value)} className={cn(box, "w-full")}>
            <option value="">Nobody in particular</option>
            {presenters.map((m) => <option key={m.id} value={m.id}>{m.full_name || "Member"}</option>)}
          </select>
        </label>
        <label className={cn(labelCls, "sm:col-span-2")}>Minutes
          <input id={`agenda-minutes-${key}`} type="number" min={1} max={480} value={p.minutes} onChange={(e) => set("minutes", e.target.value)} placeholder="10" className={cn(box, "w-full")} />
        </label>
        <label className={cn(labelCls, "sm:col-span-6")}>Notes for members
          <textarea id={`agenda-notes-${key}`} rows={2} value={p.notes} onChange={(e) => set("notes", e.target.value)} className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
        </label>
      </div>
      <ErrorNote message={error} />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>{item ? "Save item" : "Add to agenda"}</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </form>
  );
}
