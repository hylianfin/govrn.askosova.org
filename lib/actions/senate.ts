"use server";

import { createClient } from "@/lib/supabase/server";

async function currentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function getOrCreateSenateApplication() {
  const { supabase, user } = await currentUser();
  if (!user) return null;
  const { data: existing } = await supabase
    .from("applications")
    .select("*")
    .eq("applicant_id", user.id)
    .eq("kind", "senate")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) return existing;

  const { data: form } = await supabase.from("application_forms").select("id").eq("kind", "senate").limit(1).maybeSingle();
  const { data: version } = await supabase.from("application_form_versions").select("id").eq("form_id", form?.id).eq("status", "published").order("version_number", { ascending: false }).limit(1).maybeSingle();
  const election = await supabase.from("elections").select("id").order("created_at", { ascending: false }).limit(1).maybeSingle();

  const { data: app } = await supabase.from("applications").insert({
    form_id: form?.id,
    form_version_id: version?.id,
    applicant_id: user.id,
    kind: "senate",
    status: "draft",
  }).select().single();
  return app;
}
