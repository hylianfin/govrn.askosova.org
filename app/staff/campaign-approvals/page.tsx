import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function CampaignApprovalsPage() {
  const supabase = await createClient();
  const { data: materials } = await supabase.from("campaign_materials").select("*, executive_teams(name)").order("created_at", { ascending: false });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-primary">Campaign Approvals</h1>
      <div className="space-y-4">
        {(materials ?? []).map((m: any) => (
          <Card key={m.id}>
            <CardHeader>
              <CardTitle>{m.executive_teams?.name}</CardTitle>
              <Badge variant="secondary">{m.status}</Badge>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {m.video_url && <p><span className="font-medium">Video:</span> {m.video_url}</p>}
              {m.poster_url && <p><span className="font-medium">Poster:</span> {m.poster_url}</p>}
              {m.platform && <p><span className="font-medium">Platform:</span> {m.platform}</p>}
              <div className="flex gap-2 pt-2">
                <form action={async () => { "use server"; const s = await createClient(); await s.from("campaign_materials").update({ status: "approved" }).eq("id", m.id); }}>
                  <Button type="submit" size="sm">Approve</Button>
                </form>
                <form action={async () => { "use server"; const s = await createClient(); await s.from("campaign_materials").update({ status: "changes_requested" }).eq("id", m.id); }}>
                  <Button type="submit" size="sm" variant="secondary">Request changes</Button>
                </form>
              </div>
            </CardContent>
          </Card>
        ))}
        {(materials ?? []).length === 0 && <p className="text-sm text-muted-foreground">No materials.</p>}
      </div>
    </div>
  );
}