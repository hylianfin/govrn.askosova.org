import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateSenateApplication } from "@/lib/actions/senate";
import { FormRenderer } from "@/components/forms/form-renderer";
import { ReviewFeedback } from "@/components/forms/review-feedback";
import { StatusBadge } from "@/components/dashboard/primitives";
import { buildAnswerMap, EDITABLE_STATUSES } from "@/lib/forms";
import { STATUS_LABELS } from "@/lib/types";

export default async function SenateApplicationPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  // An application already sent through Google Forms under this name: verify it instead of starting a blank one.
  const { data: found } = await supabase.rpc("pending_import_for_me");
  if (((found ?? []) as { kind: string }[]).some((r) => r.kind === "senate")) redirect("/dashboard/verify");
  const app = await getOrCreateSenateApplication();

  if (!app || !user) {
    return <p className="text-muted-foreground">The Senate application is not open yet.</p>;
  }

  const [{ data: form }, { data: questions }, { data: answers }] = await Promise.all([
    supabase.from("application_forms").select("title, description").eq("id", app.form_id).maybeSingle(),
    supabase.from("application_questions").select("*").eq("version_id", app.form_version_id).order("order_index"),
    supabase.from("application_answers").select("question_id, respondent_id, value").eq("application_id", app.id),
  ]);

  const editable = EDITABLE_STATUSES.includes(app.status);
  return (
    <div className="space-y-4">
    <ReviewFeedback applicationId={app.id} status={app.status} />
    <FormRenderer
      applicationId={app.id}
      title={form?.title ?? "Student Senate Application"}
      description={form?.description}
      questions={questions ?? []}
      initialAnswers={buildAnswerMap(questions ?? [], answers ?? [], user.id)}
      readOnly={!editable}
      lockedReason={editable ? undefined : "Your application has been submitted. Staff will contact you if they need changes."}
      statusBadge={<StatusBadge status={app.status} label={STATUS_LABELS[app.status as keyof typeof STATUS_LABELS] ?? app.status} />}
    />
    </div>
  );
}
