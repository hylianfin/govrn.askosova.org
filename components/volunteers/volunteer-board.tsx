"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CalendarDays, MapPin, Pencil, Plus, Trash2, UserPlus, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatWhen } from "@/lib/datetime";
import {
  ACTIVE, ASSIGNMENT_LABEL, ASSIGNMENT_VARIANT, estimateHours, fmtHours, type AssignmentStatus,
} from "@/lib/volunteers";
import {
  assignVolunteer, confirmHours, deleteTask, removeAssignment, saveTask, setAssignmentStatus, type TaskPatch, type VResult,
} from "@/lib/actions/volunteers";

export type TaskRow = TaskPatch & { id: string; starts_at: string | null; ends_at: string | null };
export type AssignmentRow = {
  id: string; task_id: string; volunteer_id: string; status: AssignmentStatus;
  checked_in_at: string | null; checked_out_at: string | null; hours: number | null;
};
export type Person = { id: string; name: string; email: string; grade: number | null };

const box = "h-10 rounded-md border border-border bg-card px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";
const EMPTY: TaskPatch = { title: "", description: "", instructions: "", location: "", date: "", startTime: "08:00", endTime: "15:00", slots: 2 };

export function VolunteerBoard({
  tasks, assignments, people, volunteerIds, timezone,
}: { tasks: TaskRow[]; assignments: AssignmentRow[]; people: Person[]; volunteerIds: string[]; timezone: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<"shifts" | "volunteers">("shifts");
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const person = new Map(people.map((p) => [p.id, p]));
  const volunteers = people.filter((p) => volunteerIds.includes(p.id));

  function run(fn: () => Promise<VResult>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) { setError(r.error); return; }
      after?.();
      router.refresh();
    });
  }

  const byTask = (id: string) => assignments.filter((a) => a.task_id === id);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-md border border-border bg-card p-0.5" role="tablist">
          {(["shifts", "volunteers"] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
              className={cn("rounded px-4 py-1.5 text-sm font-medium capitalize", tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
              {t === "shifts" ? "Shifts" : "Volunteers"}
            </button>
          ))}
        </div>
        {tab === "shifts" && <Button size="sm" onClick={() => setEditing("new")} disabled={editing === "new"}><Plus className="h-4 w-4" /> New shift</Button>}
      </div>

      {error && (
        <div role="alert" className="flex items-start justify-between gap-2 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          <span className="flex items-start gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</span>
          <button aria-label="Dismiss" onClick={() => setError(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      {tab === "shifts" ? (
        <div className="space-y-4">
          {editing === "new" && <TaskForm initial={EMPTY} busy={pending} onCancel={() => setEditing(null)} onSave={(p) => run(() => saveTask(null, p), () => setEditing(null))} />}
          {tasks.length === 0 && editing !== "new" && (
            <p className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">No shifts yet. Create the first one, then assign volunteers to it.</p>
          )}
          {tasks.map((t) => {
            const list = byTask(t.id);
            const filled = list.filter((a) => ACTIVE.includes(a.status)).length;
            const free = Math.max(0, t.slots - filled);
            const assignedIds = new Set(list.filter((a) => !["declined", "no_show"].includes(a.status)).map((a) => a.volunteer_id));
            const options = volunteers.filter((v) => !assignedIds.has(v.id));
            if (editing === t.id) {
              return <TaskForm key={t.id} initial={t} busy={pending} onCancel={() => setEditing(null)} onSave={(p) => run(() => saveTask(t.id, p), () => setEditing(null))} />;
            }
            return (
              <article key={t.id} className="rounded-xl border border-border bg-card shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
                  <div className="min-w-0 space-y-1">
                    <h3 className="text-base font-semibold">{t.title}</h3>
                    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4" />{formatWhen(t.starts_at, t.ends_at, timezone)}</span>
                      {t.location && <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" />{t.location}</span>}
                    </p>
                    {t.description && <p className="text-sm">{t.description}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={free === 0 ? "success" : "warning"}>{filled}/{t.slots} filled</Badge>
                    <button aria-label={`Edit ${t.title}`} onClick={() => setEditing(t.id)} className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"><Pencil className="h-4 w-4" /></button>
                    <button aria-label={`Delete ${t.title}`} disabled={pending} onClick={() => { if (confirm(`Delete “${t.title}”? Its ${list.length} assignment(s) are removed too.`)) run(() => deleteTask(t.id)); }}
                      className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-danger"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>

                <ul className="divide-y divide-border">
                  {list.map((a) => <AssignmentRowView key={a.id} a={a} task={t} who={person.get(a.volunteer_id)} busy={pending} run={run} />)}
                  {list.length === 0 && <li className="px-5 py-4 text-sm text-muted-foreground">Nobody assigned yet.</li>}
                </ul>

                <div className="border-t border-border px-5 py-3">
                  <AssignPicker taskId={t.id} options={options} full={free === 0} busy={pending} setError={setError} onDone={() => router.refresh()} />
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          {volunteers.map((v) => {
            const mine = assignments.filter((a) => a.volunteer_id === v.id && !["declined"].includes(a.status));
            const hours = mine.reduce((s, a) => s + (a.hours ?? 0), 0);
            return (
              <li key={v.id} className="space-y-2 p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div><p className="font-medium">{v.name}</p><p className="text-sm text-muted-foreground">{v.email}{v.grade ? ` · grade ${v.grade}` : ""}</p></div>
                  <div className="text-right text-sm"><p className="font-medium">{fmtHours(hours)} confirmed</p><p className="text-xs text-muted-foreground">{mine.length} shift{mine.length === 1 ? "" : "s"}</p></div>
                </div>
                <ul className="space-y-1">
                  {mine.map((a) => {
                    const t = tasks.find((x) => x.id === a.task_id);
                    return (
                      <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/60 px-3 py-1.5 text-sm">
                        <span>{t?.title} <span className="text-muted-foreground">· {formatWhen(t?.starts_at, t?.ends_at, timezone)}</span></span>
                        <Badge variant={ASSIGNMENT_VARIANT[a.status]}>{ASSIGNMENT_LABEL[a.status]}</Badge>
                      </li>
                    );
                  })}
                  {mine.length === 0 && <li className="text-sm text-muted-foreground">No shifts yet.</li>}
                </ul>
              </li>
            );
          })}
          {volunteers.length === 0 && (
            <li className="p-8 text-center text-sm text-muted-foreground">No volunteers yet. An administrator can give someone the Volunteer role under Admin, Roles.</li>
          )}
        </ul>
      )}
    </div>
  );
}

function AssignPicker({ taskId, options, full, busy, setError, onDone }: { taskId: string; options: Person[]; full: boolean; busy: boolean; setError: (s: string | null) => void; onDone: () => void }) {
  const [pick, setPick] = useState("");
  const [working, startTransition] = useTransition();
  function go(force: boolean) {
    setError(null);
    startTransition(async () => {
      const r = await assignVolunteer(taskId, pick, force);
      if (!r.ok) {
        if (r.conflict && confirm(`${r.error}\n\nAssign anyway?`)) { go(true); return; }
        setError(r.error);
        return;
      }
      setPick("");
      onDone();
    });
  }
  if (full) return <p className="text-sm text-muted-foreground">This shift is full. Raise the number of slots to add more people.</p>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select aria-label="Volunteer to assign" value={pick} onChange={(e) => setPick(e.target.value)} className={cn(box, "min-w-[14rem] flex-1 sm:flex-none")}>
        <option value="">{options.length ? "Choose a volunteer" : "No volunteers available"}</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
      <Button size="sm" variant="outline" disabled={!pick || busy || working} onClick={() => go(false)}><UserPlus className="h-4 w-4" /> Assign</Button>
    </div>
  );
}

function AssignmentRowView({ a, task, who, busy, run }: { a: AssignmentRow; task: TaskRow; who?: Person; busy: boolean; run: (fn: () => Promise<VResult>, after?: () => void) => void }) {
  const est = estimateHours(a, task);
  const [hours, setHours] = useState(String(a.hours ?? est));
  const worked = ["in_progress", "completed"].includes(a.status);
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{who?.name ?? "Unknown volunteer"}</p>
        <p className="truncate text-xs text-muted-foreground">{who?.email}</p>
      </div>
      <Badge variant={ASSIGNMENT_VARIANT[a.status]}>{ASSIGNMENT_LABEL[a.status]}</Badge>
      <select aria-label={`Status for ${who?.name ?? "volunteer"}`} value={a.status} disabled={busy} onChange={(e) => run(() => setAssignmentStatus(a.id, e.target.value as AssignmentStatus))} className={cn(box, "h-9 text-xs")}>
        {(Object.keys(ASSIGNMENT_LABEL) as AssignmentStatus[]).map((s) => <option key={s} value={s}>{ASSIGNMENT_LABEL[s]}</option>)}
      </select>
      {worked && (
        <div className="flex items-center gap-1.5">
          <input aria-label="Hours worked" type="number" min={0} max={24} step={0.25} value={hours} onChange={(e) => setHours(e.target.value)} className={cn(box, "h-9 w-20 text-xs")} />
          <Button size="sm" variant={a.hours == null ? "default" : "outline"} disabled={busy} onClick={() => run(() => confirmHours(a.id, Number(hours)))}>
            {a.hours == null ? "Confirm hours" : "Update"}
          </Button>
        </div>
      )}
      <button aria-label="Remove from shift" disabled={busy} onClick={() => { if (confirm(`Remove ${who?.name ?? "this volunteer"} from the shift?`)) run(() => removeAssignment(a.id)); }}
        className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-danger"><X className="h-4 w-4" /></button>
    </li>
  );
}

function TaskForm({ initial, busy, onSave, onCancel }: { initial: TaskPatch; busy: boolean; onSave: (p: TaskPatch) => void; onCancel: () => void }) {
  const [p, setP] = useState<TaskPatch>({ title: initial.title, description: initial.description, instructions: initial.instructions, location: initial.location, date: initial.date, startTime: initial.startTime, endTime: initial.endTime, slots: initial.slots });
  const set = <K extends keyof TaskPatch>(k: K, v: TaskPatch[K]) => setP((x) => ({ ...x, [k]: v }));
  const underline = "w-full border-0 border-b border-border bg-transparent px-0 py-1.5 outline-none focus:border-primary focus:shadow-[0_1px_0_0_var(--primary)]";
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(p); }} className="space-y-4 rounded-xl border border-l-4 border-border border-l-primary bg-card p-5 shadow-sm">
      <input aria-label="Shift title" required autoFocus value={p.title} onChange={(e) => set("title", e.target.value)} placeholder="Shift title, e.g. Ballot box supervision" className={cn(underline, "text-base font-semibold")} />
      <input aria-label="Description" value={p.description} onChange={(e) => set("description", e.target.value)} placeholder="Short description (optional)" className={cn(underline, "text-sm")} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1 text-xs font-medium text-muted-foreground">Date<input type="date" value={p.date} onChange={(e) => set("date", e.target.value)} className={cn(box, "w-full")} /></label>
        <label className="space-y-1 text-xs font-medium text-muted-foreground">Starts<input type="time" value={p.startTime} onChange={(e) => set("startTime", e.target.value)} className={cn(box, "w-full")} /></label>
        <label className="space-y-1 text-xs font-medium text-muted-foreground">Ends<input type="time" value={p.endTime} onChange={(e) => set("endTime", e.target.value)} className={cn(box, "w-full")} /></label>
        <label className="space-y-1 text-xs font-medium text-muted-foreground">Volunteers needed<input type="number" min={1} max={200} value={p.slots} onChange={(e) => set("slots", Number(e.target.value))} className={cn(box, "w-full")} /></label>
      </div>
      <input aria-label="Location" value={p.location} onChange={(e) => set("location", e.target.value)} placeholder="Location, e.g. Main hall" className={cn(underline, "text-sm")} />
      <textarea aria-label="Instructions" rows={3} value={p.instructions} onChange={(e) => set("instructions", e.target.value)} placeholder="Instructions for volunteers (what to do, what to bring, who to ask)" className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
      <div className="flex gap-2">
        <Button type="submit" disabled={busy || !p.title.trim()}>{busy ? "Saving…" : "Save shift"}</Button>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}
