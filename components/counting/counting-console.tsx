"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AlertTriangle, Ban, FileX2, History, Lock, Play, RefreshCcw, RotateCcw, Scale, ShieldCheck, Square, Undo2, UserCheck, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader, EmptyState } from "@/components/dashboard/primitives";
import { BallotPaper } from "@/components/counting/ballot-paper";
import { ReconciliationReport } from "@/components/counting/reconciliation-report";
import type { CountApi } from "@/components/counting/api";
import { KIND_LABEL, RACE_LABEL, SCHOOL_LABEL, ballotFlags, raceBallots, type BallotKind, type ChainStatus, type LiveRace, type LiveState, type Reconciliation, type School } from "@/lib/live";

export interface ConsoleAlert { id: string; title: string; body: string | null }

function ago(iso: string | null, now: number) {
  if (!iso) return "no ballots yet";
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.floor(s / 60)} min ago` : `${Math.floor(s / 3600)} h ago`;
}

const STATUS_BADGE = {
  not_started: { label: "Not started", variant: "secondary" as const },
  counting: { label: "Counting", variant: "success" as const },
  ended: { label: "Election ended", variant: "info" as const },
};

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { id: T; label: string; dot?: string }[] }) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-card p-1" role="tablist">
      {options.map((o) => (
        <button
          key={o.id} role="tab" aria-selected={value === o.id} onClick={() => onChange(o.id)}
          className={cn("flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition-colors", value === o.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
        >
          {o.label}
          {o.dot && <span className={cn("h-2 w-2 rounded-full", value === o.id ? "bg-white" : o.dot)} />}
        </button>
      ))}
    </div>
  );
}

type Entry = { kind: BallotKind; choices: string[] };
type Pending = { id: number; race: string; delta: 1 | -1; entry: Entry };

// What the screen shows: the latest numbers from the database plus this person's own ballots that are still on their way,
// so counting feels instant while other counters' ballots arrive live.
function withPending(server: LiveState, pending: Pending[]): LiveState {
  if (pending.length === 0) return server;
  return {
    ...server,
    races: server.races.map((r) => {
      const mine = pending.filter((p) => p.race === r.race);
      if (mine.length === 0) return r;
      const out = { ...r, candidates: r.candidates.map((c) => ({ ...c })) };
      for (const p of mine) {
        out.valid += p.entry.kind === "valid" ? p.delta : 0;
        out.invalid += p.entry.kind === "invalid" ? p.delta : 0;
        out.blank += p.entry.kind === "blank" ? p.delta : 0;
        for (const c of out.candidates) if (p.entry.choices.includes(c.id)) c.votes = Math.max(0, c.votes + p.delta);
        if (p.delta === 1) out.countedByMe = true;
      }
      return out;
    }),
  };
}

export function CountingConsole({ api, initial, isAdmin, base = "/staff", alerts = [], onDismissAlert, pollMs = 20000, demo = false }: {
  api: CountApi; initial: LiveState; isAdmin: boolean; base?: string; alerts?: ConsoleAlert[]; onDismissAlert?: (id: string) => void; pollMs?: number; demo?: boolean;
}) {
  const [server, setServer] = useState<LiveState>(initial);
  const [pending, setPending] = useState<Pending[]>([]);
  const [syncedAt, setSyncedAt] = useState(() => Date.now());
  const [school, setSchool] = useState<School>(initial.races[0]?.school ?? "high");
  const [kind, setKind] = useState<LiveRace["kind"]>("exec");
  const [selected, setSelected] = useState<string[]>([]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 3000); return () => clearInterval(t); }, []);
  const [report, setReport] = useState<{ rec: Reconciliation; chain: ChainStatus | null } | null>(null);
  const [blocked, setBlocked] = useState<{ rec: Reconciliation; reason: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [recountOpen, setRecountOpen] = useState(false);
  const [recountReason, setRecountReason] = useState("");
  const history = useRef<Record<string, Entry[]>>({});
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const ackVersion = useRef(0);
  const nextId = useRef(0);
  const digits = useRef<{ buf: string; timer: ReturnType<typeof setTimeout> | null }>({ buf: "", timer: null });

  const live = useMemo(() => withPending(server, pending), [server, pending]);

  // A poll that started before one of my ballots was saved would not contain it, so it is ignored; the save triggers its own refresh.
  const refresh = useCallback(async () => {
    const version = ackVersion.current;
    try {
      const r = await api.poll();
      if (version === ackVersion.current) { setServer(r); setSyncedAt(Date.now()); }
    } catch { /* keep showing the last numbers; the next poll retries */ }
  }, [api]);

  // Realtime pushes every change from every counter as it happens; the slow poll is only a safety net if the connection drops.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = api.subscribe(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(refresh, 100);
    });
    const poll = setInterval(refresh, pollMs);
    return () => { unsubscribe(); clearInterval(poll); if (timer) clearTimeout(timer); };
  }, [api, refresh, pollMs]);

  const schools = [...new Set(live.races.map((r) => r.school))] as School[];
  const activeSchool = schools.includes(school) ? school : schools[0];
  const kinds = live.races.filter((r) => r.school === activeSchool).map((r) => r.kind);
  const race = live.races.find((r) => r.school === activeSchool && r.kind === (kinds.includes(kind) ? kind : kinds[0]));
  const counting = live.status === "counting";
  // Anyone on the counting team can enter ballots in any open race.
  const canEdit = counting && !!race && !race.confirmed;

  // Switching race starts a fresh, empty ballot.
  useEffect(() => { setSelected([]); }, [race?.race]);

  const run = async (op: () => Promise<unknown>, ok?: string) => {
    try { await op(); if (ok) toast.success(ok); return true; }
    catch (e) { toast.error(e instanceof Error ? e.message : "Something went wrong."); return false; }
    finally { await refresh(); }
  };

  // Ballots are saved one after another, in the order they were entered, while the screen updates at once.
  // `p` is the change shown on screen until it is saved (null when the screen cannot know the effect in advance).
  const send = (p: Pending | null, call: () => Promise<unknown>, onFail: () => void) => {
    if (p) setPending((list) => [...list, p]);
    queue.current = queue.current.then(async () => {
      let ok = true;
      try { await call(); }
      catch (e) { ok = false; toast.error(e instanceof Error ? e.message : "Could not save this ballot."); onFail(); }
      if (ok) ackVersion.current++;
      if (p) setPending((list) => list.filter((x) => x.id !== p.id));
      await refresh();
    });
  };

  const record = (k: BallotKind) => {
    if (!race || !canEdit) return;
    if (k === "valid" && (selected.length < 1 || selected.length > race.maxChoices)) return;
    const entry: Entry = { kind: k, choices: k === "valid" ? selected : [] };
    const key = race.race;
    (history.current[key] ??= []).push(entry);
    setSelected([]);
    send({ id: nextId.current++, race: key, delta: 1, entry }, () => api.record(key, entry.kind, entry.choices), () => {
      const i = history.current[key]?.lastIndexOf(entry) ?? -1;
      if (i >= 0) history.current[key].splice(i, 1);
    });
  };

  const undo = () => {
    if (!race || !canEdit) return;
    const key = race.race;
    const entry = history.current[key]?.pop();
    // Without a ballot entered on this screen, the database still removes this person's latest one.
    send(entry ? { id: nextId.current++, race: key, delta: -1, entry } : null, () => api.undo(key), () => { if (entry) history.current[key].push(entry); });
  };

  const checkNumbers = async () => {
    setChecking(true);
    try {
      const [rec, chain] = await Promise.all([api.reconcile(), api.verifyChain()]);
      setReport({ rec, chain });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not check the numbers."); }
    setChecking(false);
  };

  // Ending the election compares the count with the printed, issued and registered numbers first.
  const endElection = async (reason?: string) => {
    try {
      const r = await api.setStatus("ended", reason);
      if (r.ok) {
        toast.success("Election ended. Edits are locked.");
        setBlocked(null);
        if (r.reconciliation && (r.reconciliation.errors > 0 || r.reconciliation.warnings > 0)) setReport({ rec: r.reconciliation, chain: null });
      } else {
        setBlocked({ rec: r.reconciliation, reason: "" });
      }
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not end the election."); }
    await refresh();
  };

  const startRecount = async () => {
    if (!race) return;
    const key = race.race;
    const ok = await run(() => api.startRecount(key, recountReason.trim()), `Recount started for ${RACE_LABEL(key)}. Count it again from the paper ballots.`);
    if (ok) { setRecountOpen(false); setRecountReason(""); history.current[key] = []; }
  };

  const toggle = (id: string) => {
    if (!race || !canEdit) return;
    setSelected((s) => {
      if (s.includes(id)) return s.filter((x) => x !== id);
      if (race.maxChoices === 1) return [id];
      if (s.length >= race.maxChoices) { toast.error(`A ballot can have at most ${race.maxChoices} marks. Mark it invalid if it has more.`); return s; }
      return [...s, id];
    });
  };

  // Keyboard: type a candidate's number to mark it, Enter records the ballot, I invalid, B blank, Z undo.
  useEffect(() => {
    if (!canEdit || !race) return;
    const max = race.candidates.length;
    const flush = () => {
      const n = Number(digits.current.buf); digits.current.buf = "";
      const c = race.candidates.find((x) => x.num === n);
      if (c) toggle(c.id);
    };
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        if (digits.current.timer) clearTimeout(digits.current.timer);
        digits.current.buf += e.key;
        // Another digit could still make a valid number only when the list is long enough.
        if (Number(digits.current.buf) * 10 > max) flush();
        else digits.current.timer = setTimeout(flush, 500);
      } else if (e.key === "Enter") { e.preventDefault(); record("valid"); }
      else if (e.key.toLowerCase() === "i") record("invalid");
      else if (e.key.toLowerCase() === "b") record("blank");
      else if (e.key.toLowerCase() === "z") undo();
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); if (digits.current.timer) clearTimeout(digits.current.timer); digits.current.buf = ""; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit, race?.race, selected]);

  const confirmed = live.races.filter((r) => r.confirmed).length;
  const allConfirmed = live.races.length > 0 && confirmed === live.races.length;
  const badge = STATUS_BADGE[live.status];
  const counted = race ? raceBallots(race) : 0;
  const validSelection = !!race && selected.length >= 1 && selected.length <= race.maxChoices;
  const myLast = race ? [...(history.current[race.race] ?? [])].reverse().find((x) => x.kind === "valid")?.choices : undefined;
  const lastNums = race ? race.candidates.filter((c) => (myLast ?? race.lastChoices).includes(c.id)).map((c) => c.num) : [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={isAdmin ? "Admin console" : "Staff console"}
        title="Count the ballots"
        description="Take one paper ballot at a time, mark the numbers on it, and record it."
        actions={
          <>
            <Badge variant={badge.variant} className="px-3 py-1 text-sm">{badge.label}</Badge>
            {isAdmin && live.status === "not_started" && <Button size="sm" onClick={() => run(() => api.setStatus("counting"), "Counting is open.")}><Play className="h-4 w-4" /> Start counting</Button>}
            {isAdmin && live.status === "counting" && <Button size="sm" variant="destructive" disabled={!allConfirmed} title={allConfirmed ? undefined : "Confirm every race first"} onClick={() => endElection()}><Square className="h-4 w-4" /> End election</Button>}
            {isAdmin && live.status === "ended" && <Button size="sm" variant="outline" onClick={() => run(() => api.setStatus("counting"), "Election reopened.")}><RotateCcw className="h-4 w-4" /> Reopen</Button>}
            <Button asChild size="sm" variant="outline"><Link href={`${base}/ballot-history`}><History className="h-4 w-4" /> Ballot history</Link></Button>
            {isAdmin && <Button asChild size="sm" variant="outline"><Link href="/admin/integrity"><Scale className="h-4 w-4" /> Integrity</Link></Button>}
          </>
        }
      />

      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a) => (
            <div key={a.id} className="flex items-start gap-3 rounded-lg border border-danger/40 bg-danger/5 px-4 py-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
              <div className="flex-1"><p className="font-medium">{a.title}</p>{a.body && <p className="text-muted-foreground">{a.body}</p>}</div>
              {onDismissAlert && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onDismissAlert(a.id)} aria-label="Dismiss"><X className="h-4 w-4" /></Button>}
            </div>
          ))}
        </div>
      )}

      {blocked && (
        <section className="rounded-xl border-2 border-danger/50 bg-card shadow-sm">
          <header className="border-b border-border px-5 py-4">
            <h2 className="flex items-center gap-2 text-base font-semibold text-danger"><AlertTriangle className="h-5 w-5" /> The count cannot be closed yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">The ballots counted do not match the ballots printed, issued or registered. Every admin has been notified. Check the ballot history, then recount the race or repeat the election.</p>
          </header>
          <div className="space-y-4 p-5">
            <ReconciliationReport rec={blocked.rec} />
            <div className="space-y-2 border-t border-border pt-4">
              <p className="text-sm font-medium">Close the election anyway</p>
              <input value={blocked.reason} onChange={(e) => setBlocked({ ...blocked, reason: e.target.value })} placeholder="Write why the difference is acceptable (at least 5 characters)" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              <div className="flex flex-wrap gap-2">
                <Button variant="destructive" disabled={blocked.reason.trim().length < 5} onClick={() => endElection(blocked.reason.trim())}>End the election anyway</Button>
                <Button variant="outline" onClick={() => setBlocked(null)}>Keep counting or recount</Button>
              </div>
              <p className="text-xs text-muted-foreground">Your reason is saved with the result and sent to the other admins.</p>
            </div>
          </div>
        </section>
      )}

      {live.races.length === 0 ? (
        <EmptyState>No approved candidates yet. Races appear here once applications are approved.</EmptyState>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            {schools.map((sc) => {
              const rs = live.races.filter((r) => r.school === sc);
              const counted = rs.reduce((n, r) => n + raceBallots(r), 0);
              const issued = rs[0]?.issued ?? null;
              const last = rs.map((r) => r.lastBallotAt).filter(Boolean).sort().pop() ?? null;
              const active = sc === activeSchool;
              return (
                <button
                  key={sc} type="button" onClick={() => setSchool(sc)} aria-pressed={active}
                  className={cn("rounded-xl border bg-card p-4 text-left shadow-sm transition-colors", active ? "border-primary ring-1 ring-primary" : "border-border hover:bg-muted/40")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{SCHOOL_LABEL[sc]}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">last ballot {ago(last, now)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Printed {rs.find((r) => r.kind === "exec")?.printed ?? "–"} / {rs.find((r) => r.kind === "senate")?.printed ?? "–"} · Registered {rs[0]?.registered ?? "–"}
                      </p>
                    </div>
                    <p className="text-2xl font-semibold tabular-nums leading-none">{counted}{issued != null && <span className="text-base text-muted-foreground"> / {issued}</span>}</p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {rs.map((r) => <Badge key={r.race} variant={r.confirmed ? "success" : raceBallots(r) > 0 ? "warning" : "secondary"}>{KIND_LABEL[r.kind]}{r.confirmed ? " ✓" : ""}</Badge>)}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Segmented
              value={race?.kind ?? "exec"} onChange={setKind}
              options={(["exec", "senate"] as const).filter((k) => kinds.includes(k)).map((k) => {
                const r = live.races.find((x) => x.school === activeSchool && x.kind === k)!;
                return { id: k, label: KIND_LABEL[k], dot: r.confirmed ? "bg-success" : raceBallots(r) > 0 ? "bg-warning" : "bg-muted-foreground/40" };
              })}
            />
          </div>

          {!counting && <p className="rounded-lg border border-border bg-muted/50 px-4 py-2.5 text-sm text-muted-foreground">{live.status === "ended" ? "The election has ended and counts are locked." : "Counting has not started. An admin opens it with Start counting."}</p>}

          {race && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold">{RACE_LABEL(race.race)}</h2>
                {race.round > 1 && <Badge variant="warning">Round {race.round} · recount</Badge>}
                {race.voided > 0 && <Badge variant="secondary">{race.voided} undone</Badge>}
                <div className="ml-auto flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" disabled={checking} onClick={checkNumbers}><ShieldCheck className="h-4 w-4" /> Check the numbers</Button>
                  {isAdmin && counting && <Button size="sm" variant="outline" onClick={() => setRecountOpen((v) => !v)}><RefreshCcw className="h-4 w-4" /> Recount this race</Button>}
                </div>
              </div>

              {recountOpen && (
                <div className="space-y-2 rounded-xl border border-warning/50 bg-warning/5 p-4">
                  <p className="text-sm font-medium">Start a recount of {RACE_LABEL(race.race)}</p>
                  <p className="text-xs text-muted-foreground">The next count starts from zero. The first count stays in the ballot history and is compared with the new one.</p>
                  <input value={recountReason} onChange={(e) => setRecountReason(e.target.value)} placeholder="Why is the race being recounted?" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                  <div className="flex gap-2">
                    <Button size="sm" disabled={recountReason.trim().length < 5} onClick={startRecount}>Start recount</Button>
                    <Button size="sm" variant="ghost" onClick={() => setRecountOpen(false)}>Cancel</Button>
                  </div>
                </div>
              )}

              {report && (
                <section className="rounded-xl border border-border bg-card shadow-sm">
                  <header className="flex items-center justify-between border-b border-border px-5 py-3">
                    <h2 className="text-base font-semibold">Check of the numbers</h2>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setReport(null)} aria-label="Close"><X className="h-4 w-4" /></Button>
                  </header>
                  <div className="p-5"><ReconciliationReport rec={report.rec} chain={report.chain} /></div>
                </section>
              )}

            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
              <BallotPaper race={race} selected={selected} onToggle={toggle} disabled={!canEdit} />

              <div className="space-y-4">
                <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="flex items-center gap-2 text-sm text-muted-foreground">Ballots counted{race.issued != null ? " / issued" : ""}<span className="inline-flex items-center gap-1 text-xs"><span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-ring" /> everyone counting, live · synced {ago(new Date(syncedAt).toISOString(), now)}</span></p>
                      <p className="text-4xl font-semibold tabular-nums tracking-tight">{counted}{race.issued != null && <span className="text-muted-foreground"> / {race.issued}</span>}</p>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      <p>Previous ballot</p>
                      <p className="mt-1 flex justify-end gap-1">{lastNums.length ? lastNums.map((n) => <span key={n} className="rounded-md bg-muted px-2 py-0.5 font-medium tabular-nums text-foreground">{n}</span>) : <span>–</span>}</p>
                    </div>
                  </div>
                  {race.issued != null && <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, race.issued ? (counted / race.issued) * 100 : 0)}%` }} /></div>}
                  {ballotFlags(race).map((f) => <p key={f.text} className="mt-3 flex items-center gap-2 text-sm text-danger"><AlertTriangle className="h-4 w-4" /> {f.text}</p>)}
                </section>

                <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <div className="mb-3 flex items-baseline justify-between">
                    <h2 className="text-base font-semibold">This ballot</h2>
                    <p className="text-sm text-muted-foreground">{race.maxChoices === 1 ? "Pick one" : `Pick up to ${race.maxChoices}`} · <span className="tabular-nums">{selected.length}</span> marked</p>
                  </div>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(3.25rem,1fr))] gap-2">
                    {race.candidates.map((c) => {
                      const on = selected.includes(c.id);
                      return (
                        <button
                          key={c.id} type="button" disabled={!canEdit} onClick={() => toggle(c.id)} aria-pressed={on} title={c.label}
                          className={cn("h-14 rounded-lg border-2 text-lg font-semibold tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-60", on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:border-primary/50 hover:bg-muted")}
                        >
                          {c.num}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Button size="lg" className="min-w-40 flex-1" disabled={!canEdit || !validSelection} onClick={() => record("valid")}>Record ballot <kbd className="ml-1 rounded bg-white/20 px-1.5 text-xs">Enter</kbd></Button>
                    <Button size="lg" variant="outline" disabled={!canEdit} onClick={() => record("invalid")}><Ban className="h-4 w-4" /> Invalid <kbd className="rounded bg-muted px-1.5 text-xs">I</kbd></Button>
                    <Button size="lg" variant="outline" disabled={!canEdit} onClick={() => record("blank")}><FileX2 className="h-4 w-4" /> Blank <kbd className="rounded bg-muted px-1.5 text-xs">B</kbd></Button>
                    <Button size="lg" variant="ghost" disabled={!canEdit || counted === 0} onClick={undo}><Undo2 className="h-4 w-4" /> Undo <kbd className="rounded bg-muted px-1.5 text-xs">Z</kbd></Button>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">Type a candidate's number to mark it, then press Enter.</p>
                </section>

                <section className="rounded-xl border border-border bg-card shadow-sm">
                  <div className="flex items-center justify-between border-b border-border px-5 py-3">
                    <h2 className="text-base font-semibold">Running totals</h2>
                    <p className="text-sm text-muted-foreground">{race.valid} valid · {race.invalid} invalid · {race.blank} blank</p>
                  </div>
                  <ul className="divide-y divide-border">
                    {race.candidates.map((c) => (
                      <li key={c.id} className="flex items-center gap-3 px-5 py-2 text-sm">
                        <span className="w-7 text-right tabular-nums text-muted-foreground">{c.num}</span>
                        <span className="min-w-0 flex-1 truncate font-medium">{c.label}</span>
                        <span className="w-16 text-right tabular-nums text-muted-foreground">{race.valid ? Math.round((c.votes / race.valid) * 1000) / 10 : 0}%</span>
                        <span className="w-12 text-right text-base font-semibold tabular-nums">{c.votes}</span>
                      </li>
                    ))}
                  </ul>
                </section>

                {race.rounds.length > 0 && (
                  <section className="rounded-xl border border-border bg-card shadow-sm">
                    <div className="border-b border-border px-5 py-3"><h2 className="text-base font-semibold">Recount comparison</h2><p className="text-sm text-muted-foreground">Votes in each round. A difference means the two counts disagree.</p></div>
                    <table className="w-full text-sm">
                      <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <tr><th className="px-5 py-2">Candidate</th>{race.rounds.map((r) => <th key={r.round} className="px-3 py-2 text-right">Round {r.round}</th>)}<th className="px-3 py-2 text-right">Round {race.round}</th><th className="px-5 py-2 text-right">Difference</th></tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {race.candidates.map((c) => {
                          const prev = race.rounds[race.rounds.length - 1].votes[c.id] ?? 0;
                          const d = c.votes - prev;
                          return (
                            <tr key={c.id}>
                              <td className="px-5 py-2 font-medium">{c.num}. {c.label}</td>
                              {race.rounds.map((r) => <td key={r.round} className="px-3 py-2 text-right tabular-nums text-muted-foreground">{r.votes[c.id] ?? 0}</td>)}
                              <td className="px-3 py-2 text-right font-semibold tabular-nums">{c.votes}</td>
                              <td className={cn("px-5 py-2 text-right tabular-nums", d !== 0 && "font-semibold text-danger")}>{d > 0 ? `+${d}` : d}</td>
                            </tr>
                          );
                        })}
                        <tr className="text-muted-foreground">
                          <td className="px-5 py-2">Invalid / blank</td>
                          {race.rounds.map((r) => <td key={r.round} className="px-3 py-2 text-right tabular-nums">{r.invalid} / {r.blank}</td>)}
                          <td className="px-3 py-2 text-right tabular-nums">{race.invalid} / {race.blank}</td><td className="px-5 py-2" />
                        </tr>
                      </tbody>
                    </table>
                  </section>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  {!race.confirmed && counting && (
                    <>
                      <Button variant="outline" disabled={race.countedByMe || counted === 0} onClick={() => run(() => api.confirm(race.race), "Count confirmed.")}><UserCheck className="h-4 w-4" /> Confirm this count</Button>
                      <p className="text-xs text-muted-foreground">{counted === 0 ? "Nothing counted yet." : race.countedByMe ? "You entered the last ballot. A different staff member must confirm." : "Check the totals against the paper ballots, then confirm."}</p>
                    </>
                  )}
                  {race.confirmed && (
                    <>
                      <p className="flex items-center gap-2 text-sm text-muted-foreground"><Lock className="h-4 w-4" /> Confirmed and locked.</p>
                      {isAdmin && counting && <Button variant="outline" size="sm" onClick={() => run(() => api.reopen(race.race), "Race reopened.")}><RotateCcw className="h-3.5 w-3.5" /> Reopen this race</Button>}
                    </>
                  )}
                </div>
              </div>
            </div>
            </div>
          )}
        </>
      )}
      {demo && <p className="text-xs text-muted-foreground">Preview mode: numbers are simulated in this browser tab.</p>}
    </div>
  );
}
