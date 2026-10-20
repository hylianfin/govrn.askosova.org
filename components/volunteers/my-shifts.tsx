"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CalendarDays, Check, LogIn, LogOut, MapPin, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatWhen } from "@/lib/datetime";
import { ASSIGNMENT_LABEL, ASSIGNMENT_VARIANT, estimateHours, fmtHours, type AssignmentStatus } from "@/lib/volunteers";
import { signUpForShift, updateMyAssignment, type VResult } from "@/lib/actions/volunteers";

export type ShiftTask = { id: string; title: string; description: string | null; instructions: string | null; location: string | null; starts_at: string | null; ends_at: string | null; slots: number; free: number };
export type MyAssignment = { id: string; status: AssignmentStatus; checked_in_at: string | null; checked_out_at: string | null; hours: number | null; task: ShiftTask };

export function MyShifts({ upcoming, past, open, timezone, canSignUp }: { upcoming: MyAssignment[]; past: MyAssignment[]; open: ShiftTask[]; timezone: string; canSignUp: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<VResult>) {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error); else router.refresh();
    });
  }

  const When = ({ t }: { t: ShiftTask }) => (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
      <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4" />{formatWhen(t.starts_at, t.ends_at, timezone)}</span>
      {t.location && <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" />{t.location}</span>}
    </p>
  );

  return (
    <div className="space-y-8">
      {error && (
        <div role="alert" className="flex items-start justify-between gap-2 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          <span className="flex items-start gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</span>
          <button aria-label="Dismiss" onClick={() => setError(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">My shifts</h2>
        {upcoming.length === 0 && <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">You have no upcoming shifts. Pick one from the open shifts below, or wait for staff to assign you.</p>}
        {upcoming.map((a) => (
          <article key={a.id} className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="space-y-1">
                <h3 className="font-semibold">{a.task.title}</h3>
                <When t={a.task} />
              </div>
              <Badge variant={ASSIGNMENT_VARIANT[a.status]}>{ASSIGNMENT_LABEL[a.status]}</Badge>
            </div>
            {a.task.description && <p className="text-sm">{a.task.description}</p>}
            {a.task.instructions && <p className="whitespace-pre-line rounded-lg bg-muted px-3 py-2 text-sm"><span className="font-medium">Instructions: </span>{a.task.instructions}</p>}
            <div className="flex flex-wrap gap-2">
              {a.status === "assigned" && (<>
                <Button size="sm" disabled={pending} onClick={() => run(() => updateMyAssignment(a.id, "accept"))}><Check className="h-4 w-4" /> Accept</Button>
                <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => updateMyAssignment(a.id, "decline"))}>Decline</Button>
              </>)}
              {a.status === "accepted" && (<>
                <Button size="sm" disabled={pending} onClick={() => run(() => updateMyAssignment(a.id, "check_in"))}><LogIn className="h-4 w-4" /> Check in</Button>
                <Button size="sm" variant="outline" disabled={pending} onClick={() => { if (confirm("Can't make it? Staff will be able to fill your spot.")) run(() => updateMyAssignment(a.id, "decline")); }}>I can&apos;t make it</Button>
              </>)}
              {a.status === "in_progress" && (
                <Button size="sm" disabled={pending} onClick={() => run(() => updateMyAssignment(a.id, "check_out"))}><LogOut className="h-4 w-4" /> Check out</Button>
              )}
            </div>
          </article>
        ))}
      </section>

      {canSignUp && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Open shifts</h2>
          {open.length === 0 && <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">No open shifts right now.</p>}
          <ul className="grid gap-3 md:grid-cols-2">
            {open.map((t) => (
              <li key={t.id} className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="space-y-1">
                  <div className="flex items-start justify-between gap-2"><h3 className="font-semibold">{t.title}</h3><Badge variant="warning">{t.free} left</Badge></div>
                  <When t={t} />
                  {t.description && <p className="pt-1 text-sm">{t.description}</p>}
                </div>
                <Button size="sm" className="self-start" disabled={pending} onClick={() => run(() => signUpForShift(t.id))}>Sign up</Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {past.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">History</h2>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            {past.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                <div className="min-w-0"><p className="truncate text-sm font-medium">{a.task.title}</p><p className="text-xs text-muted-foreground">{formatWhen(a.task.starts_at, a.task.ends_at, timezone)}</p></div>
                <div className="flex items-center gap-2">
                  {a.status === "completed" && (a.hours != null
                    ? <span className="text-sm font-medium">{fmtHours(a.hours)}</span>
                    : <span className="text-xs text-muted-foreground">~{fmtHours(estimateHours(a, a.task))}, awaiting confirmation</span>)}
                  <Badge variant={ASSIGNMENT_VARIANT[a.status]}>{ASSIGNMENT_LABEL[a.status]}</Badge>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
