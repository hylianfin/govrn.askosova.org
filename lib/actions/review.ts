"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ReviewResult = { ok: true; message: string } | { ok: false; error: string };
export type CheckStatus = "pending" | "verified" | "failed" | "requires_review";
export type Decision = "approved" | "rejected" | "changes_requested";

const CHECK_STATUSES: CheckStatus[] = ["pending", "verified", "failed", "requires_review"];
const DECISIONS: Decision[] = ["approved", "rejected", "changes_requested"];

async function staffCtx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id).in("role", ["staff_reviewer", "admin"]);
  return roles?.length ? { supabase, user } : null;
}

const scopeOf = (kind: string) => (kind === "executive_team" ? "executive" : "senate");
const refresh = (id: string) => ["/staff", "/admin", "/staff/applications", `/staff/applications/${id}`, "/dashboard", "/dashboard/team", "/dashboard/applications/senate"].forEach((p) => revalidatePath(p));

export async function setCriterion(applicationId: string, ruleId: string, status: CheckStatus, notes: string): Promise<ReviewResult> {
  const ctx = await staffCtx();
  if (!ctx) return { ok: false, error: "Only staff can review applications." };
  if (!CHECK_STATUSES.includes(status)) return { ok: false, error: "Unknown status." };
  const { supabase, user } = ctx;

  const { data: app } = await supabase.from("applications").select("id, executive_team_id").eq("id", applicationId).maybeSingle();
  if (!app) return { ok: false, error: "Application not found." };

  const row = { status, notes: notes.trim().slice(0, 1000) || null, verified_by: user.id, verified_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  const { data: existing } = await supabase.from("eligibility_checks").select("id").eq("application_id", applicationId).eq("rule_id", ruleId).is("user_id", null).maybeSingle();
  const { error } = existing
    ? await supabase.from("eligibility_checks").update(row).eq("id", existing.id)
    : await supabase.from("eligibility_checks").insert({ ...row, application_id: applicationId, team_id: app.executive_team_id, rule_id: ruleId, user_id: null });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/staff/applications/${applicationId}`);
  revalidatePath("/staff/eligibility");
  return { ok: true, message: "Saved" };
}

export async function submitReview(applicationId: string, decision: Decision, comment: string): Promise<ReviewResult> {
  const ctx = await staffCtx();
  if (!ctx) return { ok: false, error: "Only staff can review applications." };
  if (!DECISIONS.includes(decision)) return { ok: false, error: "Unknown decision." };
  const { supabase, user } = ctx;
  const reason = comment.trim().slice(0, 4000);

  const { data: app } = await supabase.from("applications").select("id, kind, status, applicant_id, executive_team_id").eq("id", applicationId).maybeSingle();
  if (!app) return { ok: false, error: "Application not found." };
  if (["draft", "not_started", "awaiting_team_members", "withdrawn"].includes(app.status)) return { ok: false, error: "This application has not been submitted yet." };

  if (decision !== "approved" && reason.length < 3) {
    return { ok: false, error: decision === "rejected" ? "Add a comment explaining why the application is denied." : "Add a comment telling them what to change." };
  }

  if (decision === "approved") {
    const { data: rules } = await supabase.from("eligibility_rules").select("id, label").eq("scope", scopeOf(app.kind)).eq("is_active", true);
    const { data: checks } = await supabase.from("eligibility_checks").select("rule_id, status").eq("application_id", applicationId).is("user_id", null);
    const status = new Map((checks ?? []).map((c: any) => [c.rule_id, c.status]));
    const unmet = (rules ?? []).filter((r: any) => status.get(r.id) !== "verified");
    if (unmet.length) return { ok: false, error: `Mark every criterion as met before approving. Still open: ${unmet.map((r: any) => r.label).join(", ")}.` };
  }

  const { error } = await supabase.from("applications").update({ status: decision }).eq("id", applicationId);
  if (error) return { ok: false, error: error.message };
  const { error: logErr } = await supabase.from("application_reviews").insert({
    application_id: applicationId, reviewer_id: user.id, decision, reason: reason || null, decided_at: new Date().toISOString(),
  });
  if (logErr) return { ok: false, error: `Status changed but the decision was not logged: ${logErr.message}` };
  await supabase.from("audit_logs").insert({ actor_id: user.id, action: `application.${decision}`, entity_type: "application", entity_id: applicationId, metadata: { kind: app.kind } });

  // Tell the applicant (and every team member) so they don't have to keep checking the page.
  const recipients = new Set<string>(app.applicant_id ? [app.applicant_id] : []);
  if (app.executive_team_id) {
    const { data: team } = await supabase.from("executive_team_members").select("user_id").eq("team_id", app.executive_team_id);
    (team ?? []).forEach((m: { user_id: string }) => recipients.add(m.user_id));
  }
  const headline = decision === "approved" ? "was approved" : decision === "rejected" ? "was denied" : "needs changes";
  if (recipients.size) {
    await supabase.from("notifications").insert(Array.from(recipients).map((uid) => ({
      user_id: uid,
      title: `Your ${app.kind === "executive_team" ? "Executive Team" : "Student Senate"} application ${headline}`,
      body: reason ? reason.slice(0, 280) : null,
      link: app.kind === "executive_team" ? "/dashboard/team" : "/dashboard/applications/senate",
    })));
  }
  refresh(applicationId);
  return { ok: true, message: decision === "approved" ? "Application approved." : decision === "rejected" ? "Application denied." : "Changes requested." };
}

export async function reopenReview(applicationId: string): Promise<ReviewResult> {
  const ctx = await staffCtx();
  if (!ctx) return { ok: false, error: "Only staff can review applications." };
  const { error } = await ctx.supabase.from("applications").update({ status: "under_review" }).eq("id", applicationId);
  if (error) return { ok: false, error: error.message };
  await ctx.supabase.from("audit_logs").insert({ actor_id: ctx.user.id, action: "application.reopened", entity_type: "application", entity_id: applicationId });
  refresh(applicationId);
  return { ok: true, message: "Moved back to review." };
}

export async function addReviewNote(applicationId: string, note: string): Promise<ReviewResult> {
  const ctx = await staffCtx();
  if (!ctx) return { ok: false, error: "Only staff can review applications." };
  const text = note.trim().slice(0, 4000);
  if (!text) return { ok: false, error: "Write a note first." };
  const { error } = await ctx.supabase.from("review_notes").insert({ application_id: applicationId, author_id: ctx.user.id, note: text, internal: true });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/staff/applications/${applicationId}`);
  return { ok: true, message: "Note added." };
}
