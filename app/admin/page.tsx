import Link from "next/link";
import { Check, Circle, Users, FileText, ClipboardCheck, ScrollText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentElection, getElectionEvents } from "@/lib/queries/elections";
import { Button } from "@/components/ui/button";
import { validTimezone } from "@/lib/datetime";
import { PageHeader, StatTile, Section, StageTracker, EmptyState, LinkArrow } from "@/components/dashboard/primitives";
import { ReviewQueue } from "@/components/dashboard/review-queue";

export default async function AdminOverviewPage() {
  const supabase = await createClient();
  const election = await getCurrentElection();
  const count = (q: any) => q.then((r: any) => r.count ?? 0);

  const [events, users, execApps, senateApps, pending, rules, publishedForms, staffCount, auditRes] = await Promise.all([
    election ? getElectionEvents(election.id) : Promise.resolve([] as any[]),
    count(supabase.from("profiles").select("*", { count: "exact", head: true })),
    count(supabase.from("applications").select("*", { count: "exact", head: true }).eq("kind", "executive_team")),
    count(supabase.from("applications").select("*", { count: "exact", head: true }).eq("kind", "senate")),
    count(supabase.from("applications").select("*", { count: "exact", head: true }).in("status", ["submitted", "under_review"])),
    count(supabase.from("eligibility_rules").select("*", { count: "exact", head: true }).eq("is_active", true)),
    count(supabase.from("application_forms").select("*", { count: "exact", head: true }).eq("is_published", true)),
    count(supabase.from("user_roles").select("*", { count: "exact", head: true }).in("role", ["staff_reviewer", "admin"])),
    supabase.from("audit_logs").select("id, action, entity_type, created_at").order("created_at", { ascending: false }).limit(5),
  ]);
  const audit: any[] = auditRes.data ?? [];

  const checklist = [
    { done: !!election, label: "Election created", href: "/admin/elections" },
    { done: events.length >= 5, label: `Timeline configured (${events.length} milestones)`, href: "/admin/timeline" },
    { done: rules > 0, label: `Eligibility rules active (${rules})`, href: "/admin/eligibility-rules" },
    { done: publishedForms >= 2, label: `Application forms published (${publishedForms}/2)`, href: "/admin/forms" },
    { done: staffCount > 0, label: `Reviewers assigned (${staffCount})`, href: "/admin/roles" },
  ];
  const doneCount = checklist.filter((c) => c.done).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin console"
        title="Administration"
        description={election ? election.title : "No election configured yet."}
        actions={<Button asChild variant="outline"><Link href="/admin/elections">Manage election</Link></Button>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Users" value={users} icon={<Users className="h-5 w-5" />} href="/admin/users" />
        <StatTile label="Executive applications" value={execApps} icon={<FileText className="h-5 w-5" />} href="/staff/applications/executive-teams" />
        <StatTile label="Senate applications" value={senateApps} icon={<FileText className="h-5 w-5" />} href="/staff/applications/senate" />
        <StatTile label="Pending review" value={pending} tone={pending ? "warning" : "success"} icon={<ClipboardCheck className="h-5 w-5" />} href="/staff/applications" />
      </div>

      <Section title="Election progress" description="Follows the dates on the timeline automatically." action={<LinkArrow href="/admin/timeline">Edit timeline</LinkArrow>}>
        <StageTracker events={events} timezone={validTimezone(election?.timezone) ? election!.timezone : "UTC"} />
      </Section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2"><ReviewQueue /></div>
        <div className="space-y-6">
          <Section title="Setup checklist" description={`${doneCount} of ${checklist.length} complete`}>
            <ul className="space-y-1">
              {checklist.map((c) => (
                <li key={c.label}>
                  <Link href={c.href} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-muted">
                    {c.done
                      ? <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success text-white"><Check className="h-3 w-3" /></span>
                      : <Circle className="h-5 w-5 text-warning" />}
                    <span className={c.done ? "text-muted-foreground" : "font-medium"}>{c.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Recent activity" action={<LinkArrow href="/admin/audit-logs">Audit log</LinkArrow>}>
            {audit.length === 0 ? <EmptyState>No activity recorded yet.</EmptyState> : (
              <ul className="space-y-3">
                {audit.map((a) => (
                  <li key={a.id} className="flex gap-3">
                    <ScrollText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="truncate text-sm">{a.action}{a.entity_type ? ` · ${a.entity_type}` : ""}</p>
                      <p className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
