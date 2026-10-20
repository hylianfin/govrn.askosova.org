"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type Student = { id: string; full_name: string | null; grade_level: number; issued: boolean };
export type PollingResult = { ok: true; message: string } | { ok: false; error: string };

async function ctx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: election } = await supabase.from("elections").select("id").order("created_at", { ascending: false }).limit(1).maybeSingle();
  return election ? { supabase, user, electionId: election.id as string } : null;
}

export async function searchStudents(q: string): Promise<Student[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("search_students", { q: q.slice(0, 80), lim: 8 });
  return (data ?? []) as Student[];
}

export async function issueBallot(studentId: string): Promise<PollingResult> {
  const c = await ctx();
  if (!c) return { ok: false, error: "No election is configured." };
  const { error } = await c.supabase.from("ballot_checkins").insert({ election_id: c.electionId, student_id: studentId, issued_by: c.user.id });
  if (error) return { ok: false, error: error.code === "23505" ? "This student already received a ballot." : "Could not record the check-in." };
  ["/staff/polling-desk", "/admin/polling-desk", "/dashboard/polling-desk", "/staff/election-results", "/admin/election-results"].forEach((p) => revalidatePath(p));
  return { ok: true, message: "Ballot issued." };
}

export async function undoBallot(studentId: string): Promise<PollingResult> {
  const c = await ctx();
  if (!c) return { ok: false, error: "No election is configured." };
  const { error, count } = await c.supabase.from("ballot_checkins").delete({ count: "exact" }).eq("election_id", c.electionId).eq("student_id", studentId);
  if (error || !count) return { ok: false, error: "Only staff can undo a check-in." };
  ["/staff/polling-desk", "/admin/polling-desk", "/dashboard/polling-desk", "/staff/election-results", "/admin/election-results"].forEach((p) => revalidatePath(p));
  return { ok: true, message: "Check-in removed." };
}
