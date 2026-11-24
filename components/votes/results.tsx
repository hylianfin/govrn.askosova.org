import { Trophy } from "lucide-react";
import { cn } from "@/lib/cn";
import { standings, type PollSummary } from "@/lib/votes";

/** Result bars for one vote. Each bar is that option's share of the students who voted. */
export function Results({ summary, final }: { summary: PollSummary; final: boolean }) {
  const rows = standings(summary);
  const leaders = rows.filter((r) => r.leading);

  if (rows.length === 0) return null;
  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.id}>
            <div className="flex items-baseline justify-between gap-3">
              <p className={cn("flex min-w-0 items-center gap-2 text-sm font-medium", r.leading ? "text-foreground" : "text-foreground/80")}>
                <span className="truncate">{r.label}</span>
                {r.leading && final && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
                    <Trophy className="h-3 w-3" /> {leaders.length > 1 ? "Tied" : "Winner"}
                  </span>
                )}
              </p>
              <p className="shrink-0 text-sm tabular-nums text-muted-foreground">
                <span className="font-semibold text-foreground">{r.votes}</span> · {Math.round(r.share * 100)}%
              </p>
            </div>
            <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${r.label}: ${r.votes} of ${summary.voters} voters`}>
              <div className={cn("h-full rounded-full transition-[width] duration-500", r.leading ? "bg-primary" : "bg-primary/35")} style={{ width: `${Math.round(r.share * 100)}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        {summary.voters === 0 ? "Nobody voted." : `${summary.voters} student${summary.voters === 1 ? "" : "s"} voted`}
        {final ? " · Final result" : " · Counting continues until voting closes"}
      </p>
    </div>
  );
}
