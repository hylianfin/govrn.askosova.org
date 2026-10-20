"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormHeaderCard, QuestionBlock } from "@/components/forms/form-renderer";
import { isAnswered, type AnswerMap } from "@/lib/forms";
import { verifyMyApplication } from "@/lib/actions/verify";
import type { FormQuestion } from "@/lib/types";

const QS: FormQuestion[] = [
  { id: "grade", form_id: "", version_id: "", scope: "applicant", label: "What grade are you in?", description: null, type: "single_choice", required: true, options: ["9", "10", "11", "12"], order_index: 0 },
  { id: "teacher", form_id: "", version_id: "", scope: "applicant", label: "Who is your homeroom teacher?", description: "Type their name, for example Ms Esma Salihu. Capital letters and small spelling slips are fine.", type: "short_text", required: true, options: null, order_index: 1 },
];

const MESSAGES: Record<string, string> = {
  locked: "Too many tries. Please wait an hour, or ask a staff member to link your application.",
  ambiguous: "We found more than one matching application, so a staff member needs to link yours. Please ask them.",
  invalid: "Choose your grade and type your homeroom teacher's name.",
  unconfirmed: "Please confirm your email address first.",
};

export function VerifyForm({ kindLabel, name }: { kindLabel: string; name: string }) {
  const router = useRouter();
  const [values, setValues] = useState<AnswerMap>({});
  const [errors, setErrors] = useState<Set<string>>(new Set());
  const [banner, setBanner] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const missing = QS.filter((q) => q.required && !isAnswered(q, values[q.id]));
    if (missing.length) { setErrors(new Set(missing.map((m) => m.id))); return; }
    setBanner(null);
    startTransition(async () => {
      const r = await verifyMyApplication(Number(values.grade.text), values.teacher.text);
      if (r.status === "linked") { router.replace(r.kind === "senate" ? "/dashboard/applications/senate" : "/dashboard/team"); router.refresh(); return; }
      if (r.status === "no_match") setBanner(`That doesn't match the application sent for ${name}. Check the spelling of your homeroom teacher and your grade. ${r.left > 0 ? `You have ${r.left} ${r.left === 1 ? "try" : "tries"} left.` : "That was your last try for now."}`);
      else setBanner(("message" in r && r.message) || MESSAGES[r.status] || "Something went wrong. Please try again.");
    });
  }

  return (
    <form onSubmit={submit} noValidate className="mx-auto w-full max-w-3xl space-y-4">
      <FormHeaderCard as="h1" title="Is this your application?"
        description={`A ${kindLabel} was sent through Google Forms under the name “${name}”. Confirm it is you by answering two questions, and it will appear in your account.`} />
      {banner && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{banner}</div>
      )}
      {QS.map((q) => (
        <QuestionBlock key={q.id} q={q} value={values[q.id]} error={errors.has(q.id)}
          onChange={(v) => { setValues((p) => ({ ...p, [q.id]: v })); setErrors((p) => { const n = new Set(p); n.delete(q.id); return n; }); }} />
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Checking…" : "Verify it's me"}</Button>
        <p className="text-xs text-muted-foreground">Not you? Ignore this and use the normal application form.</p>
      </div>
    </form>
  );
}
