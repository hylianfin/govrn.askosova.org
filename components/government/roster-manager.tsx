"use client";

import { useState, useTransition } from "react";
import { Search, UserMinus, UserPlus, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { addMember, changeOffice, endMembership, searchStudents, type StudentHit } from "@/lib/actions/government";
import { OFFICES, OFFICE_LABEL, type Office } from "@/lib/government";
import { ErrorNote, box, labelCls, useAction } from "./ui";

export type SeatRow = { id: string; name: string; office: Office; grade: number | null };

/** Administrators decide who sits in government: add a student to a seat, move them, or end their term. */
export function RosterManager({ seats }: { seats: SeatRow[] }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<StudentHit[] | null>(null);
  const [picked, setPicked] = useState<StudentHit | null>(null);
  const [office, setOffice] = useState<Office>("hs_senator");
  const [grade, setGrade] = useState("");
  const [searching, startSearch] = useTransition();
  const { run, pending, error } = useAction();

  function search(e: React.FormEvent) {
    e.preventDefault();
    startSearch(async () => setHits(await searchStudents(q)));
  }
  function reset() { setPicked(null); setHits(null); setQ(""); setGrade(""); setOffice("hs_senator"); }

  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-lg border border-dashed border-border bg-background p-4">
        <p className="text-sm font-medium">Add a student to government</p>
        {picked ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{picked.name}</p>
                <p className="truncate text-xs text-muted-foreground">{picked.email}{picked.grade ? ` · Grade ${picked.grade}` : ""}</p>
              </div>
              <button type="button" aria-label="Choose a different student" onClick={() => setPicked(null)} className="rounded p-1 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={labelCls}>Office
                <select id="seat-office" value={office} onChange={(e) => setOffice(e.target.value as Office)} className={cn(box, "w-full")}>
                  {OFFICES.map((o) => <option key={o} value={o}>{OFFICE_LABEL[o]}</option>)}
                </select>
              </label>
              <label className={labelCls}>Grade{picked.grade ? "" : " (required for senators)"}
                <input id="seat-grade" type="number" min={1} max={13} value={grade} onChange={(e) => setGrade(e.target.value)} placeholder={picked.grade ? String(picked.grade) : "10"} className={cn(box, "w-full")} />
              </label>
            </div>
            <ErrorNote message={error} />
            <Button disabled={pending} onClick={() => run(() => addMember(picked.id, office, grade.trim() ? Number(grade) : null), reset)}>
              <UserPlus className="h-4 w-4" /> Add as {OFFICE_LABEL[office]}
            </Button>
          </div>
        ) : (
          <>
            <form onSubmit={search} className="flex gap-2">
              <input id="seat-search" type="search" aria-label="Search students" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or email" className={cn(box, "flex-1")} />
              <Button type="submit" variant="outline" disabled={searching || q.trim().length < 2}><Search className="h-4 w-4" /> Search</Button>
            </form>
            {hits && hits.length === 0 && <p className="text-sm text-muted-foreground">No students match that search.</p>}
            {hits && hits.length > 0 && (
              <ul className="divide-y divide-border overflow-hidden rounded-md border border-border bg-card">
                {hits.map((h) => (
                  <li key={h.id}>
                    <button type="button" onClick={() => { setPicked(h); setGrade(""); }} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-muted/60">
                      <span className="min-w-0"><span className="block truncate text-sm font-medium">{h.name}</span><span className="block truncate text-xs text-muted-foreground">{h.email}</span></span>
                      <span className="shrink-0 text-xs text-muted-foreground">{h.grade ? `Grade ${h.grade}` : ""}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <div className="space-y-2">
        <ErrorNote message={picked ? null : error} />
        {seats.length === 0 ? <p className="text-sm text-muted-foreground">Nobody holds a seat yet.</p> : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {seats.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 p-3 sm:p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{s.name}</p>
                  {s.grade && <p className="text-xs text-muted-foreground">Grade {s.grade}</p>}
                </div>
                <select aria-label={`Office for ${s.name}`} value={s.office} disabled={pending} onChange={(e) => run(() => changeOffice(s.id, e.target.value as Office))} className={cn(box, "w-44")}>
                  {OFFICES.map((o) => <option key={o} value={o}>{OFFICE_LABEL[o]}</option>)}
                </select>
                <Button size="sm" variant="outline" disabled={pending}
                  onClick={() => { if (confirm(`End ${s.name}'s term as ${OFFICE_LABEL[s.office]}? They keep their records but lose access to the Government console.`)) run(() => endMembership(s.id)); }}>
                  <UserMinus className="h-4 w-4" /> End term
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
