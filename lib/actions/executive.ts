"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import crypto from "crypto";

async function currentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function createTeam(_prev: { error?: string } | undefined, formData: FormData): Promise<{ error?: string }> {
  const { supabase, user } = await currentUser();
  if (!user) return { error: "Not authenticated." };

  const name = String(formData.get("name") || "").trim();
  const slogan = String(formData.get("slogan") || "").trim();
  const introduction = String(formData.get("introduction") || "").trim();
  const myPosition = String(formData.get("myPosition") || "");
  if (!["president", "vice_president", "secretary", "treasurer"].includes(myPosition)) return { error: "Choose your position on the team." };

  if (!name || !introduction) return { error: "Team name and introduction are required." };

  // find current election
  const { data: election } = await supabase.from("elections").select("id").order("created_at", { ascending: false }).limit(1).maybeSingle();

  const { data: team, error: teamErr } = await supabase
    .from("executive_teams")
    .insert({ name, slogan: slogan || null, introduction, created_by: user.id, election_id: election?.id })
    .select()
    .single();
  if (teamErr || !team) return { error: teamErr?.message || "Failed to create team." };

  // form/version
  const { data: form } = await supabase.from("application_forms").select("id").eq("kind", "executive_team").limit(1).maybeSingle();
  const { data: version } = await supabase.from("application_form_versions").select("id").eq("form_id", form?.id).eq("status", "published").order("version_number", { ascending: false }).limit(1).maybeSingle();

  const { data: app, error: appErr } = await supabase
    .from("applications")
    .insert({
      form_id: form?.id,
      form_version_id: version?.id,
      applicant_id: user.id,
      executive_team_id: team.id,
      kind: "executive_team",
      status: "draft",
    })
    .select()
    .single();
  if (appErr || !app) return { error: appErr?.message || "Failed to create application." };

  await supabase.from("executive_teams").update({ application_id: app.id }).eq("id", team.id);

  const { error: memErr } = await supabase.from("executive_team_members").insert({
    team_id: team.id,
    user_id: user.id,
    position: myPosition,
    accepted: true,
    accepted_at: new Date().toISOString(),
  });
  if (memErr) return { error: memErr.message };

  revalidatePath("/dashboard/team");
  revalidatePath("/dashboard/applications/executive-team");
  redirect("/dashboard/team");
}

export async function inviteMember(formData: FormData) {
  const { supabase, user } = await currentUser();
  if (!user) return { error: "Not authenticated." };
  const teamId = String(formData.get("teamId") || "");
  const email = String(formData.get("email") || "").trim();
  const position = String(formData.get("position") || "");
  if (!email || !position) return { error: "Email and position required." };

  const token = crypto.randomUUID();
  const { error } = await supabase.from("team_invitations").insert({
    team_id: teamId,
    email,
    position,
    token,
    invited_by: user.id,
    expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/team");
  return { success: `Invitation created. Token: ${token}` };
}

export async function acceptInvitation(token: string) {
  const { supabase, user } = await currentUser();
  if (!user) return { error: "Not authenticated." };
  const { data: inv } = await supabase.from("team_invitations").select("*").eq("token", token).maybeSingle();
  if (!inv) return { error: "Invitation not found." };
  if (inv.accepted_by) return { error: "Already accepted." };

  const { error: memErr } = await supabase.from("executive_team_members").insert({
    team_id: inv.team_id,
    user_id: user.id,
    position: inv.position,
    accepted: true,
    accepted_at: new Date().toISOString(),
  });
  if (memErr) return { error: memErr.message };

  await supabase.from("team_invitations").update({ accepted_by: user.id, accepted_at: new Date().toISOString() }).eq("id", inv.id);
  revalidatePath("/dashboard/team");
  return { success: "Invitation accepted." };
}
