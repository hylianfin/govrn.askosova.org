import Link from "next/link";
import { ClipboardList, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { PageHeader, EmptyState } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";

export default async function AdminFormsPage() {
  const supabase = await createClient();
  const { data: forms } = await supabase.from("application_forms").select("*, application_questions(count), application_form_versions(version_number, status)").order("created_at");

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Election setup" title="Application forms" description="Open a form to edit its questions, preview it, and publish new versions."
        actions={<Button asChild variant="outline"><Link href="/admin/forms/import">Import Google Forms responses</Link></Button>} />
      {(forms ?? []).length === 0 ? <EmptyState>No forms configured.</EmptyState> : (
        <ul className="grid gap-4 md:grid-cols-2">
          {(forms ?? []).map((f: any) => {
            const versions: any[] = f.application_form_versions ?? [];
            const latest = [...versions].sort((a, b) => b.version_number - a.version_number)[0];
            const href = f.kind === "executive_team" ? "/admin/forms/executive-team" : "/admin/forms/senate";
            return (
              <li key={f.id}>
                <Link href={href} className="group block h-full overflow-hidden rounded-xl border border-border bg-card shadow-sm transition hover:border-primary/40 hover:shadow-md">
                  <div className="h-2 bg-primary" />
                  <div className="space-y-3 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><ClipboardList className="h-5 w-5" /></div>
                        <div>
                          <p className="font-semibold leading-tight">{f.title}</p>
                          <p className="text-xs text-muted-foreground">{f.application_questions?.[0]?.count ?? 0} questions</p>
                        </div>
                      </div>
                      <Badge variant={f.is_published ? "success" : "warning"}>{f.is_published ? "Published" : "Draft"}</Badge>
                    </div>
                    {f.description && <p className="text-sm text-muted-foreground">{f.description}</p>}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{latest ? `Latest: version ${latest.version_number} (${latest.status})` : "No versions"}</span>
                      <span className="flex items-center gap-1 font-medium text-primary">Edit <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></span>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
