"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CirclePause, CirclePlay, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { setElectionEnabled } from "@/lib/actions/election-controls";

export function ElectionControls({ enabled, disabledReason }: { enabled: boolean; disabledReason: string | null }) {
  const router = useRouter();
  const [reason, setReason] = useState(disabledReason ?? "");
  const [pending, startTransition] = useTransition();

  const setEnabled = (next: boolean) => startTransition(async () => {
    const result = await setElectionEnabled(next, reason);
    if (result.ok) { toast.success(result.message); router.refresh(); }
    else toast.error(result.error);
  });

  return (
    <section className="rounded-xl border border-border bg-card shadow-sm" aria-labelledby="election-controls-title">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 id="election-controls-title" className="text-base font-semibold">Election controls</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Pause or reopen election-day ballot check-ins. Existing records and results are never changed.</p>
        </div>
        <Badge variant={enabled ? "success" : "secondary"} className="gap-1.5">
          {enabled ? <CirclePlay className="h-3.5 w-3.5" /> : <CirclePause className="h-3.5 w-3.5" />}
          {enabled ? "Election enabled" : "Election disabled"}
        </Badge>
      </header>
      <div className="space-y-4 p-5">
        {enabled ? (
          <>
            <p className="text-sm text-muted-foreground">Polling-desk staff can issue ballots. Disable this only when check-in needs to stop for an operational or safety reason.</p>
            <label className="block space-y-1.5" htmlFor="disable-reason">
              <span className="text-sm font-medium">Reason for disabling</span>
              <input id="disable-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="For example: polling has closed" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </label>
            <Button variant="destructive" disabled={pending || reason.trim().length < 3} onClick={() => setEnabled(false)}>
              <CirclePause className="h-4 w-4" /> {pending ? "Updating…" : "Disable check-in"}
            </Button>
          </>
        ) : (
          <>
            <div className="flex gap-3 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <div><p className="font-medium">Check-in is paused</p><p className="mt-0.5">{disabledReason ? `Reason: ${disabledReason}` : "No reason was recorded."}</p></div>
            </div>
            <Button disabled={pending} onClick={() => setEnabled(true)}><CirclePlay className="h-4 w-4" /> {pending ? "Updating…" : "Re-enable check-in"}</Button>
          </>
        )}
      </div>
    </section>
  );
}
