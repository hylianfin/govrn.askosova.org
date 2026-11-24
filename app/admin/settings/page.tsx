import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getConfig } from "@/lib/config-server";
import { getUserRows } from "@/lib/queries/users";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PageHeader, Section } from "@/components/dashboard/primitives";
import { ConfigForm } from "@/components/admin/config-form";
import { ElectionControls } from "@/components/admin/election-controls";
import { UserList } from "@/components/admin/user-list";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const supabase = await createClient();
  const [me, config, users, electionRes, ballotsRes] = await Promise.all([
    getCurrentUser(),
    getConfig(),
    getUserRows(),
    supabase.from("elections").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("ballots").select("*", { count: "exact", head: true }),
  ]);
  const election = electionRes.data;
  const ballots = ballotsRes.count ?? 0;

  const roleless = users.filter((u) => u.roles.length === 0);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="System" title="Settings" description="Set up the platform for your school without changing any code. Use it again next year, or for another school." />
      {election && <ElectionControls enabled={election.is_enabled ?? true} disabledReason={election.disabled_reason} />}
      <ConfigForm initial={config} locked={(ballots ?? 0) > 0} />
      <Card>
        <CardHeader><CardTitle>Timezone</CardTitle></CardHeader>
        <CardContent>
          <form action={async (fd: FormData) => {
            "use server";
            const s = await createClient();
            await s.from("elections").update({ timezone: fd.get("timezone") }).eq("id", election?.id);
          }} className="space-y-3">
            <div className="space-y-2"><Label>Timezone</Label><Input name="timezone" defaultValue={election?.timezone ?? "Europe/Berlin"} /></div>
            <Button type="submit">Save</Button>
          </form>
        </CardContent>
      </Card>

      <Section title="Profiles without a role" description="New sign-ups land here with no access. Give each one at least the Student role so they can use the platform.">
        {roleless.length === 0 ? (
          <p className="text-sm text-muted-foreground">Every profile has a role. Nothing to do.</p>
        ) : (
          <UserList users={roleless} editable currentUserId={me?.id ?? ""} />
        )}
      </Section>
    </div>
  );
}
