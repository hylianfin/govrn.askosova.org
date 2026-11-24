import { Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState, StatTile } from "@/components/dashboard/primitives";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AttendancePage() {
  const supabase = await createClient();
  const { data: election } = await supabase.from("elections").select("id, timezone, title").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!election) return <EmptyState>No election is configured yet.</EmptyState>;

  const [{ count: eligible }, { data: checkins }] = await Promise.all([
    supabase.rpc("eligible_voter_count"),
    supabase.from("ballot_checkins").select("student_id, issued_at, profiles(full_name, grade_level)").eq("election_id", election.id).order("issued_at", { ascending: false }),
  ]);
  const rows = (checkins ?? []) as { student_id: string; issued_at: string; profiles: { full_name: string | null; grade_level: number | null } | null }[];
  const turnout = Number(eligible ?? 0) ? Math.round((rows.length / Number(eligible)) * 100) : 0;
  const formatter = new Intl.DateTimeFormat("en-GB", { timeZone: election.timezone || "UTC", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

  return <div className="space-y-6">
    <PageHeader eyebrow="Election day" title="Attendance" description="Students who checked in and received a ballot. This list never includes voting choices." />
    <div className="grid gap-4 sm:grid-cols-3">
      <StatTile label="Checked in" value={rows.length} icon={<Users className="h-5 w-5" />} />
      <StatTile label="Eligible voters" value={Number(eligible ?? 0)} icon={<Users className="h-5 w-5" />} />
      <StatTile label="Turnout" value={`${turnout}%`} icon={<Users className="h-5 w-5" />} />
    </div>
    <Card>
      <CardHeader><CardTitle>Check-in register</CardTitle></CardHeader>
      <CardContent>
        {rows.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No students have checked in yet.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b text-muted-foreground"><tr><th className="px-3 py-2 font-medium">Student</th><th className="px-3 py-2 font-medium">Grade</th><th className="px-3 py-2 font-medium">Checked in</th></tr></thead><tbody>{rows.map((row) => <tr key={row.student_id} className="border-b last:border-0"><td className="px-3 py-3 font-medium">{row.profiles?.full_name ?? "Student"}</td><td className="px-3 py-3">{row.profiles?.grade_level ?? "—"}</td><td className="px-3 py-3 tabular-nums">{formatter.format(new Date(row.issued_at))}</td></tr>)}</tbody></table></div>}
      </CardContent>
    </Card>
  </div>;
}
