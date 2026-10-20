import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export default async function ElectionResultsPage() {
  const supabase = await createClient();
  const { data: election } = await supabase.from("elections").select("id").order("created_at", { ascending: false }).limit(1).maybeSingle();
  const { data: teams } = await supabase.from("executive_teams").select("id, name").eq("election_id", election?.id);
  const { data: results } = (await supabase.from("official_election_results").select("*").eq("election_id", election?.id)) as any;

  const resultMap = new Map((results ?? []).map((r: any) => [r.team_id, r]));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-primary">Election Results (Paper Ballots)</h1>
      <div className="space-y-4">
        {(teams ?? []).map((t: any) => {
          const r: any = resultMap.get(t.id);
          return (
            <Card key={t.id}>
              <CardHeader><CardTitle>{t.name}</CardTitle></CardHeader>
              <CardContent>
                <form action={async (fd: FormData) => {
                  "use server";
                  const s = await createClient();
                  const payload = {
                    election_id: election?.id,
                    team_id: t.id,
                    ballot_count: Number(fd.get("ballotCount") || 0),
                    invalid_ballots: Number(fd.get("invalid") || 0),
                    blank_ballots: Number(fd.get("blank") || 0),
                    entered_by: (await s.auth.getUser()).data.user?.id,
                    entered_at: new Date().toISOString(),
                  };
                  if (r) {
                    await s.from("official_election_results").update(payload).eq("id", r.id);
                  } else {
                    await s.from("official_election_results").insert(payload);
                  }
                }} className="grid gap-3 sm:grid-cols-4">
                  <div className="space-y-1"><Label>Ballot count</Label><Input name="ballotCount" type="number" defaultValue={r?.ballot_count ?? 0} /></div>
                  <div className="space-y-1"><Label>Invalid</Label><Input name="invalid" type="number" defaultValue={r?.invalid_ballots ?? 0} /></div>
                  <div className="space-y-1"><Label>Blank</Label><Input name="blank" type="number" defaultValue={r?.blank_ballots ?? 0} /></div>
                  <div className="flex items-end"><Button type="submit">Save</Button></div>
                </form>
                {r && (
                  <div className="mt-3 flex items-center gap-2 text-sm">
                    <Badge variant={r.verified_by ? "success" : "warning"}>{r.verified_by ? "Verified" : "Unverified"}</Badge>
                    <Badge variant={r.published ? "success" : "secondary"}>{r.published ? "Published" : "Unpublished"}</Badge>
                    <form action={async () => {
                      "use server";
                      const s = await createClient();
                      const u = (await s.auth.getUser()).data.user?.id;
                      await s.from("official_election_results").update({ verified_by: u, verified_at: new Date().toISOString() }).eq("id", r.id);
                      await s.from("result_verifications").insert({ result_id: r.id, verifier_id: u });
                    }} className="inline">
                      <Button type="submit" size="sm" variant="outline">Verify</Button>
                    </form>
                    <form action={async () => {
                      "use server";
                      const s = await createClient();
                      await s.from("official_election_results").update({ published: true, published_at: new Date().toISOString() }).eq("id", r.id);
                    }} className="inline">
                      <Button type="submit" size="sm" variant="secondary">Publish</Button>
                    </form>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {(teams ?? []).length === 0 && <p className="text-sm text-muted-foreground">No approved teams / election not configured.</p>}
      </div>
    </div>
  );
}