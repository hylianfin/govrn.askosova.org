"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link2, Search, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { assignImportedEmail, deleteImported, linkImportedNow } from "@/lib/actions/import";

export type ImportedRow = {
  id: string; kind: "executive_team" | "senate"; email: string | null; name: string | null; teamName: string | null;
  status: "pending" | "linked" | "skipped"; note: string | null; submittedAt: string | null; importedAt: string; linkedAt: string | null; applicationId: string | null; answered: number;
  suggestions: { email: string; name: string; confirmed: boolean }[];
};

const STATUS = {
  pending: { label: "Waiting for sign-up", variant: "warning" as const },
  linked: { label: "Linked", variant: "success" as const },
  skipped: { label: "Skipped", variant: "secondary" as const },
};
const date = (s: string) => new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

function AttachEmail({ row, onDone }: { row: ImportedRow; onDone: (msg: string) => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  function attach(email: string) {
    setError(null);
    startTransition(async () => {
      const r = await assignImportedEmail(row.id, email);
      if (!r.ok) { setError(r.error); return; }
      onDone(r.linked > 0 ? `Linked ${row.name ?? email} to ${email}. Their application was created.` : `Saved ${email} for ${row.name ?? "this response"}. It links when they sign up and confirm that email.`);
    });
  }
  return (
    <div className="w-full space-y-2 rounded-lg bg-muted/60 p-3">
      <p className="text-xs font-medium text-muted-foreground">No email in the file. Attach this response to an account:</p>
      {row.suggestions.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {row.suggestions.map((s) => (
            <li key={s.email}>
              <button type="button" disabled={pending} onClick={() => { if (confirm(`Attach this response to ${s.name} (${s.email})? Check it is the same person.`)) attach(s.email); }}
                className="rounded-full border border-primary/40 bg-card px-3 py-1 text-xs font-medium text-primary hover:bg-primary/5">
                {s.name} · {s.email}{s.confirmed ? "" : " (not confirmed yet)"}
              </button>
            </li>
          ))}
        </ul>
      )}
      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); if (value.trim()) attach(value); }}>
        <input type="email" aria-label={`Email for ${row.name ?? "response"}`} value={value} onChange={(e) => setValue(e.target.value)} placeholder="name@askosova.org"
          className="h-9 min-w-[14rem] flex-1 rounded-md border border-border bg-card px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
        <Button type="submit" size="sm" disabled={pending || !value.trim()}>Attach</Button>
      </form>
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    </div>
  );
}

export function ImportedList({ rows }: { rows: ImportedRow[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | ImportedRow["status"]>("all");
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const counts = useMemo(() => ({ pending: rows.filter((r) => r.status === "pending").length, linked: rows.filter((r) => r.status === "linked").length, skipped: rows.filter((r) => r.status === "skipped").length }), [rows]);
  const noEmail = rows.filter((r) => r.status === "pending" && !r.email).length;
  const shown = rows.filter((r) => (filter === "all" || r.status === filter) && (!q.trim() || `${r.email ?? ""} ${r.name ?? ""} ${r.teamName ?? ""}`.toLowerCase().includes(q.trim().toLowerCase())));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(["all", "pending", "linked", "skipped"] as const).map((f) => (
          <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}
            className={cn("rounded-full border px-3 py-1 text-xs font-medium", filter === f ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-muted")}>
            {f === "all" ? "All" : STATUS[f].label} <span className="opacity-70">{f === "all" ? rows.length : counts[f]}</span>
          </button>
        ))}
        <div className="relative ml-auto min-w-[14rem] flex-1 sm:flex-none">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input type="search" aria-label="Search imported responses" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search email or name"
            className="h-9 w-full rounded-md border border-border bg-card pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
        </div>
        <Button size="sm" variant="outline" disabled={pending || counts.pending === 0}
          onClick={() => startTransition(async () => { const r = await linkImportedNow(); setMsg(r.ok ? `${r.linked} linked.` : r.error); router.refresh(); })}>
          <Link2 className="h-4 w-4" /> Link now
        </Button>
      </div>
      {noEmail > 0 && <p className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-2 text-sm text-warning">{noEmail} response{noEmail > 1 ? "s have" : " has"} no email yet. Attach an account to each one below so it can become an application.</p>}
      {msg && <p role="status" className="text-sm text-muted-foreground">{msg}</p>}

      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {shown.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{r.teamName || r.name || r.email}</p>
              <p className="truncate text-xs text-muted-foreground">
                {r.email ?? "no email yet"} · {r.kind === "executive_team" ? "Executive Team" : "Senate"} · {r.answered} answers
                {r.submittedAt ? ` · sent ${date(r.submittedAt)}` : ""} · imported {date(r.importedAt)}
              </p>
              {r.note && <p className="text-xs text-muted-foreground">{r.note}</p>}
            </div>
            <Badge variant={r.status === "pending" && !r.email ? "danger" : STATUS[r.status].variant}>{r.status === "pending" && !r.email ? "Needs an account" : STATUS[r.status].label}</Badge>
            {r.applicationId && <a href={`/staff/applications/${r.applicationId}`} className="text-sm font-medium text-primary hover:underline">Open</a>}
            {r.status === "pending" && !r.email && <AttachEmail row={r} onDone={(m) => { setMsg(m); router.refresh(); }} />}
            {r.status === "pending" && (
              <button aria-label={`Delete import for ${r.email ?? r.name}`} disabled={pending}
                onClick={() => { if (confirm(`Remove the imported response for ${r.email ?? r.name}? This cannot be undone.`)) startTransition(async () => { await deleteImported(r.id); router.refresh(); }); }}
                className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-danger"><Trash2 className="h-4 w-4" /></button>
            )}
          </li>
        ))}
        {shown.length === 0 && <li className="p-8 text-center text-sm text-muted-foreground">{rows.length ? "No responses match." : "Nothing imported yet."}</li>}
      </ul>
    </div>
  );
}
