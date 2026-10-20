"use client";

import { useMemo, useRef, useState } from "react";
import { UserRound } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/primitives";
import { PollingDesk, type PollingHandlers, type Recent } from "@/components/polling/polling-desk";
import { CountingConsole } from "@/components/counting/counting-console";
import { BallotHistory } from "@/components/counting/ballot-history";
import { IntegritySettings } from "@/components/counting/integrity-settings";
import { createSim } from "./sim";
import type { Student } from "@/lib/actions/polling";

type View = "volunteer" | "admin" | "history" | "integrity";
const VIEWS: { id: View; label: string }[] = [
  { id: "volunteer", label: "Volunteer" },
  { id: "admin", label: "Admin" },
  { id: "history", label: "Ballot history" },
  { id: "integrity", label: "Integrity" },
];

const STUDENTS: Student[] = [
  { id: "1", full_name: "Elira Bytyqi", grade_level: 10, issued: false }, { id: "2", full_name: "Nruen Shabani", grade_level: 10, issued: false },
  { id: "3", full_name: "Dion Krasniqi", grade_level: 7, issued: false }, { id: "4", full_name: "Arben Hoxha", grade_level: 11, issued: false },
  { id: "5", full_name: "Ardita Berisha", grade_level: 12, issued: false }, { id: "6", full_name: "Gent Krasniqi", grade_level: 12, issued: false },
];

export function VoteCountingConsole() {
  const [view, setView] = useState<View>("volunteer");
  const [who, setWho] = useState<"a" | "b">("a");
  const [issued, setIssued] = useState(214);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [recent, setRecent] = useState<Recent[]>([{ id: "a", name: "Dion Krasniqi", grade: 7, at: "09:41" }]);

  // One simulated election shared by the Staff, Admin, History and Integrity views.
  const issuedRef = useRef(issued);
  issuedRef.current = issued;
  const sim = useMemo(() => createSim(() => issuedRef.current),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  []);
  sim.state.who = who;

  const polling: PollingHandlers = useMemo(() => ({
    search: async (q) => STUDENTS.filter((s) => s.full_name!.toLowerCase().includes(q.trim().toLowerCase())).map((s) => ({ ...s, issued: checked.has(s.id) })),
    issue: (id) => {
      const s = STUDENTS.find((x) => x.id === id)!;
      setChecked((c) => new Set(c).add(id)); setIssued((n) => n + 1);
      setRecent((r) => [{ id, name: s.full_name!, grade: s.grade_level, at: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) }, ...r].slice(0, 6));
      return Promise.resolve({ ok: true as const, message: "Ballot issued." });
    },
    undo: (id) => {
      setChecked((c) => { const n = new Set(c); n.delete(id); return n; }); setIssued((n) => n - 1);
      setRecent((r) => r.filter((x) => x.id !== id));
      return Promise.resolve({ ok: true as const, message: "Check-in removed." });
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-border bg-card p-1" role="tablist" aria-label="Preview as">
          {VIEWS.map((v) => (
            <button key={v.id} role="tab" aria-selected={view === v.id} onClick={() => setView(v.id)}
              className={cn("rounded-md px-4 py-1.5 text-sm font-medium transition-colors", view === v.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
              {v.label}
            </button>
          ))}
        </div>
        {view === "admin" && (
          <Button variant="outline" size="sm" onClick={() => sim.teammate("exec-high", 5)}>A teammate counts 5 ballots (High School Government)</Button>
        )}
        {view === "admin" && (
          <Button variant="outline" size="sm" onClick={() => sim.teammate("exec-high", 250)}>Add 250 ballots (to test a mismatch)</Button>
        )}
        {view === "admin" && (
          <Button variant="outline" size="sm" onClick={() => { setWho(who === "a" ? "b" : "a"); setTimeout(sim.emit, 60); }}>
            <UserRound className="h-4 w-4" /> You are counter {who.toUpperCase()} · switch person
          </Button>
        )}
      </div>

      {view === "volunteer" && (
        <div className="space-y-6">
          <PageHeader eyebrow="Election day" title="Polling desk" description="Check students in and hand out ballots." />
          <PollingDesk issued={issued} eligible={1050} recent={recent} canUndo={false} handlers={polling} />
        </div>
      )}
      {view === "admin" && (
        <CountingConsole key={view} demo api={sim.api} initial={sim.view()} isAdmin base="/staff" />
      )}
      {view === "history" && <BallotHistory key="h" api={sim.api} eyebrow="Review console" />}
      {view === "integrity" && <IntegritySettings key="i" api={sim.api} initial={[]} isAdmin />}
    </div>
  );
}
