"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isAnswered, normalizeAnswer, type AnswerMap, type AnswerValue } from "@/lib/forms";

export type SaveResult =
  | { ok: true; submitted: boolean }
  | { ok: false; error: string; missing?: string[] };

const EDITABLE = ["not_started", "draft", "awaiting_team_members", "ready_to_submit", "changes_requested"];
const POSITIONS = ["president", "vice_president", "secretary", "treasurer"];
const POSITION_LABEL: Record<string, string> = { president: "President", vice_president: "Vice President", secretary: "Secretary", treasurer: "Treasurer" };

export async function saveFormAnswers(applicationId: string, values: AnswerMap, submit: boolean): Promise<SaveResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You need to sign in again." };

  const { data: app } = await supabase.from("applications").select("id, kind, status, form_version_id, executive_team_id").eq("id", applicationId).maybeSingle();
  if (!app) return { ok: false, error: "Application not found." };
  if (!EDITABLE.includes(app.status)) return { ok: false, error: "This application has been submitted and can no longer be edited." };

  const { data: questions } = await supabase.from("application_questions").select("id, type, scope, required, options, label").eq("version_id", app.form_version_id);
  const qs: any[] = questions ?? [];

  const toUpsert: any[] = [];
  const teamInserts: any[] = [];
  const clearIndividual: string[] = [];
  const clearTeam: string[] = [];
  const mine: Record<string, AnswerValue | null> = {};
  const now = new Date().toISOString();

  for (const q of qs) {
    if (!(q.id in values)) continue;
    const v = normalizeAnswer(q, values[q.id]);
    mine[q.id] = v;
    if (q.scope === "team") {
      if (v) teamInserts.push({ application_id: app.id, question_id: q.id, respondent_id: null, value: v, updated_at: now });
      clearTeam.push(q.id);
    } else if (v) {
      toUpsert.push({ application_id: app.id, question_id: q.id, respondent_id: user.id, value: v, updated_at: now });
    } else {
      clearIndividual.push(q.id);
    }
  }

  if (toUpsert.length) {
    const { error } = await supabase.from("application_answers").upsert(toUpsert, { onConflict: "application_id,question_id,respondent_id" });
    if (error) return { ok: false, error: error.message };
  }
  if (clearIndividual.length) {
    const { error } = await supabase.from("application_answers").delete().eq("application_id", app.id).eq("respondent_id", user.id).in("question_id", clearIndividual);
    if (error) return { ok: false, error: error.message };
  }
  if (clearTeam.length) {
    const { error } = await supabase.from("application_answers").delete().eq("application_id", app.id).is("respondent_id", null).in("question_id", clearTeam);
    if (error) return { ok: false, error: error.message };
    if (teamInserts.length) {
      const { error: e2 } = await supabase.from("application_answers").insert(teamInserts);
      if (e2) return { ok: false, error: e2.message };
    }
  }

  const paths = ["/dashboard", "/dashboard/team", "/dashboard/applications/senate"];

  if (!submit) {
    paths.forEach((p) => revalidatePath(p));
    return { ok: true, submitted: false };
  }

  // Submission checks run against what is actually stored, not what the client claims.
  const { data: stored } = await supabase.from("application_answers").select("question_id, respondent_id, value").eq("application_id", app.id);
  const answers: any[] = stored ?? [];
  const has = (q: any, respondent: string | null) =>
    isAnswered(q, answers.find((a) => a.question_id === q.id && (a.respondent_id ?? null) === respondent)?.value);

  const missing = qs.filter((q) => q.required && (q.scope === "team" ? !has(q, null) : !has(q, user.id))).map((q) => q.id);
  if (missing.length) return { ok: false, error: "Please answer the required questions before submitting.", missing };

  if (app.kind === "executive_team") {
    const { data: members } = await supabase.from("executive_team_members").select("user_id, position, accepted, profiles(full_name,email)").eq("team_id", app.executive_team_id);
    const ms: any[] = members ?? [];
    const absent = POSITIONS.filter((p) => !ms.some((m) => m.position === p));
    if (absent.length) return { ok: false, error: `Your team still needs: ${absent.map((p) => POSITION_LABEL[p]).join(", ")}. Invite them from the Members section.` };
    const pending = ms.filter((m) => !m.accepted);
    if (pending.length) return { ok: false, error: `Waiting for ${pending.map((m) => POSITION_LABEL[m.position]).join(", ")} to accept their invitation.` };
    const incomplete = ms.filter((m) => m.user_id !== user.id && qs.some((q) => q.required && q.scope === "individual" && !has(q, m.user_id)));
    if (incomplete.length) {
      const names = incomplete.map((m) => `${POSITION_LABEL[m.position]} (${m.profiles?.full_name || m.profiles?.email || "member"})`);
      return { ok: false, error: `Each member must finish their own questions first. Still waiting on: ${names.join(", ")}.` };
    }
  }

  const { error } = await supabase.from("applications").update({ status: "submitted", submitted_at: now, submitted_by: user.id }).eq("id", app.id);
  if (error) return { ok: false, error: error.message };
  paths.forEach((p) => revalidatePath(p));
  return { ok: true, submitted: true };
}
