import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default async function StaffSenateApplicantsPage() {
  const supabase = await createClient();
  const { data: apps } = await supabase
    .from("applications")
    .select("id, status, created_at, applicant_id, profiles(full_name,email)")
    .eq("kind", "senate")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-primary">Senate Applicants</h1>
      <Card>
        <CardHeader><CardTitle>Applicants</CardTitle></CardHeader>
        <CardContent>
          <ul className="divide-y divide-border">
            {(apps ?? []).map((a: any) => (
              <li key={a.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">{a.profiles?.full_name || a.profiles?.email || a.applicant_id}</p>
                  <p className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="secondary">{a.status}</Badge>
                  <Link href={`/staff/applications/${a.id}`} className="text-accent hover:underline text-sm">Review</Link>
                </div>
              </li>
            ))}
            {(apps ?? []).length === 0 && <li className="py-3 text-sm text-muted-foreground">No applicants.</li>}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}