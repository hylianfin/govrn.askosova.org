import Link from "next/link";
import { ClipboardCheck, Users, Building2, Megaphone } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentElection } from "@/lib/queries/elections";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader, StatTile, Section } from "@/components/dashboard/primitives";
import { ReviewQueue } from "@/components/dashboard/review-queue";
import { STAGE_LABELS } from "@/lib/types";

export default async function StaffOverviewPage() {
  const supabase = await createClient();
  const election = await getCurrentElection();
  const count = (q: any) => q.then((r: any) => r.count ?? 0);
  const [pending, teams, senate, materials, changes] = await Promise.all([
    count(supabase.from("applications").select("*", { count: "exact", head: true }).in("status", ["submitted", "under_review"])),
    count(supabase.from("applications").select("*", { count: "exact", head: true }).eq("kind", "executive_team")),
    count(supabase.from("applications").select("*", { count: "exact", head: true }).eq("kind", "senate")),
    count(supabase.from("campaign_materials").select("*", { count: "exact", head: true }).in("status", ["submitted", "under_review"])),
    count(supabase.from("applications").select("*", { count: "exact", head: true }).eq("status", "changes_requested")),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Staff console"
        title="Review center"
        description="Applications and campaign materials that need a decision."
        actions={election?.current_stage ? <Badge className="px-3 py-1 text-sm">{STAGE_LABELS[election.current_stage as keyof typeof STAGE_LABELS]}</Badge> : undefined}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Awaiting review" value={pending} hint="Submitted or in review" tone={pending ? "warning" : "success"} icon={<ClipboardCheck className="h-5 w-5" />} href="/staff/applications" />
        <StatTile label="Campaign materials" value={materials} hint="Pending approval" tone={materials ? "warning" : "default"} icon={<Megaphone className="h-5 w-5" />} href="/staff/campaign-approvals" />
        <StatTile label="Executive teams" value={teams} hint={`${changes} with changes requested`} icon={<Users className="h-5 w-5" />} href="/staff/applications/executive-teams" />
        <StatTile label="Senate applicants" value={senate} icon={<Building2 className="h-5 w-5" />} href="/staff/applications/senate" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2"><ReviewQueue /></div>
        <Section title="Quick actions">
          <div className="flex flex-col gap-2">
            <Button asChild variant="outline" className="justify-start"><Link href="/staff/eligibility">Verify eligibility</Link></Button>
            <Button asChild variant="outline" className="justify-start"><Link href="/staff/campaign-approvals">Approve campaign materials</Link></Button>
            <Button asChild variant="outline" className="justify-start"><Link href="/staff/announcements">Post an announcement</Link></Button>
            <Button asChild variant="outline" className="justify-start"><Link href="/staff/election-results">Enter election results</Link></Button>
          </div>
        </Section>
      </div>
    </div>
  );
}
