import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { STAGE_LABELS } from "@/lib/types";

export default async function AdminElectionsPage() {
  const supabase = await createClient();
  const { data: elections } = await supabase.from("elections").select("*").order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-primary">Elections</h1>
      {(elections ?? []).map((e: any) => (
        <Card key={e.id}>
          <CardHeader><CardTitle>{e.title}</CardTitle></CardHeader>
          <CardContent>
            <form action={async (fd: FormData) => {
              "use server";
              const s = await createClient();
              await s.from("elections").update({ current_stage: fd.get("stage"), title: fd.get("title"), timezone: fd.get("timezone") }).eq("id", e.id);
            }} className="space-y-3">
              <div className="space-y-2"><Label>Title</Label><Input name="title" defaultValue={e.title} /></div>
              <div className="space-y-2"><Label>Timezone</Label><Input name="timezone" defaultValue={e.timezone} /></div>
              <div className="space-y-2">
                <Label>Current stage</Label>
                <select name="stage" defaultValue={e.current_stage} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  {Object.entries(STAGE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <Button type="submit">Save</Button>
            </form>
          </CardContent>
        </Card>
      ))}
      {(elections ?? []).length === 0 && <p className="text-sm text-muted-foreground">No elections configured.</p>}
    </div>
  );
}