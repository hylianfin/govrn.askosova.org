import Link from "next/link";
import { AlertTriangle, ArrowRight, ClipboardList, History, PlayCircle, Scale, Vote } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/dashboard/primitives";
import { getConfig } from "@/lib/config-server";
import { schoolLabel } from "@/lib/config";
import { raceBallots, type LiveState, type School } from "@/lib/live";

const STATUS = {
  not_started: { label: "Not started", variant: "secondary" as const },
  counting: { label: "Counting", variant: "success" as const },
  ended: { label: "Election ended", variant: "info" as const },
};

// Election-day status and shortcuts for the staff and admin overview pages.
export async function ElectionDayCard({ base }: { base: "/staff" | "/admin" }) {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const config = await getConfig();
  const [{ data }, { count: alerts }] = await Promise.all([
    supabase.rpc("live_results"),
    user
      ? supabase.from("notifications").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("read", false)
          .or("title.ilike.Election integrity%,title.ilike.Recount started%,title.ilike.Election ended with%")
      : Promise.resolve({ count: 0 }),
  ]);
  const live = (data as LiveState | null) ?? { status: "not_started" as const, races: [] };
  const badge = STATUS[live.status];
  const schools = [...new Set(live.races.map((r) => r.school))] as School[];
  const confirmed = live.races.filter((r) => r.confirmed).length;
  const admin = base === "/admin";

  return (
    <Section
      title="Election day"
      description="Check voters in, count the ballots, and review the history."
      action={<Badge variant={badge.variant}>{badge.label}</Badge>}
    >
      {(alerts ?? 0) > 0 && (
        <Link href={`${base}/election-results`} className="mb-4 flex items-center gap-2 rounded-lg border border-danger/40 bg-danger/5 px-4 py-2.5 text-sm font-medium text-danger">
          <AlertTriangle className="h-4 w-4" /> {alerts} integrity alert{alerts === 1 ? "" : "s"} to review <ArrowRight className="ml-auto h-4 w-4" />
        </Link>
      )}
      {live.races.length > 0 ? (
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          {schools.map((s) => {
            const rs = live.races.filter((r) => r.school === s);
            const counted = rs.reduce((n, r) => n + raceBallots(r), 0);
            const issued = rs[0]?.issued;
            return (
              <div key={s} className="rounded-lg border border-border p-3">
                <p className="text-sm text-muted-foreground">{schoolLabel(config, s)}</p>
                <p className="text-2xl font-semibold tabular-nums">{counted}{issued != null && <span className="text-base text-muted-foreground"> / {issued}</span>}</p>
                <p className="text-xs text-muted-foreground">ballots counted / issued</p>
              </div>
            );
          })}
          <div className="rounded-lg border border-border p-3">
            <p className="text-sm text-muted-foreground">Races confirmed</p>
            <p className="text-2xl font-semibold tabular-nums">{confirmed}<span className="text-base text-muted-foreground"> / {live.races.length}</span></p>
            <p className="text-xs text-muted-foreground">by a second person</p>
          </div>
        </div>
      ) : (
        <p className="mb-4 text-sm text-muted-foreground">No approved candidates yet. The races appear here once applications are approved.</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm"><Link href={`${base}/polling-desk`}><Vote className="h-4 w-4" /> Polling desk</Link></Button>
        <Button asChild size="sm"><Link href={`${base}/election-results`}><ClipboardList className="h-4 w-4" /> Count the ballots</Link></Button>
        <Button asChild variant="outline" size="sm"><Link href={`${base}/ballot-history`}><History className="h-4 w-4" /> Ballot history</Link></Button>
        {admin && <Button asChild variant="outline" size="sm"><Link href="/admin/integrity"><Scale className="h-4 w-4" /> Integrity numbers</Link></Button>}
        <Button asChild variant="ghost" size="sm"><Link href={`${base}/practice`}><PlayCircle className="h-4 w-4" /> Practice with sample data</Link></Button>
      </div>
    </Section>
  );
}
