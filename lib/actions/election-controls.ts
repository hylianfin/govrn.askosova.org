"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ElectionControlResult = { ok: true; message: string } | { ok: false; error: string };

export async function setElectionEnabled(enabled: boolean, reason = ""): Promise<ElectionControlResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_election_enabled", { p_enabled: enabled, p_reason: reason });
  if (error) return { ok: false, error: error.message };

  ["/admin", "/admin/settings", "/admin/attendance", "/admin/polling-desk", "/staff/polling-desk", "/dashboard/polling-desk"].forEach((path) => revalidatePath(path));
  return { ok: true, message: enabled ? "Election features are enabled." : "Election features are disabled." };
}
