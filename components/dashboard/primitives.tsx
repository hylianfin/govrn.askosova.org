import Link from "next/link";
import { Check, ArrowRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import type { ApplicationStatus } from "@/lib/types";
import { isPast, timelinePosition } from "@/lib/timeline";
import { formatDay } from "@/lib/datetime";

export function PageHeader({
  title, description, actions, eyebrow,
}: { title: string; description?: string; actions?: React.ReactNode; eyebrow?: string }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-primary">{eyebrow}</p>}
        <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatTile({
  label, value, hint, href, tone = "default", icon,
}: {
  label: string; value: React.ReactNode; hint?: string; href?: string;
  tone?: "default" | "warning" | "success" | "danger"; icon?: React.ReactNode;
}) {
  const toneRing = {
    default: "bg-primary/10 text-primary",
    warning: "bg-warning/15 text-warning",
    success: "bg-success/15 text-success",
    danger: "bg-danger/15 text-danger",
  }[tone];
  const body = (
    <div className={cn(
      "flex h-full items-start justify-between gap-3 rounded-xl border border-border bg-card p-5 shadow-sm transition",
      href && "hover:border-primary/40 hover:shadow-md",
    )}>
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </div>
      {icon && <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", toneRing)}>{icon}</div>}
    </div>
  );
  return href ? <Link href={href} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">{body}</Link> : body;
}

export function Section({
  title, description, action, children, className,
}: { title: string; description?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border border-border bg-card shadow-sm", className)}>
      <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">{children}</p>;
}

export function LinkArrow({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
      {children} <ArrowRight className="h-3.5 w-3.5" />
    </Link>
  );
}

export function statusVariant(s: ApplicationStatus | string) {
  switch (s) {
    case "approved": return "success" as const;
    case "rejected": case "withdrawn": return "danger" as const;
    case "changes_requested": case "awaiting_team_members": return "warning" as const;
    case "submitted": case "under_review": case "ready_to_submit": return "info" as const;
    default: return "secondary" as const;
  }
}

export function StatusBadge({ status, label }: { status: string; label: string }) {
  return <Badge variant={statusVariant(status)}>{label}</Badge>;
}

interface TimelineEvent { id: string; title: string; start_at?: string | null; end_at?: string | null }

export function StageTracker({ events, timezone = "UTC" }: { events: TimelineEvent[]; timezone?: string }) {
  const fmt = (d?: string | null) => formatDay(d, timezone);
  if (events.length === 0) return <EmptyState>The election timeline has not been configured yet.</EmptyState>;
  const pos = timelinePosition(events);
  return (
    <ol className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-7">
      {events.map((e, i) => {
        const current = i === pos.index && pos.state !== "done";
        const done = pos.state === "done" || (!current && isPast(e));
        return (
          <li key={e.id} aria-current={current ? "step" : undefined} className={cn("relative bg-card p-3", current && (pos.state === "now" ? "bg-primary/5" : "bg-muted/60"))}>
            <div className="flex items-center gap-2">
              <span className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                done && "bg-success text-white",
                current && pos.state === "now" && "bg-primary text-primary-foreground ring-4 ring-primary/15",
                current && pos.state === "next" && "border-2 border-primary text-primary",
                !done && !current && "bg-muted text-muted-foreground",
              )}>
                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              {current && <span className="text-[11px] font-semibold uppercase tracking-wide text-primary">{pos.state === "now" ? "Now" : "Up next"}</span>}
            </div>
            <p className={cn("mt-2 text-sm font-medium leading-snug", !done && !current && "text-muted-foreground")}>{e.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {fmt(e.start_at)}{e.end_at && fmt(e.end_at) !== fmt(e.start_at) ? ` – ${fmt(e.end_at)}` : ""}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
