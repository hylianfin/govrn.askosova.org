"use client";

import { useActionState, useState } from "react";
import { AlertCircle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormHeaderCard, QuestionBlock } from "@/components/forms/form-renderer";
import { isAnswered, type AnswerMap } from "@/lib/forms";
import { createTeam } from "@/lib/actions/executive";
import { updateProfile } from "@/lib/actions/profile";
import type { FormQuestion } from "@/lib/types";

function q(id: string, label: string, type: FormQuestion["type"], required: boolean, options: string[] | null = null, description: string | null = null): FormQuestion {
  return { id, form_id: "", version_id: "", scope: "applicant", label, description, type, required, options, order_index: 0 };
}

function useSimpleForm(questions: FormQuestion[], initial: AnswerMap) {
  const [values, setValues] = useState<AnswerMap>(initial);
  const [errors, setErrors] = useState<Set<string>>(new Set());
  const set = (id: string, v: { text: string; values?: string[] }) => {
    setValues((p) => ({ ...p, [id]: v }));
    setErrors((p) => { if (!p.has(id)) return p; const n = new Set(p); n.delete(id); return n; });
  };
  const validate = (e: React.FormEvent) => {
    const missing = questions.filter((x) => x.required && !isAnswered(x, values[x.id]));
    if (missing.length) {
      e.preventDefault();
      setErrors(new Set(missing.map((m) => m.id)));
      document.querySelector(`[data-qid="${missing[0].id}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };
  return { values, errors, set, validate };
}

const POSITIONS: Record<string, string> = { President: "president", "Vice President": "vice_president", Secretary: "secretary", Treasurer: "treasurer" };

const TEAM_QS = [
  q("name", "Team name", "short_text", true),
  q("slogan", "Slogan", "short_text", false, null, "Optional. You can change it later in your campaign."),
  q("introduction", "Team introduction", "long_text", true, null, "Tell students who your team is and what you stand for."),
  q("position", "Your position on the team", "single_choice", true, Object.keys(POSITIONS), "You can invite the other three positions after creating the team."),
];

export function CreateTeamForm() {
  const [state, action, pending] = useActionState(createTeam, undefined);
  const f = useSimpleForm(TEAM_QS, { position: { text: "President" } });
  const text = (id: string) => f.values[id]?.text ?? "";
  return (
    <form action={action} onSubmit={f.validate} noValidate className="mx-auto w-full max-w-3xl space-y-4">
      <FormHeaderCard as="h2" title="Create your team" description="Start an Executive Team application. Every team has four members: President, Vice President, Secretary and Treasurer." />
      {state?.error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {state.error}
        </div>
      )}
      {TEAM_QS.map((x) => <QuestionBlock key={x.id} q={x} value={f.values[x.id]} onChange={(v) => f.set(x.id, v)} error={f.errors.has(x.id)} />)}
      <input type="hidden" name="name" value={text("name")} />
      <input type="hidden" name="slogan" value={text("slogan")} />
      <input type="hidden" name="introduction" value={text("introduction")} />
      <input type="hidden" name="myPosition" value={POSITIONS[text("position")] ?? ""} />
      <div><Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create team"}</Button></div>
    </form>
  );
}

export function ProfileForm({ initial }: { initial: { fullName: string; gradeLevel: number | null; homeroom: string | null } }) {
  const [state, action, pending] = useActionState(updateProfile, undefined);
  const qs = [
    q("fullName", "Full name", "short_text", true),
    q("grade", "Grade level", "single_choice", false, ["9", "10", "11", "12"]),
    q("homeroom", "Homeroom teacher", "short_text", false),
  ];
  const f = useSimpleForm(qs, {
    fullName: { text: initial.fullName },
    ...(initial.gradeLevel ? { grade: { text: String(initial.gradeLevel) } } : {}),
    ...(initial.homeroom ? { homeroom: { text: initial.homeroom } } : {}),
  });
  const text = (id: string) => f.values[id]?.text ?? "";
  return (
    <form action={action} onSubmit={f.validate} noValidate className="mx-auto w-full max-w-3xl space-y-4">
      <FormHeaderCard as="h2" title="Your profile" description="Used on your applications and shown to reviewers." />
      {qs.map((x) => <QuestionBlock key={x.id} q={x} value={f.values[x.id]} onChange={(v) => f.set(x.id, v)} error={f.errors.has(x.id)} />)}
      <input type="hidden" name="fullName" value={text("fullName")} />
      <input type="hidden" name="gradeLevel" value={text("grade")} />
      <input type="hidden" name="homeroom" value={text("homeroom")} />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save profile"}</Button>
        {state?.success && <span role="status" className="flex items-center gap-1 text-sm text-success"><Check className="h-4 w-4" /> {state.success}</span>}
        {state?.error && <span role="alert" className="text-sm text-danger">{state.error}</span>}
      </div>
    </form>
  );
}
