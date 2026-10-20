"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ALL_ROLES } from "@/lib/roles";
import type { Role } from "@/lib/types";

export type RoleResult = { ok: true } | { ok: false; error: string };

export async function setUserRole(targetId: string, role: Role, enabled: boolean): Promise<RoleResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You need to sign in again." };
  const { data: mine } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
  if (!mine) return { ok: false, error: "Only administrators can change roles." };
  if (!ALL_ROLES.includes(role)) return { ok: false, error: "Unknown role." };

  if (!enabled && role === "admin") {
    if (targetId === user.id) return { ok: false, error: "You can't remove your own admin role. Ask another administrator." };
    const { count } = await supabase.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "admin");
    if ((count ?? 0) <= 1) return { ok: false, error: "There must always be at least one administrator." };
  }

  const { error } = enabled
    ? await supabase.from("user_roles").upsert({ user_id: targetId, role }, { onConflict: "user_id,role" })
    : await supabase.from("user_roles").delete().eq("user_id", targetId).eq("role", role);
  if (error) return { ok: false, error: error.message };

  await supabase.from("audit_logs").insert({ actor_id: user.id, action: enabled ? "role.granted" : "role.revoked", entity_type: "user", entity_id: targetId, metadata: { role } });
  revalidatePath("/admin/roles");
  revalidatePath("/admin/users");
  revalidatePath("/admin");
  return { ok: true };
}
