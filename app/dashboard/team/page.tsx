import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { inviteMember } from "@/lib/actions/executive";
import { FormRenderer } from "@/components/forms/form-renderer";
import { ReviewFeedback } from "@/components/forms/review-feedback";
import { PageHeader, StatusBadge } from "@/components/dashboard/primitives";
import { buildAnswerMap, EDITABLE_STATUSES } from "@/lib/forms";
import { STATUS_LABELS } from "@/lib/types";

export default async function TeamPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const { data: membership } = await supabase
    .from("executive_team_members")
    .select("team_id")
    .eq("user_id", user?.id ?? "")
    .limit(1)
    .maybeSingle();

  if (!membership || !user) {
    return <p className="text-muted-foreground">You are not part of a team. <a href="/dashboard/applications/executive-team" className="text-primary underline">Create or join one.</a></p>;
  }
  const teamId = membership.team_id;

  const [{ data: team }, { data: members }, { data: app }] = await Promise.all([
    supabase.from("executive_teams").select("*").eq("id", teamId).single(),
    supabase.from("executive_team_members").select("*, profiles(full_name,email)").eq("team_id", teamId),
    supabase.from("applications").select("*").eq("executive_team_id", teamId).maybeSingle(),
  ]);

  const [{ data: form }, { data: questions }, { data: answers }] = app
    ? await Promise.all([
        supabase.from("application_forms").select("title, description").eq("id", app.form_id).maybeSingle(),
        supabase.from("application_questions").select("*").eq("version_id", app.form_version_id).order("order_index"),
        supabase.from("application_answers").select("question_id, respondent_id, value").eq("application_id", app.id),
      ])
    : [{ data: null }, { data: [] }, { data: [] }];

  const editable = !!app && EDITABLE_STATUSES.includes(app.status);
  const taken = new Set((members ?? []).map((m: any) => m.position));
  const open = ["president", "vice_president", "secretary", "treasurer"].filter((p) => !taken.has(p));

  return (
    <div className="space-y-6">
      <PageHeader
        title={team?.name ?? "My team"}
        description="Invite your teammates, then everyone completes their part of the application below."
        actions={app ? <StatusBadge status={app.status} label={STATUS_LABELS[app.status as keyof typeof STATUS_LABELS] ?? app.status} /> : undefined}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Members</CardTitle><CardDescription>{(members ?? []).length} of 4 positions filled</CardDescription></CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {(members ?? []).map((m: any) => (
                <li key={m.id} className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-medium capitalize">{m.position.replace("_", " ")}</p>
                    <p className="text-xs text-muted-foreground">{m.profiles?.full_name || m.profiles?.email || m.user_id}</p>
                  </div>
                  <Badge variant={m.accepted ? "success" : "warning"}>{m.accepted ? "Accepted" : "Pending"}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {editable && open.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Invite a member</CardTitle><CardDescription>Open: {open.map((p) => p.replace("_", " ")).join(", ")}</CardDescription></CardHeader>
            <CardContent>
              <form action={async (fd: FormData) => { "use server"; await inviteMember(fd); }} className="flex flex-wrap gap-2">
                <input type="hidden" name="teamId" value={teamId} />
                <Input name="email" type="email" placeholder="Student email" required className="min-w-0 flex-1" />
                <select name="position" className="h-10 rounded-md border border-input bg-background px-3 text-sm" defaultValue={open[0]}>
                  {open.map((p) => <option key={p} value={p}>{p.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}</option>)}
                </select>
                <Button type="submit">Invite</Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>

      {app && <ReviewFeedback applicationId={app.id} status={app.status} />}
      {app ? (
        <FormRenderer
          titleAs="h2"
          applicationId={app.id}
          title={form?.title ?? "Executive Team Application"}
          description={form?.description}
          questions={questions ?? []}
          initialAnswers={buildAnswerMap(questions ?? [], answers ?? [], user.id)}
          readOnly={!editable}
          lockedReason={editable ? undefined : "This application has been submitted and can no longer be edited."}
          submitLabel="Submit team application"
        />
      ) : (
        <p className="text-sm text-muted-foreground">No application found for this team.</p>
      )}
    </div>
  );
}
