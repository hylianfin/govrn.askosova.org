"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, CheckCircle2, CircleHelp, RotateCcw, XCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { addReviewNote, reopenReview, setCriterion, submitReview, type CheckStatus, type Decision } from "@/lib/actions/review";

export type Criterion = {
  ruleId: string; label: string; description: string | null; status: CheckStatus; notes: string;
  hint?: { text: string; ok: boolean };
};

const OPTIONS: { value: CheckStatus; label: string; icon: typeof Check; on: string }[] = [
  { value: "verified", label: "Meets", icon: CheckCircle2, on: "border-success bg-success/10 text-success" },
  { value: "failed", label: "Does not meet", icon: XCircle, on: "border-danger bg-danger/10 text-danger" },
  { value: "requires_review", label: "Unsure", icon: CircleHelp, on: "border-warning bg-warning/10 text-warning" },
];

const DECISION_OPTIONS: { value: Decision; title: string; hint: string; on: string }[] = [
  { value: "approved", title: "Approve", hint: "Accept the application", on: "border-success bg-success/10" },
  { value: "changes_requested", title: "Request changes", hint: "Send it back to the applicant", on: "border-warning bg-warning/10" },
  { value: "rejected", title: "Deny", hint: "Reject the application", on: "border-danger bg-danger/10" },
];

const DECIDED: Record<string, string> = { approved: "Approved", rejected: "Denied", changes_requested: "Changes requested" };

export function ReviewPanel({
  applicationId, status, criteria: initial, lastReason,
}: { applicationId: string; status: string; criteria: Criterion[]; lastReason?: string | null }) {
  const router = useRouter();
  const [criteria, setCriteria] = useState(initial);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const decided = ["approved", "rejected", "changes_requested"].includes(status);
  const readyToDecide = ["submitted", "under_review"].includes(status);
  const met = criteria.filter((c) => c.status === "verified").length;
  const allMet = criteria.length > 0 ? met === criteria.length : true;
  const unmet = criteria.filter((c) => c.status !== "verified");

  function update(ruleId: string, patch: Partial<Criterion>, delay: number) {
    const next = criteria.map((c) => (c.ruleId === ruleId ? { ...c, ...patch } : c));
    setCriteria(next);
    setSaved(false);
    setError(null);
    clearTimeout(timers.current[ruleId]);
    const row = next.find((c) => c.ruleId === ruleId)!;
    timers.current[ruleId] = setTimeout(async () => {
      const r = await setCriterion(applicationId, ruleId, row.status, row.notes);
      if (!r.ok) setError(r.error); else setSaved(true);
    }, delay);
  }

  function fillFromCriteria() {
    const lines = unmet.map((c) => `- ${c.label}${c.notes ? `: ${c.notes}` : ""}`);
    if (!lines.length) return;
    const head = decision === "rejected" ? "The application does not meet these criteria:" : "Please address these points:";
    setComment((prev) => (prev.trim() ? `${prev.trim()}\n\n` : "") + `${head}\n${lines.join("\n")}`);
  }

  function confirm() {
    if (!decision) { setError("Choose Approve, Request changes or Deny."); return; }
    setError(null);
    startTransition(async () => {
      await Promise.all(Object.keys(timers.current).map((id) => { clearTimeout(timers.current[id]); const c = criteria.find((x) => x.ruleId === id); return c ? setCriterion(applicationId, id, c.status, c.notes) : null; }));
      const r = await submitReview(applicationId, decision, comment);
      if (!r.ok) { setError(r.error); return; }
      setComment(""); setDecision(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-base font-semibold">Eligibility criteria</h2>
            <p className="text-sm text-muted-foreground">{criteria.length ? `${met} of ${criteria.length} met` : "No criteria configured for this application"}</p>
          </div>
          <span className="text-xs text-muted-foreground" aria-live="polite">{saved ? "Saved" : ""}</span>
        </div>
        {criteria.length > 0 && (
          <div className="h-1.5 bg-muted"><div className="h-full bg-success transition-all" style={{ width: `${(met / criteria.length) * 100}%` }} /></div>
        )}
        <ul className="divide-y divide-border">
          {criteria.map((c) => (
            <li key={c.ruleId} className="space-y-2 px-5 py-4">
              <div>
                <p className="text-sm font-medium">{c.label}</p>
                {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
                {c.hint && <p className={cn("mt-1 text-xs", c.hint.ok ? "text-success" : "text-warning")}>System check: {c.hint.text}</p>}
              </div>
              <div role="radiogroup" aria-label={c.label} className="grid grid-cols-3 gap-1.5">
                {OPTIONS.map((o) => {
                  const on = c.status === o.value;
                  return (
                    <button key={o.value} type="button" role="radio" aria-checked={on} disabled={!readyToDecide && decided}
                      onClick={() => update(c.ruleId, { status: o.value }, 0)}
                      className={cn("flex items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors disabled:opacity-60",
                        on ? o.on : "border-border text-muted-foreground hover:bg-muted")}>
                      <o.icon className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{o.label}</span>
                    </button>
                  );
                })}
              </div>
              <input aria-label={`Note for ${c.label}`} value={c.notes} onChange={(e) => update(c.ruleId, { notes: e.target.value }, 700)} placeholder="Note (optional)"
                className="w-full border-0 border-b border-border bg-transparent px-0 py-1 text-sm outline-none focus:border-primary" />
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold">Decision</h2>
          {decided && <p className="text-sm text-muted-foreground">Current decision: <strong className="text-foreground">{DECIDED[status]}</strong></p>}
        </div>
        <div className="space-y-4 p-5">
          {decided && lastReason && <p className="whitespace-pre-line rounded-lg bg-muted px-3 py-2 text-sm">{lastReason}</p>}

          {decided ? (
            <Button variant="outline" disabled={pending} onClick={() => startTransition(async () => { const r = await reopenReview(applicationId); if (!r.ok) setError(r.error); else router.refresh(); })}>
              <RotateCcw className="h-4 w-4" /> Reopen for review
            </Button>
          ) : !readyToDecide ? (
            <p className="text-sm text-muted-foreground">The applicant has not submitted yet, so there is nothing to decide.</p>
          ) : (
            <>
              <div role="radiogroup" aria-label="Decision" className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                {DECISION_OPTIONS.map((o) => {
                  const blocked = o.value === "approved" && !allMet;
                  return (
                    <button key={o.value} type="button" role="radio" aria-checked={decision === o.value} disabled={blocked}
                      onClick={() => { setDecision(o.value); setError(null); }}
                      className={cn("rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                        decision === o.value ? `${o.on} ring-2 ring-offset-0` : "border-border hover:bg-muted",
                        decision === o.value && o.value === "approved" && "ring-success/30", decision === o.value && o.value === "rejected" && "ring-danger/30", decision === o.value && o.value === "changes_requested" && "ring-warning/30")}>
                      <p className="text-sm font-semibold">{o.title}</p>
                      <p className="text-xs text-muted-foreground">{o.hint}</p>
                    </button>
                  );
                })}
              </div>
              {!allMet && <p className="text-xs text-muted-foreground">Approval unlocks when every criterion is marked as met.</p>}

              <div className="space-y-1.5">
                <label htmlFor="comment" className="text-sm font-medium">
                  Comment {decision && decision !== "approved" ? <span className="text-danger">*</span> : <span className="font-normal text-muted-foreground">(optional)</span>}
                </label>
                <textarea id="comment" rows={4} value={comment} onChange={(e) => setComment(e.target.value)}
                  placeholder={decision === "rejected" ? "Explain why this application is denied. The applicant will see this." : decision === "changes_requested" ? "Tell the applicant what to change. They will see this." : "Add a note for the applicant (optional)."}
                  className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
                {decision && decision !== "approved" && unmet.length > 0 && (
                  <button type="button" onClick={fillFromCriteria} className="text-xs font-medium text-primary hover:underline">
                    Add the {unmet.length} unmet {unmet.length === 1 ? "criterion" : "criteria"} to the comment
                  </button>
                )}
                <p className="text-xs text-muted-foreground">Applicants can see this comment.</p>
              </div>

              <Button onClick={confirm} disabled={pending || !decision}
                variant={decision === "rejected" ? "destructive" : "default"}>
                {pending ? "Saving…" : decision === "approved" ? "Approve application" : decision === "rejected" ? "Deny application" : decision === "changes_requested" ? "Send back for changes" : "Choose a decision"}
              </Button>
            </>
          )}

          {error && (
            <p role="alert" className="flex items-start gap-1.5 text-sm text-danger"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}</p>
          )}
        </div>
      </section>
    </div>
  );
}

export function NoteForm({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <form className="space-y-2" onSubmit={(e) => {
      e.preventDefault();
      startTransition(async () => { const r = await addReviewNote(applicationId, note); if (!r.ok) setError(r.error); else { setNote(""); setError(null); router.refresh(); } });
    }}>
      <textarea aria-label="Internal note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Internal note, only staff can see this"
        className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" variant="outline" disabled={pending || !note.trim()}>Add note</Button>
        {error && <span role="alert" className="text-xs text-danger">{error}</span>}
      </div>
    </form>
  );
}
