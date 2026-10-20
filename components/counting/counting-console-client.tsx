"use client";

import { useCallback, useMemo, useState } from "react";
import { CountingConsole, type ConsoleAlert } from "@/components/counting/counting-console";
import { createCountApi } from "@/components/counting/api";
import { createClient } from "@/lib/supabase/client";
import type { LiveState } from "@/lib/live";

export function CountingConsoleClient({ initial, isAdmin, base, alerts }: { initial: LiveState; isAdmin: boolean; base: "/staff" | "/admin"; alerts: ConsoleAlert[] }) {
  const api = useMemo(() => createCountApi(), []);
  const [open, setOpen] = useState(alerts);
  const dismiss = useCallback(async (id: string) => {
    setOpen((a) => a.filter((x) => x.id !== id));
    await createClient().from("notifications").update({ read: true }).eq("id", id);
  }, []);
  return <CountingConsole api={api} initial={initial} isAdmin={isAdmin} base={base} alerts={open} onDismissAlert={dismiss} />;
}
