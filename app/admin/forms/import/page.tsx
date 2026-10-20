import { Clock, Link2, Inbox } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, StatTile, Section } from "@/components/dashboard/primitives";
import { ImportWizard, type ImportableForm } from "@/components/forms/import-wizard";
import { ImportedList, type ImportedRow } from "@/components/forms/imported-list";

export default async function ImportResponsesPage() {
  const supabase = await createClient();
  const { data: forms } = await supabase.from("application_forms").select("id, kind, title").order("kind", { ascending: false });

  const importable: ImportableForm[] = [];
  for (const f of forms ?? []) {
    const { data: versions } = await supabase.from("application_form_versions").select("id, status").eq("form_id", f.id).order("version_number", { ascending: false });
    const v = (versions ?? []).find((x: any) => x.status === "published") ?? versions?.[0];
    if (!v) continue;
    const { data: qs } = await supabase.from("application_questions").select("id, label, required").eq("version_id", v.id).order("order_index");
    importable.push({ kind: f.kind, title: f.title, questions: (qs ?? []).map((q: any) => ({ id: q.id, label: q.label, required: q.required })) });
  }

  const { data: imported } = await supabase.from("imported_responses")
    .select("id, kind, email, full_name, team_name, status, note, submitted_at, created_at, linked_at, linked_application_id, answers")
    .order("created_at", { ascending: false }).limit(500);
  const rows: ImportedRow[] = (imported ?? []).map((r: any) => ({
    id: r.id, kind: r.kind, email: r.email, name: r.full_name, teamName: r.team_name, status: r.status, note: r.note, submittedAt: r.submitted_at,
    importedAt: r.created_at, linkedAt: r.linked_at, applicationId: r.linked_application_id, answered: Object.keys(r.answers ?? {}).length,
  }));
  const n = (s: string) => rows.filter((r) => r.status === s).length;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Election setup" title="Import Google Forms responses"
        description="Bring in applications that were already sent through Google Forms. Each response waits under its email address and is attached to the person automatically when they sign up with that email and confirm it." />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Waiting for sign-up" value={n("pending")} tone={n("pending") ? "warning" : "default"} icon={<Clock className="h-5 w-5" />} />
        <StatTile label="Linked to an account" value={n("linked")} tone="success" icon={<Link2 className="h-5 w-5" />} />
        <StatTile label="Imported in total" value={rows.length} icon={<Inbox className="h-5 w-5" />} />
      </div>
      {importable.length === 0 ? <p className="text-muted-foreground">No forms are set up yet.</p> : <ImportWizard forms={importable} />}
      <Section title="Imported responses" description="Pending ones turn into real applications the moment their owner signs up and confirms the email.">
        <ImportedList rows={rows} />
      </Section>
    </div>
  );
}
