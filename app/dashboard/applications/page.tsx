import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS } from "@/lib/types";

export default async function ApplicationsPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data: apps } = await supabase
    .from("applications")
    .select("id, kind, status, created_at, submitted_at")
    .or(`applicant_id.eq.${user?.id}`)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-primary">My Applications</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Executive Team</CardTitle><CardDescription>Apply as a four-member team.</CardDescription></CardHeader>
          <CardContent><Button asChild><Link href="/dashboard/applications/executive-team">Open</Link></Button></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Student Senate</CardTitle><CardDescription>Apply individually.</CardDescription></CardHeader>
          <CardContent><Button asChild><Link href="/dashboard/applications/senate">Open</Link></Button></CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle>Submitted applications</CardTitle></CardHeader>
        <CardContent>
          <ul className="divide-y divide-border">
            {(apps ?? []).map((a: any) => (
              <li key={a.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">{a.kind === "executive_team" ? "Executive Team" : "Senate"}</p>
                  <p className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</p>
                </div>
                <Badge variant="secondary">{STATUS_LABELS[a.status as keyof typeof STATUS_LABELS] ?? a.status}</Badge>
              </li>
            ))}
            {(apps ?? []).length === 0 && <li className="py-3 text-sm text-muted-foreground">No applications yet.</li>}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}