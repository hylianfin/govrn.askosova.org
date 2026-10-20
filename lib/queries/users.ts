import { createClient } from "@/lib/supabase/server";
import type { UserRow } from "@/components/admin/user-list";
import type { Role } from "@/lib/types";

export async function getUserRows(): Promise<UserRow[]> {
  const supabase = await createClient();
  const [{ data: profiles }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, grade_level, homeroom, created_at").order("full_name"),
    supabase.from("user_roles").select("user_id, role"),
  ]);
  const byUser = new Map<string, Role[]>();
  (roles ?? []).forEach((r: { user_id: string; role: Role }) => byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r.role]));
  return (profiles ?? []).map((p: any) => ({
    id: p.id, name: p.full_name || p.email, email: p.email, grade: p.grade_level, homeroom: p.homeroom, joined: p.created_at, roles: byUser.get(p.id) ?? [],
  }));
}
