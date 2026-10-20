import { createClient } from "@/lib/supabase/server";
import type { Role, Profile } from "@/lib/types";

export async function getCurrentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  return {
    id: user.id,
    email: user.email ?? "",
    profile: (profile as Profile | null) ?? null,
    roles: (roles ?? []).map((r: { role: Role }) => r.role as Role),
  };
}

export function hasRole(roles: Role[], ...allowed: Role[]) {
  return allowed.some((r) => roles.includes(r));
}

export function isAdmin(roles: Role[]) { return roles.includes("admin"); }
export function isStaff(roles: Role[]) { return roles.includes("staff_reviewer") || roles.includes("admin"); }