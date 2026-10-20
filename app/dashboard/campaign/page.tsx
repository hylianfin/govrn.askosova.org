import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { saveCampaignMaterial, submitCampaignMaterial } from "@/lib/actions/campaign";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export default async function CampaignPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data: membership } = await supabase.from("executive_team_members").select("team_id").eq("user_id", user?.id ?? "").limit(1).maybeSingle();
  if (!membership) return <p className="text-muted-foreground">You are not part of a team.</p>;
  const teamId = membership.team_id;

  const { data: team } = await supabase.from("executive_teams").select("name").eq("id", teamId).single();
  const { data: material } = await supabase.from("campaign_materials").select("*").eq("team_id", teamId).maybeSingle();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-primary">Campaign Workspace — {team?.name}</h1>
        <Badge variant="secondary">{material?.status ?? "draft"}</Badge>
      </div>
      <Card>
        <CardHeader><CardTitle>Campaign materials</CardTitle><CardDescription>Prepare posters, videos, slogans, and speeches.</CardDescription></CardHeader>
        <CardContent>
          <form action={async (fd: FormData) => { "use server"; await saveCampaignMaterial(fd); }} className="space-y-4">
            <input type="hidden" name="teamId" value={teamId} />
            <div className="space-y-2"><Label>Slogan</Label><Input name="slogan" defaultValue={material?.slogan ?? ""} /></div>
            <div className="space-y-2"><Label>Platform</Label><Textarea name="platform" defaultValue={material?.platform ?? ""} /></div>
            <div className="space-y-2"><Label>Goals</Label><Textarea name="goals" defaultValue={material?.goals ?? ""} /></div>
            <div className="space-y-2"><Label>Poster URL</Label><Input name="posterUrl" defaultValue={material?.poster_url ?? ""} /></div>
            <div className="space-y-2"><Label>Video URL</Label><Input name="videoUrl" defaultValue={material?.video_url ?? ""} /></div>
            <div className="space-y-2"><Label>Speech notes</Label><Textarea name="speechNotes" defaultValue={material?.speech_notes ?? ""} /></div>
            <div className="space-y-2"><Label>Debate notes</Label><Textarea name="debateNotes" defaultValue={material?.debate_notes ?? ""} /></div>
            <div className="flex gap-2">
              <Button type="submit">Save draft</Button>
            </div>
          </form>
          <form action={async () => { "use server"; await submitCampaignMaterial(teamId); }} className="mt-3">
            <Button type="submit" variant="secondary">Submit for approval</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}