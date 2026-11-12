"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";
import { raceLabel, type ElectionConfig } from "@/lib/config";

type Member = { role: string; name: string };
export type Entry = { num: number; label: string; sub: string | null; members: Member[]; votes?: number };
export type Race = { race: string; kind: "exec" | "senate"; school?: string; schoolLabel?: string; candidates: Entry[]; seats?: number; valid?: number; invalid?: number; blank?: number; confirmed?: boolean };
type Results = { status: "not_started" | "counting" | "ended"; races: Race[] };

const ROLE: Record<string, string> = { president: "President", vice_president: "Vice President", secretary: "Secretary", treasurer: "Treasurer" };

// The public board: who is running, and, once counting has started, the votes as they come in.
export function HomeBoard({ config, candidates, results }: { config: ElectionConfig; candidates: Race[]; results: Results | null }) {
  const [res, setRes] = useState<Results | null>(results);
  const [at, setAt] = useState<Date | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let alive = true;
    const load = async () => {
      const { data, error } = await supabase.rpc("public_results");
      if (alive && !error && data) { setRes(data as Results); setAt(new Date()); }
    };
    load();
    const t = setInterval(load, 5000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const live = !!res && res.status !== "not_started" && res.races.length > 0;
  const races = live ? res!.races : candidates;

  const schools = [...new Set(races.map((r) => r.school ?? ""))];

  return (
    <div className="space-y-10">
      {live && (
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-y-2 border-navy bg-card px-4 py-3">
          <span className={cn("inline-flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wider", res!.status === "counting" ? "text-danger" : "text-navy")}>
            {res!.status === "counting" && <span className="h-2 w-2 rounded-full bg-danger animate-pulse-ring" />}
            {res!.status === "counting" ? "Counting in progress" : "Count complete"}
          </span>
          <span className="text-sm text-muted-foreground">Unofficial results{at ? ` · updated ${at.toLocaleTimeString("en-GB")}` : ""}</span>
        </div>
      )}
      {races.length === 0 && <p className="text-muted-foreground">The candidates will be listed here soon.</p>}
      {live
        ? schools.map((sc) => (
            <section key={sc}>
              <h2 className="bg-navy px-4 py-2.5 font-display text-lg font-bold uppercase tracking-wider text-white">{races.find((r) => (r.school ?? "") === sc)?.schoolLabel ?? "Results"}</h2>
              <div className="grid gap-px bg-border lg:grid-cols-2">
                {races.filter((r) => (r.school ?? "") === sc).map((r) => <ResultsPanel key={r.race} r={r} config={config} />)}
              </div>
            </section>
          ))
        : races.map((r) => <CandidateTable key={r.race} r={r} config={config} />)}
    </div>
  );
}

// Live: a formal results table, like a government election site. Marks the leader (or the seats) with a tick.
function ResultsPanel({ r, config }: { r: Race; config: ElectionConfig }) {
  const isExec = r.kind === "exec";
  const seats = isExec ? 1 : r.seats ?? 1;
  const valid = r.valid ?? 0;
  const ranked = [...r.candidates].sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0) || a.num - b.num);
  const top = Math.max(1, ranked[0]?.votes ?? 0);
  return (
    <div className="bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h3 className="font-display text-base font-bold uppercase tracking-wide text-navy">{config[isExec ? "governmentLabel" : "senateLabel"]}</h3>
        <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider", r.confirmed ? "bg-success/15 text-success" : "bg-warning/15 text-warning")}>{r.confirmed ? "Confirmed" : "Counting"}</span>
      </div>
      <table className="w-full text-left text-sm">
        <thead className="text-[11px] uppercase tracking-wider text-muted-foreground">
          <tr><th className="px-4 py-2 font-semibold">{isExec ? "Team" : "Candidate"}</th><th className="px-2 py-2 text-right font-semibold">Votes</th><th className="w-14 px-4 py-2 text-right font-semibold">%</th></tr>
        </thead>
        <tbody>
          {ranked.map((c, i) => {
            const v = c.votes ?? 0;
            const pct = valid > 0 ? (v / valid) * 100 : 0;
            const lead = v > 0 && i < seats;
            return (
              <tr key={c.num} className={cn("border-t border-border align-top", lead && "bg-success/5")}>
                <td className="px-4 py-2.5">
                  <div className="flex items-start gap-2">
                    <span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full", lead ? "bg-success text-white" : "bg-transparent text-transparent")}><Check className="h-3.5 w-3.5" strokeWidth={3} /></span>
                    <div className="min-w-0">
                      <p className={cn("leading-tight", isExec ? "font-display text-base font-bold uppercase text-navy" : "font-semibold", lead && "text-navy")}>{c.label}</p>
                      {isExec && c.members.length > 0 && <p className="mt-0.5 text-xs text-muted-foreground">{c.members.map((m) => m.name).join(", ")}</p>}
                      <div className="mt-1.5 h-1.5 w-full max-w-[220px] overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full transition-all duration-700", lead ? "bg-success" : "bg-navy/60")} style={{ width: `${(v / top) * 100}%` }} /></div>
                    </div>
                  </div>
                </td>
                <td className="px-2 py-2.5 text-right font-display text-lg font-bold tabular-nums">{v.toLocaleString("en-GB")}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{pct.toFixed(1)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="border-t-2 border-navy text-xs">
          <tr><td className="px-4 py-2 font-semibold uppercase tracking-wider text-muted-foreground">Valid ballots</td><td className="px-2 py-2 text-right font-semibold tabular-nums">{valid}</td><td /></tr>
          {(r.invalid ?? 0) > 0 && <tr><td className="px-4 pb-2 text-muted-foreground">Invalid</td><td className="px-2 pb-2 text-right tabular-nums text-muted-foreground">{r.invalid}</td><td /></tr>}
          {(r.blank ?? 0) > 0 && <tr><td className="px-4 pb-2 text-muted-foreground">Blank</td><td className="px-2 pb-2 text-right tabular-nums text-muted-foreground">{r.blank}</td><td /></tr>}
        </tfoot>
      </table>
      {!isExec && <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">Top {seats} win a seat (✓). Each ballot can mark up to {config.senateMaxChoices}, so percentages add up to more than 100.</p>}
    </div>
  );
}

// Before counting: the candidates in ballot order.
function CandidateTable({ r, config }: { r: Race; config: ElectionConfig }) {
  const isExec = r.kind === "exec";
  return (
    <section>
      <h2 className="border-b-2 border-navy pb-2 font-display text-2xl font-bold uppercase text-navy">{raceLabel(config, r.race)}</h2>
      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="bg-navy font-display text-xs uppercase tracking-wider text-white">
            <tr>
              <th className="w-14 px-4 py-3">No.</th>
              <th className="px-4 py-3">{isExec ? "Team" : "Name"}</th>
              {isExec && Object.values(ROLE).map((x) => <th key={x} className="px-4 py-3">{x}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {r.candidates.map((c) => (
              <tr key={c.num}>
                <td className="px-4 py-3 font-display text-xl font-bold text-danger">{c.num}</td>
                <td className={cn("px-4 py-3", isExec ? "font-display text-base font-semibold uppercase text-navy" : "font-medium")}>{c.label}</td>
                {isExec && Object.keys(ROLE).map((k) => <td key={k} className="px-4 py-3">{c.members.find((m) => m.role === k)?.name ?? ""}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
