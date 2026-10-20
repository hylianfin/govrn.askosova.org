import { createClient } from "@/lib/supabase/server";
import { getConfig } from "@/lib/config-server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/primitives";
import { ConfigForm } from "@/components/admin/config-form";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const supabase = await createClient();
  const config = await getConfig();
  const [{ data: election }, { count: ballots }] = await Promise.all([
    supabase.from("elections").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("ballots").select("*", { count: "exact", head: true }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="System" title="Settings" description="Set up the platform for your school without changing any code. Use it again next year, or for another school." />
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
    </div>
  );
}
