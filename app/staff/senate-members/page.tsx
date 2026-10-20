import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function SenateMembersPage() {
  const supabase = await createClient();
  const { data: members } = await supabase.from("senate_memberships").select("*, profiles(full_name,email)").order("created_at", { ascending: false });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-primary">Senate Members</h1>
      <Card>
        <CardHeader><CardTitle>Roster</CardTitle></CardHeader>
        <CardContent>
          <ul className="divide-y divide-border">
            {(members ?? []).map((m: any) => (
              <li key={m.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">{m.profiles?.full_name || m.profiles?.email}</p>
                  <p className="text-xs text-muted-foreground">Grade {m.grade_level ?? "—"}</p>
                </div>
                <Badge variant={m.elected ? "success" : "secondary"}>{m.elected ? "Elected" : m.status}</Badge>
              </li>
            ))}
            {(members ?? []).length === 0 && <li className="py-3 text-sm text-muted-foreground">No members.</li>}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}