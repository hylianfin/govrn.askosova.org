"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import type { GResult } from "@/lib/actions/government";

export const box = "h-10 rounded-md border border-border bg-card px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";
export const labelCls = "space-y-1 text-xs font-medium text-muted-foreground";

/** Runs a server action, shows its error, and refreshes the page data when it works. */
export function useAction() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  function run(fn: () => Promise<GResult>, after?: (r: Extract<GResult, { ok: true }>) => void) {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) { setError(r.error); return; }
      after?.(r);
      router.refresh();
    });
  }
  return { error, setError, pending, run };
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {message}
    </p>
  );
}
