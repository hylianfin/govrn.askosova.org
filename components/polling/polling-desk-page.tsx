import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, isStaff } from "@/lib/auth/session";
import { PageHeader, EmptyState } from "@/components/dashboard/primitives";
import { PollingDesk, type Recent } from "@/components/polling/polling-desk";

export async function PollingDeskPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data: election } = await supabase.from("elections").select("id, timezone").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!election) return <EmptyState>No election is configured yet.</EmptyState>;

  const [{ count }, { data: eligible }, { data: latest }] = await Promise.all([
    supabase.from("ballot_checkins").select("*", { count: "exact", head: true }).eq("election_id", election.id),
    supabase.rpc("eligible_voter_count"),
    supabase.from("ballot_checkins").select("student_id, issued_at").eq("election_id", election.id).order("issued_at", { ascending: false }).limit(6),
  ]);

  const ids = ((latest ?? []) as { student_id: string }[]).map((l) => l.student_id);
  // Volunteers cannot read profiles directly; names for the recent list come from the same name-search function.
  const names = new Map<string, { name: string; grade: number | null }>();
  if (isStaff(user?.roles ?? []) && ids.length) {
    const { data: ps } = await supabase.from("profiles").select("id, full_name, grade_level").in("id", ids);
    for (const p of (ps ?? []) as { id: string; full_name: string | null; grade_level: number | null }[]) names.set(p.id, { name: p.full_name ?? "Student", grade: p.grade_level });
  }
  const tz = election.timezone || "UTC";
  const recent: Recent[] = ((latest ?? []) as { student_id: string; issued_at: string }[]).map((l) => ({
    id: l.student_id,
    name: names.get(l.student_id)?.name ?? "Student",
    grade: names.get(l.student_id)?.grade ?? null,
    at: new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(new Date(l.issued_at)),
  }));

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Election day" title="Polling desk" description="Check students in and hand out ballots." />
      <PollingDesk issued={count ?? 0} eligible={Number(eligible ?? 0)} recent={recent} canUndo={isStaff(user?.roles ?? [])} />
    </div>
  );
}
