import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default async function AdminEligibilityRulesPage() {
  const supabase = await createClient();
  const { data: rules } = await supabase.from("eligibility_rules").select("*").order("scope").order("display_order");

  const conflicts = (rules ?? []).filter((r: any) => r.is_conflicting);
  const conflictGroups = new Map<string, any[]>();
  conflicts.forEach((r: any) => {
    if (!conflictGroups.has(r.conflict_group)) conflictGroups.set(r.conflict_group, []);
    conflictGroups.get(r.conflict_group)!.push(r);
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-primary">Eligibility Rules</h1>

      {Array.from(conflictGroups.entries()).map(([g, rs]) => {
        const activeCount = rs.filter((r: any) => r.is_active).length;
        if (activeCount <= 1) return null;
        return (
          <Card key={g} className="border-warning">
            <CardHeader><CardTitle className="text-warning">Conflicting rules detected</CardTitle></CardHeader>
            <CardContent className="text-sm">
              <p>Multiple conflicting attendance rules are active. Select the official rule before publishing the Senate application.</p>
              <ul className="mt-2 list-disc pl-5">
                {rs.map((r: any) => <li key={r.id}>{r.label} {r.is_active ? "(active)" : ""}</li>)}
              </ul>
            </CardContent>
          </Card>
        );
      })}

      <Card>
        <CardHeader><CardTitle>Rules</CardTitle></CardHeader>
        <CardContent>
          <ul className="divide-y divide-border">
            {(rules ?? []).map((r: any) => (
              <li key={r.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">{r.label}</p>
                  <p className="text-xs text-muted-foreground">{r.scope} · {r.rule_type} {r.is_conflicting ? "· conflicting" : ""}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={r.is_active ? "success" : "secondary"}>{r.is_active ? "Active" : "Inactive"}</Badge>
                  <form action={async () => { "use server"; const s = await createClient(); await s.from("eligibility_rules").update({ is_active: !r.is_active }).eq("id", r.id); }}>
                    <Button type="submit" size="sm" variant="outline">{r.is_active ? "Disable" : "Enable"}</Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Add rule</CardTitle></CardHeader>
        <CardContent>
          <form action={async (fd: FormData) => {
            "use server";
            const s = await createClient();
            const { data: e } = await s.from("elections").select("id").order("created_at", { ascending: false }).limit(1).maybeSingle();
            await s.from("eligibility_rules").insert({
              election_id: e?.id,
              scope: fd.get("scope"),
              key: String(fd.get("key") || "").toLowerCase().replace(/\s+/g, "_"),
              label: fd.get("label"),
              description: fd.get("description") || null,
              rule_type: fd.get("ruleType"),
              config: {},
              is_conflicting: fd.get("conflicting") === "on",
              conflict_group: fd.get("conflictGroup") || null,
              display_order: Number(fd.get("order") || 0),
            });
          }} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2"><Label>Scope</Label>
                <select name="scope" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="executive">executive</option>
                  <option value="senate">senate</option>
                </select>
              </div>
              <div className="space-y-2"><Label>Rule type</Label>
                <select name="ruleType" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  {["team_size","positions","grade_levels","min_gpa","behavior","documents","acknowledgments","attendance","community_service","suspensions","detentions"].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-2"><Label>Key</Label><Input name="key" required /></div>
            <div className="space-y-2"><Label>Label</Label><Input name="label" required /></div>
            <div className="space-y-2"><Label>Description</Label><Textarea name="description" /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2"><Label>Conflict group</Label><Input name="conflictGroup" /></div>
              <div className="space-y-2"><Label>Order</Label><Input name="order" type="number" defaultValue="0" /></div>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="conflicting" /> Conflicting rule</label>
            <Button type="submit">Add rule</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}