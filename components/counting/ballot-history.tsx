"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, ShieldCheck, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader, StatTile, EmptyState } from "@/components/dashboard/primitives";
import type { CountApi } from "@/components/counting/api";
import { useLabels } from "@/components/config-provider";
import type { ChainStatus, HistoryData, HistoryRow } from "@/lib/live";

const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const stamp = (iso: string) => new Date(iso).toLocaleString("en-GB");

function Marks({ row }: { row: HistoryRow }) {
  if (row.kind === "invalid") return <Badge variant="danger">Invalid</Badge>;
  if (row.kind === "blank") return <Badge variant="secondary">Blank</Badge>;
  return <span className="flex flex-wrap gap-1">{row.marks.map((m) => <span key={m} className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-semibold tabular-nums">{m}</span>)}</span>;
}

// Every ballot ever entered, including the ones that were undone. Nothing here can be edited or removed.
export function BallotHistory({ api, eyebrow }: { api: CountApi; eyebrow: string }) {
  const { cfg, race: raceName } = useLabels();
  const RACES = cfg.schools.flatMap((s) => [`exec-${s.key}`, `senate-${s.key}`]);
  const [race, setRace] = useState<string | null>(null);
  const [data, setData] = useState<HistoryData | null>(null);
  const [chain, setChain] = useState<ChainStatus | null>(null);
  const [counter, setCounter] = useState<string | null>(null);
  const [showVoided, setShowVoided] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setData(await api.history(race, 1000)); } catch (e) { toast.error(e instanceof Error ? e.message : "Could not load the history."); }
  }, [api, race]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    const off = api.subscribe(() => { if (t) clearTimeout(t); t = setTimeout(load, 200); });
    return () => { off(); if (t) clearTimeout(t); };
  }, [api, load]);

  const rows = useMemo(() => (data?.rows ?? []).filter((r) => (showVoided || !r.voided) && (!counter || r.byId === counter)), [data, showVoided, counter]);
  const active = data ? data.counters.reduce((n, c) => n + c.active, 0) : 0;
  const voided = data ? data.counters.reduce((n, c) => n + c.voided, 0) : 0;

  const verify = async () => {
    setBusy(true);
    try { setChain(await api.verifyChain()); } catch (e) { toast.error(e instanceof Error ? e.message : "Could not check the history."); }
    setBusy(false);
  };

  const exportCsv = () => {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = [["Ballot", "Time", "Race", "Round", "Counter", "Type", "Marks", "Status", "Voided by", "Voided at", "Fingerprint"].map(esc).join(",")];
    for (const r of rows) lines.push([r.seq, stamp(r.at), raceName(r.race), r.round, r.by, r.kind, r.marks.join(" "), r.voided ? "Voided" : "Counted", r.voidedBy ?? "", r.voidedAt ? stamp(r.voidedAt) : "", r.hash].map(esc).join(","));
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "ballot-history.csv"; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={eyebrow}
        title="Ballot history"
        description="Every ballot that was entered, who entered it and when. Undone ballots stay on the list as voided. Nothing can be edited or deleted."
        actions={
          <>
            <Button variant="outline" size="sm" disabled={busy} onClick={verify}>{chain && !chain.ok ? <ShieldAlert className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />} Verify history</Button>
            <Button variant="outline" size="sm" disabled={rows.length === 0} onClick={exportCsv}><Download className="h-4 w-4" /> Export CSV</Button>
          </>
        }
      />

      {chain && (
        <p className={cn("flex items-center gap-2 rounded-lg border px-4 py-3 text-sm", chain.ok ? "border-success/40 bg-success/5" : "border-danger/40 bg-danger/5 text-danger")}>
          {chain.ok ? <ShieldCheck className="h-4 w-4 text-success" /> : <ShieldAlert className="h-4 w-4" />}
          {chain.ok ? `All ${chain.checked} ballots are intact. None was removed or changed after it was entered.` : `The history was tampered with: ballot(s) ${chain.broken.join(", ")} are missing or changed.`}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Ballots entered" value={active + voided} hint={race ? raceName(race) : "All races"} />
        <StatTile label="Counted" value={active} tone="success" />
        <StatTile label="Voided (undone)" value={voided} tone={voided > 0 ? "warning" : "default"} />
      </div>

      {data && data.counters.length > 0 && (
        <section className="rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-5 py-3"><h2 className="text-base font-semibold">By counter</h2></div>
          <ul className="divide-y divide-border">
            {data.counters.map((c) => {
              const rate = c.active + c.voided ? c.voided / (c.active + c.voided) : 0;
              return (
                <li key={c.id ?? c.name}>
                  <button type="button" onClick={() => setCounter(counter === c.id ? null : c.id)} className={cn("flex w-full flex-wrap items-center gap-x-6 gap-y-1 px-5 py-2.5 text-left text-sm hover:bg-muted/40", counter === c.id && "bg-primary/5")}>
                    <span className="min-w-40 flex-1 font-medium">{c.name}</span>
                    <span className="text-muted-foreground">Counted <b className="tabular-nums text-foreground">{c.active}</b></span>
                    <span className="text-muted-foreground">Voided <b className="tabular-nums text-foreground">{c.voided}</b></span>
                    <span className="text-xs text-muted-foreground">{time(c.first)} to {time(c.last)}</span>
                    {rate > 0.1 && c.active + c.voided >= 10 && <Badge variant="warning">{Math.round(rate * 100)}% undone</Badge>}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex flex-wrap rounded-lg border border-border bg-card p-1">
          {[null, ...RACES].map((r) => (
            <button key={r ?? "all"} onClick={() => setRace(r)} className={cn("rounded-md px-3 py-1.5 text-sm font-medium transition-colors", race === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>{r ? raceName(r) : "All races"}</button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={showVoided} onChange={(e) => setShowVoided(e.target.checked)} /> Show voided ballots</label>
        {counter && <Button size="sm" variant="ghost" onClick={() => setCounter(null)}>Clear counter filter</Button>}
      </div>

      {!data ? <EmptyState>Loading the history…</EmptyState> : rows.length === 0 ? <EmptyState>No ballots have been entered yet.</EmptyState> : (
        <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/80 text-left text-xs uppercase tracking-wide text-muted-foreground backdrop-blur">
                <tr><th className="px-4 py-2.5">#</th><th className="px-4 py-2.5">Time</th><th className="px-4 py-2.5">Race</th><th className="px-4 py-2.5">Round</th><th className="px-4 py-2.5">Counter</th><th className="px-4 py-2.5">Ballot</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5">Fingerprint</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.seq} className={cn(r.voided && "bg-muted/40 text-muted-foreground")}>
                    <td className="px-4 py-2 tabular-nums">{r.seq}</td>
                    <td className="whitespace-nowrap px-4 py-2 tabular-nums">{time(r.at)}</td>
                    <td className="whitespace-nowrap px-4 py-2">{raceName(r.race)}</td>
                    <td className="px-4 py-2 tabular-nums">{r.round}</td>
                    <td className="whitespace-nowrap px-4 py-2">{r.by}</td>
                    <td className={cn("px-4 py-2", r.voided && "opacity-60")}><Marks row={r} /></td>
                    <td className="whitespace-nowrap px-4 py-2">{r.voided ? <span className="text-xs">Voided by {r.voidedBy} at {r.voidedAt ? time(r.voidedAt) : ""}</span> : <Badge variant="success">Counted</Badge>}</td>
                    <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{r.hash}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">Showing {rows.length} of {data.total} ballots. The fingerprint links each ballot to the one before it, so a removed or changed ballot is detected.</p>
        </section>
      )}
    </div>
  );
}
