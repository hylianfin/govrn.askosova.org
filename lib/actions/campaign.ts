"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function saveCampaignMaterial(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const teamId = String(formData.get("teamId") || "");
  const payload = {
    team_id: teamId,
    slogan: String(formData.get("slogan") || "") || null,
    platform: String(formData.get("platform") || "") || null,
    goals: String(formData.get("goals") || "") || null,
    poster_url: String(formData.get("posterUrl") || "") || null,
    video_url: String(formData.get("videoUrl") || "") || null,
    speech_notes: String(formData.get("speechNotes") || "") || null,
    debate_notes: String(formData.get("debateNotes") || "") || null,
    updated_at: new Date().toISOString(),
  };

  const { data: existing } = await supabase.from("campaign_materials").select("id").eq("team_id", teamId).maybeSingle();
  if (existing) {
    const { error } = await supabase.from("campaign_materials").update(payload).eq("id", existing.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("campaign_materials").insert({ ...payload, status: "draft" });
    if (error) return { error: error.message };
  }
  revalidatePath("/dashboard/campaign");
  return { success: "Saved." };
}

export async function submitCampaignMaterial(teamId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("campaign_materials").update({ status: "submitted", updated_at: new Date().toISOString() }).eq("team_id", teamId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/campaign");
  return { success: "Submitted for approval." };
}