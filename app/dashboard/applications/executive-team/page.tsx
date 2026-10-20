import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/primitives";
import { CreateTeamForm } from "@/components/forms/simple-forms";
import { acceptInvitation } from "@/lib/actions/executive";

const label = (p: string) => p.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());

export default async function ExecutiveTeamApplicationPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const [{ data: memberships }, { data: invitations }] = await Promise.all([
    supabase.from("executive_team_members").select("team_id, position, accepted, executive_teams(name)").eq("user_id", user?.id ?? ""),
    supabase.from("team_invitations").select("*").eq("email", user?.email ?? "").is("accepted_by", null),
  ]);
  const hasTeam = (memberships ?? []).length > 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Executive Team application" description="Apply as a team of four: President, Vice President, Secretary and Treasurer." />

      {hasTeam && (
        <Card>
          <CardHeader><CardTitle>You are on a team</CardTitle><CardDescription>Finish the application together in your team workspace.</CardDescription></CardHeader>
          <CardContent><Button asChild><Link href="/dashboard/team">Open team workspace</Link></Button></CardContent>
        </Card>
      )}

      {(invitations ?? []).length > 0 && (
        <Card>
          <CardHeader><CardTitle>Invitations for you</CardTitle><CardDescription>Accept to join the team and fill in your part of the application.</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {(invitations ?? []).map((inv: any) => (
              <div key={inv.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <p className="font-medium">{label(inv.position)}</p>
                <form action={async () => { "use server"; await acceptInvitation(inv.token); }}>
                  <Button type="submit" size="sm">Accept</Button>
                </form>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {!hasTeam && <CreateTeamForm />}
    </div>
  );
}
