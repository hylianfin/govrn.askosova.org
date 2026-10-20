"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/primitives";
import type { CountApi } from "@/components/counting/api";
import { useLabels } from "@/components/config-provider";
import type { IntegritySetting } from "@/lib/live";

type Form = { printedGovernment: string; printedSenate: string; issued: string; registered: string; note: string };
const toForm = (s: IntegritySetting): Form => ({
  printedGovernment: s.printedGovernment?.toString() ?? "", printedSenate: s.printedSenate?.toString() ?? "",
  issued: s.issuedOverride?.toString() ?? "", registered: s.registeredOverride?.toString() ?? "", note: s.note ?? "",
});
const num = (v: string) => (v.trim() === "" ? null : Math.max(0, Math.floor(Number(v) || 0)));

function Field({ label, hint, value, onChange, disabled }: { label: string; hint: string; value: string; onChange: (v: string) => void; disabled: boolean }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{label}</span>
      <input type="number" min={0} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} placeholder="Not set" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm tabular-nums placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60" />
      <span className="block text-xs text-muted-foreground">{hint}</span>
    </label>
  );
}

// The numbers the count is checked against: ballots printed, ballots given out, and people registered to vote.
export function IntegritySettings({ api, initial, isAdmin }: { api: CountApi; initial: IntegritySetting[]; isAdmin: boolean }) {
  const { school: schoolName, cfg } = useLabels();
  const [settings, setSettings] = useState(initial);
  const [forms, setForms] = useState<Record<string, Form>>(() => Object.fromEntries(initial.map((s) => [s.school, toForm(s)])));
  const [saving, setSaving] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const next = await api.integrity();
    setSettings(next);
    setForms((f) => { const out = { ...f }; for (const s of next) if (!(s.school in out)) out[s.school] = toForm(s); return out; });
  }, [api]);
  useEffect(() => { if (initial.length === 0) reload(); }, [initial.length, reload]);
  useEffect(() => api.subscribe(() => { reload(); }), [api, reload]);

  const save = async (s: IntegritySetting) => {
    const f = forms[s.school];
    setSaving(s.school);
    try {
      await api.saveIntegrity({ school: s.school, printedGovernment: num(f.printedGovernment), printedSenate: num(f.printedSenate), issued: num(f.issued), registered: num(f.registered), note: f.note.trim() || null });
      toast.success(`${schoolName(s.school)} numbers saved.`);
      await reload();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not save."); }
    setSaving(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Admin console" title="Election integrity" description="Tell the system how many ballots were printed, how many were given out and how many students can vote. At the end of the count these are compared with the ballots counted, and any mismatch is reported to every admin." />
      <div className="grid gap-6 lg:grid-cols-2">
        {settings.map((s) => {
          const f = forms[s.school] ?? toForm(s);
          const set = (k: keyof Form) => (v: string) => setForms({ ...forms, [s.school]: { ...f, [k]: v } });
          const issued = num(f.issued) ?? s.issuedAuto, reg = num(f.registered) ?? s.registeredAuto, pg = num(f.printedGovernment), ps = num(f.printedSenate);
          const warnings = [
            pg != null && issued > pg ? `More ${cfg.governmentLabel} ballots given (${issued}) than printed (${pg}).` : null,
            ps != null && issued > ps ? `More ${cfg.senateLabel} ballots given (${issued}) than printed (${ps}).` : null,
            issued > reg ? `More ballots given (${issued}) than registered voters (${reg}).` : null,
          ].filter(Boolean) as string[];
          return (
            <section key={s.school} className="rounded-xl border border-border bg-card shadow-sm">
              <header className="flex items-center justify-between border-b border-border px-5 py-4">
                <h2 className="text-base font-semibold">{schoolName(s.school)}</h2>
                {s.locked && <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Lock className="h-3.5 w-3.5" /> Locked, the election has ended</span>}
              </header>
              <div className="grid gap-4 p-5 sm:grid-cols-2">
                <Field label={`${cfg.governmentLabel} ballots printed`} hint={`Paper ballots made for the ${cfg.governmentLabel} vote.`} value={f.printedGovernment} onChange={set("printedGovernment")} disabled={!isAdmin || s.locked} />
                <Field label={`${cfg.senateLabel} ballots printed`} hint={`Paper ballots made for the ${cfg.senateLabel} vote.`} value={f.printedSenate} onChange={set("printedSenate")} disabled={!isAdmin || s.locked} />
                <Field label="Ballots given to voters" hint={`Leave empty to use the polling-desk check-ins (${s.issuedAuto} so far).`} value={f.issued} onChange={set("issued")} disabled={!isAdmin || s.locked} />
                <Field label="Registered to vote" hint={`Leave empty to use the students on the platform (${s.registeredAuto}).`} value={f.registered} onChange={set("registered")} disabled={!isAdmin || s.locked} />
                <label className="block space-y-1 sm:col-span-2">
                  <span className="text-sm font-medium">Note</span>
                  <input value={f.note} disabled={!isAdmin || s.locked} onChange={(e) => set("note")(e.target.value)} placeholder="For example: 20 spare ballots kept in the office" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60" />
                </label>
              </div>
              {warnings.length > 0 && (
                <ul className="mx-5 mb-4 space-y-1 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
                  {warnings.map((w) => <li key={w} className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />{w}</li>)}
                </ul>
              )}
              <footer className="flex items-center justify-between gap-3 border-t border-border px-5 py-3">
                <p className="text-xs text-muted-foreground">{s.updatedAt ? `Last saved ${new Date(s.updatedAt).toLocaleString("en-GB")}. Every change is written to the audit log.` : "Not saved yet."}</p>
                {isAdmin && <Button size="sm" disabled={s.locked || saving === s.school} onClick={() => save(s)}>Save</Button>}
              </footer>
            </section>
          );
        })}
      </div>
    </div>
  );
}
