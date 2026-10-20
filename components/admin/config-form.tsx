"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Lock, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { ElectionConfig } from "@/lib/config";

const field = "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 20);

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

// The settings that make the platform reusable: names, schools, ballot rules and who may sign up. No code changes needed.
export function ConfigForm({ initial, locked }: { initial: ElectionConfig; locked: boolean }) {
  const router = useRouter();
  const [c, setC] = useState({ ...initial, emailDomains: initial.emailDomains.join(", ") });
  const [schools, setSchools] = useState(initial.schools);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof typeof c>(k: K, v: (typeof c)[K]) => setC((x) => ({ ...x, [k]: v }));
  const setSchool = (i: number, patch: Partial<(typeof schools)[number]>) => setSchools((l) => l.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  const save = async () => {
    setSaving(true);
    const payload = {
      organizationName: c.organizationName, siteName: c.siteName, tagline: c.tagline, logoUrl: c.logoUrl,
      emailDomains: c.emailDomains.split(/[,\s]+/).map((d) => d.replace(/^@/, "").trim()).filter(Boolean),
      schools: schools.map((s) => ({ ...s, key: slug(s.key || s.label) })),
      senateSeats: Number(c.senateSeats), senateMaxChoices: Number(c.senateMaxChoices), governmentLabel: c.governmentLabel, senateLabel: c.senateLabel,
    };
    const { error } = await createClient().rpc("save_config", { p: payload });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Settings saved.");
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-card shadow-sm">
        <header className="border-b border-border px-5 py-4"><h2 className="text-base font-semibold">Organization</h2><p className="text-sm text-muted-foreground">Shown in the site header, footer, sign-in pages and browser tab.</p></header>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Row label="Organization name"><input className={field} value={c.organizationName} onChange={(e) => set("organizationName", e.target.value)} /></Row>
          <Row label="Site name" hint="For example: ASK Votes"><input className={field} value={c.siteName} onChange={(e) => set("siteName", e.target.value)} /></Row>
          <Row label="Tagline" hint="For example: Student Government"><input className={field} value={c.tagline} onChange={(e) => set("tagline", e.target.value)} /></Row>
          <Row label="Logo address" hint="A path on this site (/images/logo.png) or a full web address.">
            <div className="flex items-center gap-3">
              <input className={field} value={c.logoUrl} onChange={(e) => set("logoUrl", e.target.value)} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.logoUrl} alt="" className="h-10 w-10 shrink-0 rounded-full border border-border object-contain" />
            </div>
          </Row>
          <div className="sm:col-span-2"><Row label="Who can sign up" hint="School email domains, separated by commas. Subdomains are included. Leave empty to allow any address."><input className={field} value={c.emailDomains} onChange={(e) => set("emailDomains", e.target.value)} placeholder="school.org" /></Row></div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card shadow-sm">
        <header className="border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold">Schools</h2>
          <p className="text-sm text-muted-foreground">Each school has its own Government and Senate vote and is counted separately. Students are placed in a school by their grade.</p>
          {locked && <p className="mt-2 flex items-center gap-2 rounded-md bg-warning/10 px-3 py-2 text-sm text-warning"><Lock className="h-4 w-4" /> Ballots have been entered, so schools and grade ranges are locked. Names can still be corrected.</p>}
        </header>
        <div className="space-y-3 p-5">
          {schools.map((s, i) => (
            <div key={i} className="grid items-end gap-3 rounded-lg border border-border p-3 sm:grid-cols-[1.5fr_1fr_5rem_5rem_auto]">
              <Row label="Name"><input className={field} value={s.label} onChange={(e) => setSchool(i, { label: e.target.value, key: initial.schools.some((o) => o.key === s.key) ? s.key : slug(e.target.value) })} /></Row>
              <Row label="Key"><input className={field} value={s.key} disabled readOnly /></Row>
              <Row label="From grade"><input type="number" className={field} value={s.minGrade} disabled={locked} onChange={(e) => setSchool(i, { minGrade: Number(e.target.value) })} /></Row>
              <Row label="To grade"><input type="number" className={field} value={s.maxGrade} disabled={locked} onChange={(e) => setSchool(i, { maxGrade: Number(e.target.value) })} /></Row>
              <Button type="button" variant="ghost" size="icon" disabled={locked || schools.length <= 1} onClick={() => setSchools((l) => l.filter((_, j) => j !== i))} aria-label="Remove school"><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" disabled={locked || schools.length >= 8} onClick={() => setSchools((l) => [...l, { key: "", label: "", minGrade: 0, maxGrade: 0 }])}><Plus className="h-4 w-4" /> Add a school</Button>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card shadow-sm">
        <header className="border-b border-border px-5 py-4"><h2 className="text-base font-semibold">Ballots</h2><p className="text-sm text-muted-foreground">How the two votes are named and counted.</p></header>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Row label="Name of the team vote" hint="Printed on the ballot, for example: Government"><input className={field} value={c.governmentLabel} onChange={(e) => set("governmentLabel", e.target.value)} /></Row>
          <Row label="Name of the individual vote" hint="For example: Senator"><input className={field} value={c.senateLabel} onChange={(e) => set("senateLabel", e.target.value)} /></Row>
          <Row label="Senate seats per school" hint="How many of the top vote-getters win."><input type="number" min={1} max={50} className={field} value={c.senateSeats} onChange={(e) => set("senateSeats", Number(e.target.value))} /></Row>
          <Row label="Votes per Senate ballot" hint={locked ? "Locked once ballots have been entered." : "How many people a student may mark."}><input type="number" min={1} max={10} className={field} disabled={locked} value={c.senateMaxChoices} onChange={(e) => set("senateMaxChoices", Number(e.target.value))} /></Row>
        </div>
      </section>

      <div className="flex justify-end"><Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save settings"}</Button></div>
    </div>
  );
}
