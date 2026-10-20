import { createClient } from "@/lib/supabase/server";
import { FormBuilder } from "@/components/forms/form-builder";
import { PageHeader } from "@/components/dashboard/primitives";

const PATHS = { executive_team: "/admin/forms/executive-team", senate: "/admin/forms/senate" } as const;
const HEADINGS = { executive_team: "Executive Team form", senate: "Student Senate form" } as const;

export async function BuilderPage({ kind }: { kind: keyof typeof PATHS }) {
  const supabase = await createClient();
  const { data: form } = await supabase.from("application_forms").select("*").eq("kind", kind).limit(1).maybeSingle();
  if (!form) return <p className="text-muted-foreground">This form does not exist yet.</p>;

  const { data: version } = await supabase
    .from("application_form_versions").select("*").eq("form_id", form.id).order("version_number", { ascending: false }).limit(1).maybeSingle();
  if (!version) return <p className="text-muted-foreground">This form has no versions yet.</p>;

  const { data: questions } = await supabase
    .from("application_questions").select("*").eq("version_id", version.id).order("order_index").order("created_at");

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Form builder" title={HEADINGS[kind]} description="Edit questions like a Google Form. Changes save automatically." />
      <FormBuilder
        key={version.id}
        kind={kind}
        path={PATHS[kind]}
        meta={{ title: form.title, description: form.description ?? "" }}
        version={{ id: version.id, number: version.version_number, status: version.status }}
        initialQuestions={questions ?? []}
      />
    </div>
  );
}
