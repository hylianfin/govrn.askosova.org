"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Lock } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { QuestionField } from "@/components/forms/question-field";
import { isAnswered, type AnswerMap, type AnswerValue } from "@/lib/forms";
import { saveFormAnswers } from "@/lib/actions/form-answers";
import type { FormQuestion } from "@/lib/types";

type Status = "idle" | "dirty" | "saving" | "saved" | "error";

export function FormCard({ children, invalid, active }: { children: React.ReactNode; invalid?: boolean; active?: boolean }) {
  return (
    <div className={cn(
      "relative rounded-lg border bg-card p-5 shadow-sm transition-colors sm:p-6",
      invalid ? "border-danger" : "border-border",
      active && "border-l-4 border-l-primary",
    )}>
      {children}
    </div>
  );
}

export function FormHeaderCard({ title, description, status, as: Heading = "h1" }: { title: string; description?: string | null; status?: React.ReactNode; as?: "h1" | "h2" }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="h-2.5 bg-primary" />
      <div className="space-y-2 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <Heading className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</Heading>
          {status}
        </div>
        {description && <p className="whitespace-pre-line text-sm text-muted-foreground">{description}</p>}
        <p className="border-t border-border pt-3 text-xs text-danger">* Indicates required question</p>
      </div>
    </div>
  );
}

export function QuestionBlock({
  q, value, onChange, disabled, error, active, onFocus,
}: {
  q: FormQuestion; value?: AnswerValue; onChange: (v: AnswerValue) => void; disabled?: boolean; error?: boolean; active?: boolean; onFocus?: () => void;
}) {
  return (
    <FormCard invalid={error} active={active}>
      <div data-qid={q.id} onFocusCapture={onFocus} className="space-y-3">
        <div>
          <p className="text-base font-medium leading-snug">
            {q.label}{q.required && <span className="ml-1 text-danger" aria-label="required">*</span>}
          </p>
          {q.description && <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{q.description}</p>}
        </div>
        <QuestionField q={q} value={value} onChange={onChange} disabled={disabled} invalid={error} />
        {error && (
          <p role="alert" className="flex items-center gap-1.5 text-sm text-danger">
            <AlertCircle className="h-4 w-4" /> This is a required question
          </p>
        )}
      </div>
    </FormCard>
  );
}

const SECTION_TITLES: Record<string, { title: string; hint: string }> = {
  team: { title: "About your team", hint: "One set of answers shared by every member of the team." },
  individual: { title: "About you", hint: "Each team member answers this section for themselves." },
};

export function FormRenderer({
  applicationId, title, description, questions, initialAnswers, readOnly, lockedReason, preview, submitLabel = "Submit", statusBadge, titleAs,
}: {
  applicationId: string;
  title: string;
  description?: string | null;
  questions: FormQuestion[];
  initialAnswers: AnswerMap;
  readOnly?: boolean;
  lockedReason?: string;
  preview?: boolean;
  submitLabel?: string;
  statusBadge?: React.ReactNode;
  titleAs?: "h1" | "h2";
}) {
  const router = useRouter();
  const [values, setValues] = useState<AnswerMap>(initialAnswers);
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Set<string>>(new Set());
  const [banner, setBanner] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(values);
  const locked = !!readOnly || !!preview;

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const ordered = [...questions].sort((a, b) => a.order_index - b.order_index);
  const scopes = Array.from(new Set(ordered.map((q) => q.scope)));
  const sectioned = scopes.length > 1;

  async function persist(submit: boolean) {
    setStatus("saving");
    const res = await saveFormAnswers(applicationId, latest.current, submit);
    if (!res.ok) {
      setStatus("error");
      setBanner(res.error);
      if (res.missing?.length) setErrors(new Set(res.missing));
      if (res.missing?.length) document.querySelector(`[data-qid="${res.missing[0]}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      else window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setStatus("saved");
    if (res.submitted) router.refresh();
  }

  function change(id: string, v: AnswerValue) {
    const next = { ...latest.current, [id]: v };
    latest.current = next;
    setValues(next);
    setStatus("dirty");
    setBanner(null);
    if (errors.has(id)) setErrors((prev) => { const n = new Set(prev); n.delete(id); return n; });
    if (preview) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void persist(false); }, 1500);
  }

  function submit() {
    if (preview) return;
    if (timer.current) clearTimeout(timer.current);
    const mine = ordered.filter((q) => q.required && !isAnswered(q, latest.current[q.id]));
    if (mine.length) {
      setErrors(new Set(mine.map((q) => q.id)));
      setBanner("Please answer the required questions before submitting.");
      document.querySelector(`[data-qid="${mine[0].id}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setErrors(new Set());
    startTransition(async () => { await persist(true); });
  }

  function saveDraft() {
    if (timer.current) clearTimeout(timer.current);
    startTransition(async () => { await persist(false); });
  }

  const requiredTotal = ordered.filter((q) => q.required).length;
  const requiredDone = ordered.filter((q) => q.required && isAnswered(q, values[q.id])).length;
  const pct = requiredTotal ? Math.round((requiredDone / requiredTotal) * 100) : 100;

  const statusText = {
    idle: "", dirty: "Unsaved changes", saving: "Saving…", saved: "Draft saved", error: "Not saved",
  }[status];

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 pb-24">
      <FormHeaderCard title={title} description={description} status={statusBadge} as={titleAs} />

      {locked && lockedReason && (
        <div className="flex items-start gap-2 rounded-lg border border-border bg-muted px-4 py-3 text-sm">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /> {lockedReason}
        </div>
      )}

      {banner && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {banner}
        </div>
      )}

      {ordered.length === 0 && (
        <FormCard><p className="text-sm text-muted-foreground">This form has no questions yet.</p></FormCard>
      )}

      {ordered.map((q, i) => (
        <div key={q.id} className="space-y-4">
          {sectioned && (i === 0 || ordered[i - 1].scope !== q.scope) && (
            <div className="rounded-lg border border-border bg-primary/5 px-5 py-3">
              <h2 className="font-semibold text-primary">{SECTION_TITLES[q.scope]?.title ?? "Questions"}</h2>
              {SECTION_TITLES[q.scope] && <p className="text-xs text-muted-foreground">{SECTION_TITLES[q.scope].hint}</p>}
            </div>
          )}
          <QuestionBlock q={q} value={values[q.id]} onChange={(v) => change(q.id, v)} disabled={locked} error={errors.has(q.id)} />
        </div>
      ))}

      {!locked && (
        <div className="sticky bottom-0 -mx-4 border-t border-border bg-card/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border">
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={submit} disabled={pending || ordered.length === 0}>{pending ? "Working…" : submitLabel}</Button>
            <Button type="button" variant="outline" onClick={saveDraft} disabled={pending || status === "saving"}>Save draft</Button>
            <div className="ml-auto flex min-w-[10rem] flex-col items-end gap-1" aria-live="polite">
              <span className={cn("flex items-center gap-1 text-xs", status === "error" ? "text-danger" : "text-muted-foreground")}>
                {status === "saved" && <Check className="h-3 w-3 text-success" />}{statusText}
              </span>
              <div className="h-1.5 w-40 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Required questions answered">
                <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-[11px] text-muted-foreground">{requiredDone} of {requiredTotal} required answered</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
