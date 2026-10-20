import Link from "next/link";
import { FileText, Users, Megaphone, ArrowRight, Sparkles } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getCurrentElection, getElectionEvents, getAnnouncements } from "@/lib/queries/elections";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { validTimezone } from "@/lib/datetime";
import { PageHeader, Section, EmptyState, StageTracker, StatusBadge, LinkArrow } from "@/components/dashboard/primitives";
import { STATUS_LABELS, type ApplicationStatus } from "@/lib/types";
import { timelinePosition } from "@/lib/timeline";

type App = { id: string; kind: "executive_team" | "senate"; status: ApplicationStatus; executive_team_id: string | null };

function nextStep(exec: App | undefined, senate: App | undefined, onTeam: boolean, pendingMembers: number) {
  if (exec?.status === "changes_requested") return { title: "Staff requested changes to your team application", body: "Review the feedback, update your answers and resubmit.", href: "/dashboard/team", cta: "Review changes" };
  if (senate?.status === "changes_requested") return { title: "Staff requested changes to your Senate application", body: "Update your answers and resubmit.", href: "/dashboard/applications/senate", cta: "Review changes" };
  if (exec && pendingMembers > 0 && ["draft", "awaiting_team_members"].includes(exec.status))
    return { title: `Waiting on ${pendingMembers} team member${pendingMembers > 1 ? "s" : ""}`, body: "Every member has to accept their invitation before the team can submit.", href: "/dashboard/team", cta: "Manage team" };
  if (exec && ["draft", "ready_to_submit"].includes(exec.status))
    return { title: "Finish your team application", body: "Complete the team and individual questions, then submit before the deadline.", href: "/dashboard/team", cta: "Continue application" };
  if (exec?.status === "approved") return { title: "Your team is approved", body: "Start preparing posters, videos and your slogan in the campaign workspace.", href: "/dashboard/campaign", cta: "Open campaign workspace" };
  if (senate && senate.status === "draft") return { title: "Finish your Senate application", body: "Answer the remaining questions and submit.", href: "/dashboard/applications/senate", cta: "Continue application" };
  if (!exec && !senate && !onTeam) return { title: "Ready to run?", body: "Apply as a four-member Executive Team, or apply individually to Student Senate.", href: "/dashboard/applications", cta: "Choose an application" };
  return null;
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const election = await getCurrentElection();

  const { data: membership } = await supabase
    .from("executive_team_members").select("team_id, position").eq("user_id", user?.id ?? "").limit(1).maybeSingle();
  const teamId: string | undefined = membership?.team_id;

  const filter = [`applicant_id.eq.${user?.id}`, teamId ? `executive_team_id.eq.${teamId}` : null].filter(Boolean).join(",");

  const [events, announcements, appsRes, membersRes, teamRes, notifsRes, unreadRes, importRes] = await Promise.all([
    election ? getElectionEvents(election.id) : Promise.resolve([] as any[]),
    getAnnouncements(true),
    supabase.from("applications").select("id, kind, status, executive_team_id, submitted_at").or(filter).order("created_at", { ascending: false }),
    teamId ? supabase.from("executive_team_members").select("id, position, accepted, profiles(full_name,email)").eq("team_id", teamId) : Promise.resolve({ data: [] }),
    teamId ? supabase.from("executive_teams").select("name").eq("id", teamId).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("notifications").select("id, title, body, link, read, created_at").eq("user_id", user?.id ?? "").order("created_at", { ascending: false }).limit(4),
    supabase.from("notifications").select("*", { count: "exact", head: true }).eq("user_id", user?.id ?? "").eq("read", false),
    supabase.rpc("pending_import_for_me"),
  ]);
  const foundImport: boolean = ((importRes.data ?? []) as unknown[]).length > 0;

  const apps: App[] = appsRes.data ?? [];
  const exec = apps.find((a) => a.kind === "executive_team");
  const senate = apps.find((a) => a.kind === "senate");
  const members: any[] = membersRes.data ?? [];
  const pendingMembers = members.filter((m) => !m.accepted).length;
  const notifs: any[] = notifsRes.data ?? [];
  const unread = unreadRes.count ?? 0;
  const step = nextStep(exec, senate, !!teamId, pendingMembers);

  const firstName = (user?.profile?.full_name || user?.email || "").split(/[\s@]/)[0];
  const pos = timelinePosition(events);
  const current = pos.state === "done" ? null : events[pos.index];
  const stageBadge = pos.state === "done" ? "Election complete" : current ? `${pos.state === "now" ? "Now" : "Up next"}: ${current.title}` : null;
  const deadline = events.find((e: any) => /deadline|application/i.test(e.title))?.end_at;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={election?.title}
        title={`Welcome back, ${firstName}`}
        description="Track the election, your applications and your team in one place."
        actions={stageBadge ? <Badge variant="default" className="px-3 py-1 text-sm">{stageBadge}</Badge> : undefined}
      />

      {foundImport && (
        <div className="flex flex-col gap-4 rounded-xl border border-warning/40 bg-warning/10 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">We found an application sent under your name</p>
            <p className="text-sm text-muted-foreground">It came in through Google Forms. Confirm it is you with your grade and homeroom teacher and it will appear in your account.</p>
          </div>
          <Button asChild className="shrink-0"><Link href="/dashboard/verify">Confirm it&apos;s me <ArrowRight className="h-4 w-4" /></Link></Button>
        </div>
      )}
      {!foundImport && step ? (
        <div className="flex flex-col gap-4 rounded-xl border border-primary/20 bg-primary/5 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Sparkles className="h-4 w-4" /></div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">Your next step</p>
              <p className="font-semibold">{step.title}</p>
              <p className="text-sm text-muted-foreground">{step.body}</p>
            </div>
          </div>
          <Button asChild className="shrink-0"><Link href={step.href}>{step.cta} <ArrowRight className="h-4 w-4" /></Link></Button>
        </div>
      ) : foundImport ? null : (
        <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground shadow-sm">You&apos;re all caught up. We&apos;ll notify you when something needs your attention.</div>
      )}

      <Section title="Election progress" description={deadline ? `Applications close ${new Date(deadline).toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short", timeZone: validTimezone(election?.timezone) ? election!.timezone : "UTC" })}` : undefined} action={<LinkArrow href="/election-timeline">Full timeline</LinkArrow>}>
        <StageTracker events={events} timezone={validTimezone(election?.timezone) ? election!.timezone : "UTC"} />
      </Section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Section title="My applications" action={<LinkArrow href="/dashboard/applications">All applications</LinkArrow>}>
            <ul className="grid gap-3 sm:grid-cols-2">
              {([
                { key: "exec", name: "Executive Team", desc: "Four-member team ticket", app: exec, href: teamId ? "/dashboard/team" : "/dashboard/applications/executive-team", icon: Users },
                { key: "senate", name: "Student Senate", desc: "Individual class application", app: senate, href: "/dashboard/applications/senate", icon: FileText },
              ] as const).map((c) => (
                <li key={c.key} className="flex flex-col justify-between gap-4 rounded-lg border border-border p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted"><c.icon className="h-4 w-4 text-primary" /></div>
                      <div><p className="font-medium leading-tight">{c.name}</p><p className="text-xs text-muted-foreground">{c.desc}</p></div>
                    </div>
                    {c.app ? <StatusBadge status={c.app.status} label={STATUS_LABELS[c.app.status] ?? c.app.status} /> : <Badge variant="outline">Not started</Badge>}
                  </div>
                  <Button asChild variant={c.app ? "outline" : "default"} size="sm" className="self-start">
                    <Link href={c.href}>{c.app ? "Open" : "Start"}</Link>
                  </Button>
                </li>
              ))}
            </ul>
          </Section>

          {teamId && (
            <Section title={teamRes.data?.name ?? "My team"} description={pendingMembers ? `${pendingMembers} invitation${pendingMembers > 1 ? "s" : ""} pending` : "All members have accepted"} action={<LinkArrow href="/dashboard/team">Manage</LinkArrow>}>
              <ul className="grid gap-2 sm:grid-cols-2">
                {members.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium capitalize">{String(m.position).replace("_", " ")}</p>
                      <p className="truncate text-xs text-muted-foreground">{m.profiles?.full_name || m.profiles?.email || "Invited"}</p>
                    </div>
                    <Badge variant={m.accepted ? "success" : "warning"}>{m.accepted ? "Accepted" : "Pending"}</Badge>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {exec?.status === "approved" && (
            <Section title="Campaign workspace" description="Posters, video, slogan and debate notes." action={<LinkArrow href="/dashboard/campaign">Open</LinkArrow>}>
              <div className="flex items-center gap-3 text-sm text-muted-foreground"><Megaphone className="h-4 w-4 text-primary" /> Submit your materials for staff approval before the campaign period starts.</div>
            </Section>
          )}
        </div>

        <div className="space-y-6">
          <Section title="Notifications" description={unread ? `${unread} unread` : undefined} action={<LinkArrow href="/dashboard/notifications">View all</LinkArrow>}>
            {notifs.length === 0 ? <EmptyState>No notifications yet.</EmptyState> : (
              <ul className="space-y-3">
                {notifs.map((n) => (
                  <li key={n.id} className="flex gap-3">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-border" : "bg-primary"}`} />
                    <div className="min-w-0">
                      <p className={`text-sm leading-snug ${n.read ? "text-muted-foreground" : "font-medium"}`}>{n.title}</p>
                      <p className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleDateString()}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Announcements">
            {announcements.length === 0 ? <EmptyState>Nothing posted yet.</EmptyState> : (
              <ul className="space-y-4">
                {announcements.slice(0, 3).map((a: any) => (
                  <li key={a.id}>
                    <p className="text-sm font-medium leading-snug">{a.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{a.body}</p>
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
