import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminAuditLogsPage() {
  const supabase = await createClient();
  const { data: logs } = await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(100);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-primary">Audit Logs</h1>
      <Card>
        <CardHeader><CardTitle>Recent activity</CardTitle></CardHeader>
        <CardContent>
          <ul className="divide-y divide-border text-sm">
            {(logs ?? []).map((l: any) => (
              <li key={l.id} className="py-2">
                <p className="font-medium">{l.action} {l.entity_type ? `· ${l.entity_type}` : ""}</p>
                <p className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString()}</p>
              </li>
            ))}
            {(logs ?? []).length === 0 && <li className="py-2 text-muted-foreground">No logs.</li>}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}