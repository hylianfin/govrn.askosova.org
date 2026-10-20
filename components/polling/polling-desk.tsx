"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { CheckCircle2, Search, Undo2, Vote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { issueBallot, searchStudents, undoBallot, type Student, type PollingResult } from "@/lib/actions/polling";

export interface Recent { id: string; name: string; grade: number | null; at: string }

export interface PollingHandlers {
  search: (q: string) => Promise<Student[]>;
  issue: (id: string) => Promise<PollingResult>;
  undo: (id: string) => Promise<PollingResult>;
}
const realHandlers: PollingHandlers = { search: searchStudents, issue: issueBallot, undo: undoBallot };

export function PollingDesk({ issued, eligible, recent, canUndo, handlers = realHandlers }: { issued: number; eligible: number; recent: Recent[]; canUndo: boolean; handlers?: PollingHandlers }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Student[]>([]);
  const [searched, setSearched] = useState(false);
  const [pending, start] = useTransition();
  const pct = eligible ? Math.min(100, Math.round((issued / eligible) * 100)) : 0;

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); setSearched(false); return; }
    const t = setTimeout(async () => { setResults(await handlers.search(q)); setSearched(true); }, 250);
    return () => clearTimeout(t);
  }, [q, handlers]);

  const act = (id: string, fn: (id: string) => Promise<PollingResult>, issuedNow: boolean) =>
    start(async () => {
      const r = await fn(id);
      if (r.ok) { toast.success(r.message); setResults((rs) => rs.map((s) => (s.id === id ? { ...s, issued: issuedNow } : s))); }
      else toast.error(r.error);
    });

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <section className="rounded-xl border border-border bg-card shadow-sm lg:col-span-2">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold">Voter check-in</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Find the student, check their ID, then issue a ballot. This records that a ballot was handed out, never who they voted for.</p>
        </div>
        <div className="space-y-4 p-5">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by student name"
              className="flex h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <ul className="divide-y divide-border rounded-lg border border-border empty:hidden" aria-live="polite">
            {results.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{s.full_name}</p>
                  <p className="text-xs text-muted-foreground">Grade {s.grade_level}</p>
                </div>
                {s.issued ? (
                  <div className="flex items-center gap-2">
                    <Badge variant="success" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Ballot issued</Badge>
                    {canUndo && <Button variant="ghost" size="icon" className="h-8 w-8" disabled={pending} onClick={() => act(s.id, handlers.undo, false)} aria-label="Undo check-in"><Undo2 className="h-4 w-4" /></Button>}
                  </div>
                ) : (
                  <Button size="sm" disabled={pending} onClick={() => act(s.id, handlers.issue, true)}>Issue ballot</Button>
                )}
              </li>
            ))}
          </ul>
          {searched && results.length === 0 && <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">No matching student. Check the spelling or ask staff.</p>}

          {recent.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-medium">Latest check-ins</h3>
              <ul className="divide-y divide-border rounded-lg border border-border">
                {recent.map((r) => (
                  <li key={r.id} className="flex items-center justify-between px-4 py-2 text-sm">
                    <span>{r.name}{r.grade ? <span className="text-muted-foreground"> · Grade {r.grade}</span> : null}</span>
                    <time className="text-xs tabular-nums text-muted-foreground">{r.at}</time>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Ballots issued</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">{issued}</p>
              <p className="mt-1 text-xs text-muted-foreground">of {eligible} eligible students · {pct}% turnout</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Vote className="h-5 w-5" /></div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} /></div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground shadow-sm">
          <p className="font-medium text-foreground">At the desk</p>
          <ul className="mt-2 list-disc space-y-1 pl-5"><li>Check students in</li><li>Issue one ballot per student</li><li>Counts and results are not shown here</li></ul>
        </div>
      </div>
    </div>
  );
}
