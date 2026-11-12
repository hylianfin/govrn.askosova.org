import { Users, Vote } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentElection } from "@/lib/queries/elections";
import { PageHeader, StatTile } from "@/components/dashboard/primitives";
import { ElectionDayCard } from "@/components/counting/election-day-card";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const supabase = await createClient();
  const election = await getCurrentElection();
  const [{ count: users }, { data: lists }] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.rpc("candidate_lists"),
  ]);
  const running = ((lists ?? []) as { candidates: unknown[] }[]).reduce((n, l) => n + l.candidates.length, 0);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Admin console" title="Administration" description={election ? election.title : "No election configured yet."} />
      <ElectionDayCard base="/admin" />
      <div className="grid gap-4 sm:grid-cols-2">
        <StatTile label="Candidates" value={running} icon={<Vote className="h-5 w-5" />} href="/admin/candidates" />
        <StatTile label="Users" value={users ?? 0} icon={<Users className="h-5 w-5" />} href="/admin/users" />
      </div>
    </div>
  );
}
