import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default async function StaffApplicationsPage() {
  const supabase = await createClient();
  const { data: apps } = await supabase.from("applications").select("id, kind, status, created_at, applicant_id").order("created_at", { ascending: false });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-primary">Applications</h1>
      <div className="flex gap-2">
        <Button asChild variant="outline" size="sm"><Link href="/staff/applications/executive-teams">Executive Teams</Link></Button>
        <Button asChild variant="outline" size="sm"><Link href="/staff/applications/senate">Senate Applicants</Link></Button>
      </div>
      <Card>
        <CardHeader><CardTitle>All applications</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-muted-foreground"><th className="py-2">Kind</th><th>Status</th><th>Submitted</th><th></th></tr></thead>
            <tbody>
              {(apps ?? []).map((a: any) => (
                <tr key={a.id} className="border-b">
                  <td className="py-2">{a.kind}</td>
                  <td><Badge variant="secondary">{a.status}</Badge></td>
                  <td>{a.created_at ? new Date(a.created_at).toLocaleDateString() : "—"}</td>
                  <td><Link href={`/staff/applications/${a.id}`} className="text-accent hover:underline">Open</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}