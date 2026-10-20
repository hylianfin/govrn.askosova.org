import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default async function AdminSettingsPage() {
  const supabase = await createClient();
  const { data: election } = await supabase.from("elections").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-primary">Settings</h1>
      <Card>
        <CardHeader><CardTitle>Platform settings</CardTitle></CardHeader>
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