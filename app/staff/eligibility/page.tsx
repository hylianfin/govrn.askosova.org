import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function StaffEligibilityPage() {
  const supabase = await createClient();
  const { data: checks } = await supabase.from("eligibility_checks").select("*, eligibility_rules(label)").order("created_at", { ascending: false });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-primary">Eligibility Checks</h1>
      <Card>
        <CardHeader><CardTitle>Checks</CardTitle></CardHeader>
        <CardContent>
          <ul className="divide-y divide-border">
            {(checks ?? []).map((c: any) => (
              <li key={c.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">{c.eligibility_rules?.label}</p>
                  <p className="text-xs text-muted-foreground">{c.notes || "No notes"}</p>
                </div>
                <Badge variant={c.status === "verified" ? "success" : c.status === "failed" ? "danger" : "warning"}>{c.status}</Badge>
              </li>
            ))}
            {(checks ?? []).length === 0 && <li className="py-3 text-sm text-muted-foreground">No checks.</li>}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}