"use client";

import { useState } from "react";
import { CheckCircle2, FileText, LockOpen, Save, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/dashboard/primitives";
import { approveMinutes, reopenMinutes, saveMinutes } from "@/lib/actions/government";
import { MINUTES_STATUS, type MinutesStatus } from "@/lib/government";
import { ErrorNote, useAction } from "./ui";

export function MinutesPanel({
  meetingId, saved, status, approvedLabel, draft, canRun, admin,
}: {
  meetingId: string; saved: string; status: MinutesStatus; approvedLabel: string | null; draft: string; canRun: boolean; admin: boolean;
}) {
  const [text, setText] = useState(saved);
  const { run, pending, error } = useAction();
  const dirty = text.trim() !== saved.trim();
  const state = MINUTES_STATUS[status];

  if (status === "approved" || !canRun) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={state.variant}>{state.label}</Badge>
          {approvedLabel && <span className="text-xs text-muted-foreground">Approved {approvedLabel}</span>}
          {admin && status === "approved" && (
            <Button size="sm" variant="outline" className="ml-auto" disabled={pending} onClick={() => run(() => reopenMinutes(meetingId))}>
              <LockOpen className="h-4 w-4" /> Reopen for edits
            </Button>
          )}
        </div>
        <ErrorNote message={error} />
        {saved.trim()
          ? <div className="whitespace-pre-wrap rounded-xl border border-border bg-card p-5 text-sm leading-relaxed">{saved}</div>
          : <EmptyState>The secretary has not written the minutes for this meeting yet.</EmptyState>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={state.variant}>{state.label}</Badge>
        {dirty && <span className="text-xs font-medium text-warning">Unsaved changes</span>}
        <Button size="sm" variant="outline" className="ml-auto" onClick={() => setText((t) => (t.trim() ? `${t.trimEnd()}\n\n${draft}` : draft))}>
          <Wand2 className="h-4 w-4" /> Fill from meeting record
        </Button>
      </div>
      <label className="block text-xs font-medium text-muted-foreground" htmlFor="minutes-text">Minutes</label>
      <textarea id="minutes-text" rows={20} value={text} onChange={(e) => setText(e.target.value)}
        placeholder="Record who attended, what was discussed, each motion and its result, and who owes what by when."
        className="w-full rounded-xl border border-border bg-card p-4 font-mono text-sm leading-relaxed outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
      <ErrorNote message={error} />
      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={pending || !dirty} onClick={() => run(() => saveMinutes(meetingId, text))}><Save className="h-4 w-4" /> Save draft</Button>
        <Button variant="outline" disabled={pending || dirty || status !== "draft"} onClick={() => run(() => approveMinutes(meetingId))}>
          <CheckCircle2 className="h-4 w-4" /> Approve minutes
        </Button>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <FileText className="h-3.5 w-3.5" /> Approving locks the minutes and tells every member.
        </p>
      </div>
    </div>
  );
}
