"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type VerifyResult =
  | { status: "linked"; kind: "executive_team" | "senate" }
  | { status: "no_match"; left: number }
  | { status: "locked" | "ambiguous" | "invalid" | "unconfirmed" | "error"; message?: string };

/** Checks the student's grade and homeroom teacher against the imported form response that carries their name. */
export async function verifyMyApplication(grade: number, teacher: string): Promise<VerifyResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "Please sign in again." };
  const { data, error } = await supabase.rpc("verify_imported_response", { p_grade: Math.floor(Number(grade)), p_teacher: String(teacher ?? "").slice(0, 120) });
  if (error || !data) return { status: "error", message: "Something went wrong. Please try again." };
  ["/dashboard", "/dashboard/profile", "/dashboard/applications", "/dashboard/applications/senate", "/dashboard/team"].forEach((p) => revalidatePath(p));
  return data as VerifyResult;
}
