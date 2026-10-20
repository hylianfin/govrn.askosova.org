"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link2, Search, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { deleteImported, linkImportedNow } from "@/lib/actions/import";

export type ImportedRow = {
  id: string; kind: "executive_team" | "senate"; email: string; name: string | null; teamName: string | null;
  status: "pending" | "linked" | "skipped"; note: string | null; submittedAt: string | null; importedAt: string; linkedAt: string | null; applicationId: string | null; answered: number;
};

const STATUS = {
  pending: { label: "Waiting for sign-up", variant: "warning" as const },
  linked: { label: "Linked", variant: "success" as const },
  skipped: { label: "Skipped", variant: "secondary" as const },
};
const date = (s: string) => new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export function ImportedList({ rows }: { rows: ImportedRow[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | ImportedRow["status"]>("all");
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const counts = useMemo(() => ({ pending: rows.filter((r) => r.status === "pending").length, linked: rows.filter((r) => r.status === "linked").length, skipped: rows.filter((r) => r.status === "skipped").length }), [rows]);
  const shown = rows.filter((r) => (filter === "all" || r.status === filter) && (!q.trim() || `${r.email} ${r.name ?? ""} ${r.teamName ?? ""}`.toLowerCase().includes(q.trim().toLowerCase())));

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
      {msg && <p role="status" className="text-sm text-muted-foreground">{msg}</p>}

      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {shown.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{r.teamName || r.name || r.email}</p>
              <p className="truncate text-xs text-muted-foreground">
                {r.email} · {r.kind === "executive_team" ? "Executive Team" : "Senate"} · {r.answered} answers
                {r.submittedAt ? ` · sent ${date(r.submittedAt)}` : ""} · imported {date(r.importedAt)}
              </p>
              {r.note && <p className="text-xs text-muted-foreground">{r.note}</p>}
            </div>
            <Badge variant={STATUS[r.status].variant}>{STATUS[r.status].label}</Badge>
            {r.applicationId && <a href={`/staff/applications/${r.applicationId}`} className="text-sm font-medium text-primary hover:underline">Open</a>}
            {r.status === "pending" && (
              <button aria-label={`Delete import for ${r.email}`} disabled={pending}
                onClick={() => { if (confirm(`Remove the imported response for ${r.email}? This cannot be undone.`)) startTransition(async () => { await deleteImported(r.id); router.refresh(); }); }}
                className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-danger"><Trash2 className="h-4 w-4" /></button>
            )}
          </li>
        ))}
        {shown.length === 0 && <li className="p-8 text-center text-sm text-muted-foreground">{rows.length ? "No responses match." : "Nothing imported yet."}</li>}
      </ul>
    </div>
  );
}
