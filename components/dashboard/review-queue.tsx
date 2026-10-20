import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Section, EmptyState, StatusBadge, LinkArrow } from "@/components/dashboard/primitives";
import { STATUS_LABELS } from "@/lib/types";

export async function ReviewQueue({ limit = 6 }: { limit?: number }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("applications")
    .select("id, kind, status, applicant_id, submitted_at, created_at, executive_teams(name)")
    .in("status", ["submitted", "under_review", "changes_requested"])
    .order("submitted_at", { ascending: true, nullsFirst: false })
    .limit(limit);
  const apps: any[] = data ?? [];

  const applicantIds = apps.filter((a) => a.kind === "senate" && a.applicant_id).map((a) => a.applicant_id);
  const { data: profs } = applicantIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", applicantIds)
    : { data: [] };
  const names = new Map<string, string>((profs ?? []).map((p: any) => [p.id, p.full_name || p.email]));

  return (
    <Section title="Needs review" description="Oldest submissions first" action={<LinkArrow href="/staff/applications">All applications</LinkArrow>}>
      {apps.length === 0 ? <EmptyState>Nothing waiting. New submissions will show up here.</EmptyState> : (
        <ul className="divide-y divide-border">
          {apps.map((a) => {
            const who = a.kind === "executive_team" ? a.executive_teams?.name ?? "Unnamed team" : names.get(a.applicant_id) ?? "Applicant";
            return (
              <li key={a.id}>
                <Link href={`/staff/applications/${a.id}`} className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-3 hover:bg-muted">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{who}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.kind === "executive_team" ? "Executive Team" : "Student Senate"}
                      {a.submitted_at ? ` · submitted ${new Date(a.submitted_at).toLocaleDateString()}` : ""}
                    </p>
                  </div>
                  <StatusBadge status={a.status} label={STATUS_LABELS[a.status as keyof typeof STATUS_LABELS] ?? a.status} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}
