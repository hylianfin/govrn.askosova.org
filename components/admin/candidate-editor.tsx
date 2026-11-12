"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ClipboardPaste, Lock, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useLabels } from "@/components/config-provider";

export type CandidateList = {
  race: string; school: string; kind: "exec" | "senate"; manual: boolean; locked: boolean;
  candidates: { num: number; label: string; sub: string | null; members: { role: string; name: string }[] }[];
};

const ROLES = [
  { key: "president", label: "President" },
  { key: "vice_president", label: "Vice President" },
  { key: "secretary", label: "Secretary" },
  { key: "treasurer", label: "Treasurer" },
];
type Row = { label: string; roles: string[] };

const toRows = (l: CandidateList): Row[] =>
  l.candidates.map((c) => ({ label: c.label, roles: ROLES.map((r) => c.members.find((m) => m.role === r.key)?.name ?? "") }));
const blank = (): Row => ({ label: "", roles: ROLES.map(() => "") });
const input = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";

// One table per race. Row order is the number printed on the ballot.
export function CandidateEditor({ lists }: { lists: CandidateList[] }) {
  const router = useRouter();
  const { race: raceLabel } = useLabels();
  const [rows, setRows] = useState<Record<string, Row[]>>(() => Object.fromEntries(lists.map((l) => [l.race, toRows(l)])));
  const [saved, setSaved] = useState<Record<string, string>>(() => Object.fromEntries(lists.map((l) => [l.race, JSON.stringify(toRows(l))])));
  const [paste, setPaste] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const edit = (race: string, fn: (r: Row[]) => Row[]) => setRows((x) => ({ ...x, [race]: fn(x[race] ?? []) }));
  const move = (race: string, i: number, d: number) => edit(race, (r) => { const j = i + d; if (j < 0 || j >= r.length) return r; const c = [...r]; [c[i], c[j]] = [c[j], c[i]]; return c; });

  const save = async (l: CandidateList) => {
    const list = (rows[l.race] ?? []).filter((r) => r.label.trim());
    setBusy(l.race);
    const entries = list.map((r) => ({
      label: r.label.trim(),
      members: l.kind === "exec" ? ROLES.map((role, i) => ({ role: role.key, name: r.roles[i].trim() })).filter((m) => m.name) : [],
    }));
    const { error } = await createClient().rpc("save_candidates", { p_race: l.race, p_entries: entries });
    setBusy(null);
    if (error) return toast.error(error.message);
    setRows((x) => ({ ...x, [l.race]: list.length ? list : [] }));
    setSaved((x) => ({ ...x, [l.race]: JSON.stringify(list) }));
    toast.success(`${raceLabel(l.race)} saved: ${list.length} on the ballot.`);
    router.refresh();
  };

  const addPasted = (l: CandidateList) => {
    const names = (paste[l.race] ?? "").split("\n").map((n) => n.replace(/^\s*\d+[.)]\s*/, "").trim()).filter(Boolean);
    edit(l.race, (r) => [...r.filter((x) => x.label.trim() || x.roles.some(Boolean)), ...names.map((label) => ({ ...blank(), label }))]);
    setPaste((p) => ({ ...p, [l.race]: null }));
  };

  return (
    <div className="space-y-6">
      {lists.map((l) => {
        const list = rows[l.race] ?? [];
        const dirty = JSON.stringify(list.filter((r) => r.label.trim())) !== saved[l.race];
        const isExec = l.kind === "exec";
        return (
          <section key={l.race} className="rounded-xl border border-border bg-card shadow-sm">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
              <h2 className="font-display text-lg font-bold uppercase text-navy">{raceLabel(l.race)} <span className="ml-1 text-sm font-normal normal-case text-muted-foreground">{list.filter((r) => r.label.trim()).length} on the ballot</span></h2>
              {l.locked
                ? <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Lock className="h-3 w-3" /> Locked, counting has started</span>
                : <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setPaste((p) => ({ ...p, [l.race]: p[l.race] == null ? "" : null }))}><ClipboardPaste className="h-4 w-4" /> Paste names</Button>
                    <Button size="sm" variant="outline" onClick={() => edit(l.race, (r) => [...r, blank()])}><Plus className="h-4 w-4" /> Add {isExec ? "team" : "name"}</Button>
                  </div>}
            </header>

            {paste[l.race] != null && (
              <div className="space-y-2 border-b border-border bg-muted/40 p-4">
                <p className="text-xs text-muted-foreground">One {isExec ? "team name" : "name"} per line. Leading numbers like "1." are removed. They are added to the end of the table.</p>
                <textarea value={paste[l.race] ?? ""} onChange={(e) => setPaste((p) => ({ ...p, [l.race]: e.target.value }))} rows={5} autoFocus className="w-full rounded-md border border-input bg-background p-2 text-sm" />
                <Button size="sm" onClick={() => addPasted(l)}>Add to table</Button>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="w-12 px-3 py-2">No.</th>
                    <th className="px-2 py-2">{isExec ? "Team" : "Name"}</th>
                    {isExec && ROLES.map((r) => <th key={r.key} className="px-2 py-2">{r.label}</th>)}
                    <th className="w-28 px-2 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {list.map((r, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 font-display text-lg font-bold text-danger">{i + 1}</td>
                      <td className="px-2 py-1.5"><input className={input} value={r.label} disabled={l.locked} placeholder={isExec ? "Team name" : "Full name"} onChange={(e) => edit(l.race, (x) => x.map((y, j) => (j === i ? { ...y, label: e.target.value } : y)))} /></td>
                      {isExec && ROLES.map((role, k) => (
                        <td key={role.key} className="px-2 py-1.5"><input className={input} value={r.roles[k]} disabled={l.locked} onChange={(e) => edit(l.race, (x) => x.map((y, j) => (j === i ? { ...y, roles: y.roles.map((v, m) => (m === k ? e.target.value : v)) } : y)))} /></td>
                      ))}
                      <td className="px-2 py-1.5">
                        {!l.locked && (
                          <div className="flex justify-end gap-0.5">
                            <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => move(l.race, i, -1)} className="rounded p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                            <button type="button" aria-label="Move down" disabled={i === list.length - 1} onClick={() => move(l.race, i, 1)} className="rounded p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                            <button type="button" aria-label="Remove" onClick={() => edit(l.race, (x) => x.filter((_, j) => j !== i))} className="rounded p-1.5 text-danger hover:bg-danger/10"><Trash2 className="h-4 w-4" /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {list.length === 0 && <tr><td colSpan={isExec ? 7 : 3} className="px-4 py-6 text-center text-muted-foreground">No one on this ballot yet.</td></tr>}
                </tbody>
              </table>
            </div>

            <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3">
              <p className="text-xs text-muted-foreground">
                The number is the row order, so it must match the printed ballot.
                {!l.manual && l.candidates.length > 0 && " These came from approved applications; saving replaces them."}
              </p>
              {!l.locked && <Button size="sm" disabled={!dirty || busy === l.race} onClick={() => save(l)}>{busy === l.race ? "Saving…" : dirty ? "Save changes" : "Saved"}</Button>}
            </footer>
          </section>
        );
      })}
      <p className="text-sm text-muted-foreground">
        When the lists are saved, <Link href="/admin/election-results" className="font-medium text-primary underline-offset-4 hover:underline">open Counting</Link> and press Start counting.
      </p>
    </div>
  );
}
