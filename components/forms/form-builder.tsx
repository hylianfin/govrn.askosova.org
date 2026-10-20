"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Check, Copy, Eye, Pencil, Plus, Trash2, X, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FormCard, FormRenderer, QuestionBlock } from "@/components/forms/form-renderer";
import { CHOICE_TYPES, SCOPE_LABELS, TYPE_LABELS } from "@/lib/forms";
import {
  createNewVersion, createQuestion, duplicateQuestion, moveQuestion, publishVersion, removeQuestion, saveQuestion, updateFormMeta,
  type QuestionPatch,
} from "@/lib/actions/forms";
import type { FormQuestion } from "@/lib/types";

type Kind = "executive_team" | "senate";
type Save = "idle" | "saving" | "saved" | "error";

const field =
  "w-full border-0 border-b border-border bg-transparent px-0 py-1.5 outline-none transition-[border-color,box-shadow] focus:border-primary focus:shadow-[0_1px_0_0_var(--primary)]";

const patchOf = (q: FormQuestion): QuestionPatch => ({
  label: q.label, description: q.description, type: q.type, scope: q.scope, required: q.required, options: q.options,
});

export function FormBuilder({
  kind, path, meta, version, initialQuestions,
}: {
  kind: Kind;
  path: string;
  meta: { title: string; description: string };
  version: { id: string; number: number; status: "draft" | "published" | "archived" };
  initialQuestions: FormQuestion[];
}) {
  const router = useRouter();
  const [questions, setQuestions] = useState<FormQuestion[]>(initialQuestions);
  const [activeId, setActiveId] = useState<string | null>(initialQuestions[0]?.id ?? null);
  const [title, setTitle] = useState(meta.title);
  const [description, setDescription] = useState(meta.description);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [save, setSave] = useState<Save>("idle");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const qref = useRef(questions);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const dirty = useRef<Set<string>>(new Set());
  const metaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef(0);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty.current.size || inflight.current) e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  function track<T extends { ok: boolean; error?: string }>(p: Promise<T>) {
    inflight.current++;
    setSave("saving");
    return p.then((r) => {
      inflight.current--;
      if (!r.ok) { setError(r.error ?? "Could not save."); setSave("error"); }
      else if (inflight.current === 0 && dirty.current.size === 0) setSave("saved");
      return r;
    });
  }

  async function persistQuestion(id: string) {
    delete timers.current[id];
    dirty.current.delete(id);
    const q = qref.current.find((x) => x.id === id);
    if (q) await track(saveQuestion(id, patchOf(q)));
  }

  function edit(id: string, patch: Partial<FormQuestion>) {
    const next = qref.current.map((q) => (q.id === id ? { ...q, ...patch } : q));
    qref.current = next;
    setQuestions(next);
    dirty.current.add(id);
    setSave("saving");
    setError(null);
    clearTimeout(timers.current[id]);
    timers.current[id] = setTimeout(() => { void persistQuestion(id); }, 700);
  }

  async function flush() {
    await Promise.all(Object.keys(timers.current).map((id) => { clearTimeout(timers.current[id]); return persistQuestion(id); }));
  }

  async function structural(run: () => ReturnType<typeof createQuestion>, focusNew?: boolean) {
    setBusy(true);
    await flush();
    const before = new Set(qref.current.map((q) => q.id));
    const res = await run();
    setBusy(false);
    if (!res.ok) { setError(res.error); setSave("error"); return; }
    qref.current = res.questions;
    setQuestions(res.questions);
    setSave("saved");
    if (focusNew) setActiveId(res.questions.find((q) => !before.has(q.id))?.id ?? null);
  }

  function metaChanged(t: string, d: string) {
    if (metaTimer.current) clearTimeout(metaTimer.current);
    setSave("saving");
    metaTimer.current = setTimeout(() => { void track(updateFormMeta(kind, { title: t, description: d })); }, 700);
  }

  async function versionAction(fn: () => Promise<{ error?: string; success?: string }>) {
    setBusy(true);
    await flush();
    const r = await fn();
    setBusy(false);
    if (r.error) setError(r.error); else router.refresh();
  }

  const scopes = (kind === "executive_team" ? ["team", "individual"] : ["applicant"]) as FormQuestion["scope"][];
  const live = version.status === "published";

  const statusLine = { idle: "", saving: "Saving…", saved: "All changes saved", error: "Not saved" }[save];

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant={live ? "success" : version.status === "draft" ? "warning" : "secondary"}>Version {version.number} · {version.status}</Badge>
          <span className={cn("flex items-center gap-1 text-xs", save === "error" ? "text-danger" : "text-muted-foreground")} aria-live="polite">
            {save === "saved" && <Check className="h-3 w-3 text-success" />}{statusLine}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border border-border bg-card p-0.5" role="tablist" aria-label="Editor mode">
            {([["edit", "Edit", Pencil], ["preview", "Preview", Eye]] as const).map(([m, label, Icon]) => (
              <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
                className={cn("flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium", mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" disabled={busy}
            onClick={() => { if (confirm("Create a new draft copy of this form? Applicants keep using the published version until you publish the draft.")) void versionAction(() => createNewVersion(kind, path)); }}>
            New draft version
          </Button>
          {version.status !== "published" && (
            <Button size="sm" disabled={busy}
              onClick={() => { if (confirm("Publish this version? New applications will use it immediately.")) void versionAction(() => publishVersion(version.id, path)); }}>
              Publish
            </Button>
          )}
        </div>
      </div>

      {live && (
        <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>This version is live. Edits apply immediately to applicants who have not submitted yet. Use <strong>New draft version</strong> to prepare bigger changes safely.</span>
        </div>
      )}
      {error && (
        <div role="alert" className="flex items-start justify-between gap-2 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          <span>{error}</span>
          <button aria-label="Dismiss" onClick={() => setError(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      {mode === "preview" ? (
        <FormRenderer preview applicationId="preview" title={title} description={description} questions={questions} initialAnswers={{}} lockedReason="Preview only. Nothing you enter here is saved." submitLabel="Submit" titleAs="h2" />
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <div className="h-2.5 bg-primary" />
            <div className="space-y-2 p-5 sm:p-6">
              <input aria-label="Form title" value={title} onChange={(e) => { setTitle(e.target.value); metaChanged(e.target.value, description); }} className={cn(field, "text-2xl font-bold sm:text-3xl")} placeholder="Form title" />
              <textarea aria-label="Form description" rows={2} value={description} onChange={(e) => { setDescription(e.target.value); metaChanged(title, e.target.value); }} className={cn(field, "resize-none text-sm")} placeholder="Form description" />
            </div>
          </div>

          {questions.map((q, i) => {
            const active = q.id === activeId;
            if (!active) {
              return (
                <div key={q.id} onClick={() => setActiveId(q.id)} className="cursor-pointer">
                  <div className="pointer-events-none"><QuestionBlock q={q} value={undefined} onChange={() => {}} disabled /></div>
                </div>
              );
            }
            const isChoice = CHOICE_TYPES.includes(q.type);
            const opts = q.options ?? [];
            const setOpts = (o: string[]) => edit(q.id, { options: o });
            return (
              <div key={q.id} className="relative">
                <FormCard active>
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-[1fr_14rem]">
                      <input aria-label="Question" autoFocus value={q.label} onChange={(e) => edit(q.id, { label: e.target.value })} className={cn(field, "bg-muted/60 px-3 text-base")} placeholder="Question" />
                      <select aria-label="Question type" value={q.type}
                        onChange={(e) => {
                          const type = e.target.value as FormQuestion["type"];
                          const needs = CHOICE_TYPES.includes(type) || type === "checkbox";
                          edit(q.id, { type, options: needs ? (opts.length ? opts : [type === "checkbox" ? "I confirm" : "Option 1"]) : null });
                        }}
                        className="h-10 rounded-md border border-border bg-card px-3 text-sm outline-none focus:border-primary">
                        {(Object.keys(TYPE_LABELS) as FormQuestion["type"][]).map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                      </select>
                    </div>
                    <input aria-label="Description" value={q.description ?? ""} onChange={(e) => edit(q.id, { description: e.target.value })} className={cn(field, "text-sm")} placeholder="Description (optional)" />

                    {isChoice && (
                      <ul className="space-y-1">
                        {opts.map((o, oi) => (
                          <li key={oi} className="flex items-center gap-2">
                            <span aria-hidden className={cn("h-4 w-4 shrink-0 border border-muted-foreground/50", q.type === "single_choice" ? "rounded-full" : q.type === "multiple_choice" ? "rounded-sm" : "border-0 text-xs text-muted-foreground")}>{q.type === "dropdown" ? `${oi + 1}.` : ""}</span>
                            <input aria-label={`Option ${oi + 1}`} value={o} onChange={(e) => setOpts(opts.map((x, xi) => (xi === oi ? e.target.value : x)))} className={cn(field, "text-sm")} />
                            <button type="button" aria-label={`Remove option ${oi + 1}`} disabled={opts.length <= 1} onClick={() => setOpts(opts.filter((_, xi) => xi !== oi))} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-danger disabled:opacity-30"><X className="h-4 w-4" /></button>
                          </li>
                        ))}
                        <li>
                          <button type="button" onClick={() => setOpts([...opts, `Option ${opts.length + 1}`])} className="ml-6 py-1 text-sm font-medium text-primary hover:underline">Add option</button>
                        </li>
                      </ul>
                    )}
                    {q.type === "checkbox" && (
                      <input aria-label="Checkbox label" value={opts[0] ?? ""} onChange={(e) => setOpts([e.target.value])} className={cn(field, "text-sm")} placeholder="Checkbox label, e.g. I confirm I meet the requirements" />
                    )}
                    {!isChoice && q.type !== "checkbox" && (
                      <p className="border-b border-dashed border-border pb-2 text-sm text-muted-foreground sm:w-2/3">{TYPE_LABELS[q.type]} text</p>
                    )}

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3">
                      {scopes.length > 1 && (
                        <select aria-label="Who answers" value={q.scope} onChange={(e) => edit(q.id, { scope: e.target.value as FormQuestion["scope"] })} className="h-8 rounded-md border border-border bg-card px-2 text-xs outline-none focus:border-primary">
                          {scopes.map((s) => <option key={s} value={s}>{SCOPE_LABELS[s]}</option>)}
                        </select>
                      )}
                      <div className="ml-auto flex items-center gap-1">
                        <IconBtn label="Move up" disabled={busy || i === 0} onClick={() => structural(() => moveQuestion(kind, q.id, "up"))}><ArrowUp className="h-4 w-4" /></IconBtn>
                        <IconBtn label="Move down" disabled={busy || i === questions.length - 1} onClick={() => structural(() => moveQuestion(kind, q.id, "down"))}><ArrowDown className="h-4 w-4" /></IconBtn>
                        <IconBtn label="Duplicate" disabled={busy} onClick={() => structural(() => duplicateQuestion(kind, q.id))}><Copy className="h-4 w-4" /></IconBtn>
                        <IconBtn label="Delete question" disabled={busy} danger onClick={() => { if (confirm("Delete this question? Answers already given to it are removed too.")) void structural(() => removeQuestion(kind, q.id)); }}><Trash2 className="h-4 w-4" /></IconBtn>
                        <span className="mx-2 h-6 w-px bg-border" />
                        <label className="flex cursor-pointer items-center gap-2 text-sm">
                          Required
                          <button type="button" role="switch" aria-checked={q.required} onClick={() => edit(q.id, { required: !q.required })}
                            className={cn("relative h-5 w-9 rounded-full transition-colors", q.required ? "bg-primary" : "bg-border")}>
                            <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all", q.required ? "left-[1.125rem]" : "left-0.5")} />
                          </button>
                        </label>
                      </div>
                    </div>
                  </div>
                </FormCard>
                <div className="mt-2 flex justify-end xl:absolute xl:-right-14 xl:top-0 xl:mt-0">
                  <button type="button" aria-label="Add question below" title="Add question" disabled={busy} onClick={() => structural(() => createQuestion(kind, q.id), true)}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-primary shadow-sm hover:bg-primary hover:text-primary-foreground disabled:opacity-50">
                    <Plus className="h-5 w-5" />
                  </button>
                </div>
              </div>
            );
          })}

          {questions.length === 0 && (
            <FormCard><p className="text-sm text-muted-foreground">No questions yet.</p></FormCard>
          )}
          <Button type="button" variant="outline" disabled={busy} onClick={() => structural(() => createQuestion(kind, questions.at(-1)?.id ?? null), true)}>
            <Plus className="h-4 w-4" /> Add question
          </Button>
        </>
      )}
    </div>
  );
}

function IconBtn({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick}
      className={cn("rounded-md p-2 text-muted-foreground hover:bg-muted disabled:opacity-30", danger ? "hover:text-danger" : "hover:text-foreground")}>
      {children}
    </button>
  );
}
