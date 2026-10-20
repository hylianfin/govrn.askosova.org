"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, Eye, EyeOff, Plus, Trash2, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { formatWhen, wallToIso } from "@/lib/datetime";
import { createEvent, deleteEvent, saveEvent, setStage, setTimezone, type EventPatch } from "@/lib/actions/timeline";
import { STAGE_LABELS } from "@/lib/types";

export type TimelineRow = EventPatch & { id: string };
type Save = "idle" | "saving" | "saved" | "error";

const underline =
  "w-full border-0 border-b border-border bg-transparent px-0 py-1.5 outline-none transition-[border-color,box-shadow] focus:border-primary focus:shadow-[0_1px_0_0_var(--primary)]";
const box = "h-10 rounded-md border border-border bg-card px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

const key = (r: TimelineRow) => (r.startDate ? `${r.startDate}T${r.startTime || "00:00"}` : "9999");
const sortRows = (rows: TimelineRow[]) => [...rows].sort((a, b) => key(a).localeCompare(key(b)));

function problem(r: TimelineRow, tz: string) {
  if (!r.title.trim()) return "Give the milestone a title.";
  if (r.startDate && !wallToIso(r.startDate, r.startTime || "00:00", tz)) return "That start date is not valid.";
  if (r.endDate && !wallToIso(r.endDate, r.endTime || "23:59", tz)) return "That end date is not valid.";
  if (r.startDate && r.endDate) {
    const a = wallToIso(r.startDate, r.startTime || "00:00", tz);
    const b = wallToIso(r.endDate, r.endTime || "23:59", tz);
    if (a && b && new Date(b) < new Date(a)) return "The end must be after the start.";
  }
  return null;
}

export function TimelineEditor({ initial, timezone, stage }: { initial: TimelineRow[]; timezone: string; stage: string }) {
  const router = useRouter();
  const [rows, setRows] = useState<TimelineRow[]>(sortRows(initial));
  const [save, setSave] = useState<Save>("idle");
  const [error, setError] = useState<string | null>(null);
  const [tz, setTz] = useState(timezone);
  const [busy, setBusy] = useState(false);
  const latest = useRef(rows);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pending = useRef(0);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (Object.keys(timers.current).length || pending.current) e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  async function persist(id: string) {
    delete timers.current[id];
    const row = latest.current.find((r) => r.id === id);
    if (!row || problem(row, timezone)) return;
    pending.current++;
    const { id: _omit, ...patch } = row;
    void _omit;
    const res = await saveEvent(id, patch);
    pending.current--;
    if (!res.ok) { setError(res.error); setSave("error"); }
    else if (!pending.current && !Object.keys(timers.current).length) setSave("saved");
  }

  function edit(id: string, patch: Partial<TimelineRow>) {
    const next = latest.current.map((r) => (r.id === id ? { ...r, ...patch } : r));
    latest.current = next;
    setRows(next);
    setError(null);
    clearTimeout(timers.current[id]);
    const row = next.find((r) => r.id === id)!;
    if (problem(row, timezone)) { delete timers.current[id]; setSave("idle"); return; }
    setSave("saving");
    timers.current[id] = setTimeout(() => { void persist(id); }, 700);
  }

  function setStart(r: TimelineRow, patch: Partial<Pick<TimelineRow, "startDate" | "startTime">>) {
    const startDate = patch.startDate ?? r.startDate;
    // Keep one-day events one-day: the end date follows the start date until you set it apart.
    const follow = !r.endDate || r.endDate === r.startDate;
    edit(r.id, { ...patch, ...(follow && patch.startDate ? { endDate: startDate } : {}) });
  }

  async function add() {
    setBusy(true);
    const res = await createEvent();
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    const row: TimelineRow = { id: res.id, title: "New milestone", description: "", location: "", startDate: res.startDate, startTime: res.startTime, endDate: res.endDate, endTime: res.endTime, public: true };
    latest.current = sortRows([...latest.current, row]);
    setRows(latest.current);
    setSave("saved");
    requestAnimationFrame(() => document.getElementById(`ev-${res.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }

  async function remove(r: TimelineRow) {
    if (!confirm(`Delete "${r.title}"? This removes it from the public timeline.`)) return;
    clearTimeout(timers.current[r.id]);
    delete timers.current[r.id];
    const res = await deleteEvent(r.id);
    if (!res.ok) { setError(res.error); return; }
    latest.current = latest.current.filter((x) => x.id !== r.id);
    setRows(latest.current);
  }

  const statusText = { idle: "", saving: "Saving…", saved: "All changes saved", error: "Not saved" }[save];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 rounded-xl border border-border bg-card p-5 shadow-sm sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="stage" className="text-sm font-medium">Current stage</label>
          <select id="stage" defaultValue={stage} className={cn(box, "w-full")}
            onChange={async (e) => { const r = await setStage(e.target.value); if (!r.ok) setError(r.error); else { setSave("saved"); router.refresh(); } }}>
            {Object.entries(STAGE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <p className="text-xs text-muted-foreground">Controls the progress tracker students and staff see.</p>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="tz" className="text-sm font-medium">Timezone</label>
          <input id="tz" list="tzs" value={tz} onChange={(e) => setTz(e.target.value)} className={cn(box, "w-full")}
            onBlur={async () => { if (tz === timezone) return; const r = await setTimezone(tz); if (!r.ok) { setError(r.error); setTz(timezone); } else router.refresh(); }} />
          <datalist id="tzs">{["Europe/Berlin", "Europe/Belgrade", "Europe/Tirane", "Europe/London", "UTC", "America/New_York"].map((z) => <option key={z} value={z} />)}</datalist>
          <p className="text-xs text-muted-foreground">All times below are in this timezone, whatever device you edit on.</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className={cn("flex items-center gap-1 text-xs", save === "error" ? "text-danger" : "text-muted-foreground")} aria-live="polite">
          {save === "saved" && <Check className="h-3 w-3 text-success" />}{statusText || "Changes save automatically"}
        </span>
        <Button onClick={add} disabled={busy} size="sm"><Plus className="h-4 w-4" /> Add milestone</Button>
      </div>

      {error && (
        <div role="alert" className="flex items-start justify-between gap-2 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          <span>{error}</span><button aria-label="Dismiss" onClick={() => setError(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      {rows.length === 0 && <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">No milestones yet. Add the first one.</p>}

      <ol className="space-y-4">
        {rows.map((r, i) => {
          const bad = problem(r, timezone);
          const a = r.startDate ? wallToIso(r.startDate, r.startTime || "00:00", timezone) : null;
          const b = r.endDate ? wallToIso(r.endDate, r.endTime || "23:59", timezone) : null;
          return (
            <li key={r.id} id={`ev-${r.id}`}
              onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setRows(sortRows(latest.current)); }}
              className={cn("rounded-lg border bg-card p-5 shadow-sm", bad ? "border-danger" : "border-border")}>
              <div className="flex items-start gap-3">
                <span className="mt-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{i + 1}</span>
                <div className="min-w-0 flex-1 space-y-4">
                  <input aria-label="Title" value={r.title} onChange={(e) => edit(r.id, { title: e.target.value })} className={cn(underline, "text-base font-semibold")} placeholder="Milestone title" />
                  <input aria-label="Description" value={r.description} onChange={(e) => edit(r.id, { description: e.target.value })} className={cn(underline, "text-sm")} placeholder="Short description (optional)" />

                  <div className="grid gap-3 sm:grid-cols-2">
                    <fieldset className="space-y-1.5">
                      <legend className="text-xs font-medium text-muted-foreground">Starts</legend>
                      <div className="flex gap-2">
                        <input type="date" aria-label="Start date" value={r.startDate} onChange={(e) => setStart(r, { startDate: e.target.value })} className={cn(box, "min-w-0 flex-1")} />
                        <input type="time" aria-label="Start time" value={r.startTime} onChange={(e) => setStart(r, { startTime: e.target.value })} className={cn(box, "w-32")} />
                      </div>
                    </fieldset>
                    <fieldset className="space-y-1.5">
                      <legend className="text-xs font-medium text-muted-foreground">Ends</legend>
                      <div className="flex gap-2">
                        <input type="date" aria-label="End date" value={r.endDate} min={r.startDate || undefined} onChange={(e) => edit(r.id, { endDate: e.target.value })} className={cn(box, "min-w-0 flex-1")} />
                        <input type="time" aria-label="End time" value={r.endTime} onChange={(e) => edit(r.id, { endTime: e.target.value })} className={cn(box, "w-32")} />
                      </div>
                    </fieldset>
                  </div>

                  <p className={cn("flex items-center gap-1.5 text-sm", bad ? "text-danger" : "text-muted-foreground")}>
                    <CalendarDays className="h-4 w-4 shrink-0" />
                    {bad ?? formatWhen(a, b, timezone)}
                  </p>

                  <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
                    <button type="button" role="switch" aria-checked={r.public} onClick={() => edit(r.id, { public: !r.public })}
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                      {r.public ? <Eye className="h-4 w-4 text-primary" /> : <EyeOff className="h-4 w-4" />}
                      {r.public ? "Visible to everyone" : "Hidden from students"}
                    </button>
                    <button type="button" onClick={() => remove(r)} aria-label={`Delete ${r.title}`}
                      className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-danger"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
