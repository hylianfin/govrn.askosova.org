import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import type { ChainStatus, Reconciliation } from "@/lib/live";

const ORDER = { error: 0, warn: 1, ok: 2 } as const;

// The result of comparing printed, issued, registered and counted ballots, one line per finding.
export function ReconciliationReport({ rec, chain }: { rec: Reconciliation; chain?: ChainStatus | null }) {
  const checks = [...rec.checks].sort((a, b) => ORDER[a.level] - ORDER[b.level]);
  const chainBroken = chain && !chain.ok;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-sm">
        <span className={cn("rounded-full px-3 py-1 font-medium", rec.errors > 0 ? "bg-danger/10 text-danger" : "bg-success/10 text-success")}>{rec.errors} problem{rec.errors === 1 ? "" : "s"}</span>
        <span className={cn("rounded-full px-3 py-1 font-medium", rec.warnings > 0 ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground")}>{rec.warnings} warning{rec.warnings === 1 ? "" : "s"}</span>
        {chain && <span className={cn("rounded-full px-3 py-1 font-medium", chainBroken ? "bg-danger/10 text-danger" : "bg-success/10 text-success")}>{chainBroken ? "Ballot history was changed" : `Ballot history intact (${chain.checked} ballots)`}</span>}
      </div>
      {checks.length === 0 ? (
        <p className="flex items-center gap-2 rounded-lg border border-border px-4 py-3 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-success" /> Nothing to report yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {checks.map((c) => (
            <li key={c.id} className="flex gap-3 px-4 py-3">
              {c.level === "error" ? <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" /> : c.level === "warn" ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />}
              <div>
                <p className="text-sm font-medium">{c.title}</p>
                <p className="text-sm text-muted-foreground">{c.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
