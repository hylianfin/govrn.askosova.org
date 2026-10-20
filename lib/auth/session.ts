import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Role, Profile } from "@/lib/types";

// Cached per request so layouts and pages share one lookup (and one claim) instead of repeating it.
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  // getClaims verifies the signed session token locally, so it needs no round trip to the auth server.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  const id = claims.sub as string;

  // One round trip for everything. The claim turns responses imported earlier (e.g. from Google Forms)
  // into this person's application once their email is confirmed; the database checks that itself, and a
  // failure there must never block the page.
  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", id),
    supabase.rpc("claim_my_imported_responses").then(() => null, () => null),
  ]);

  return {
    id,
    email: (claims.email as string | undefined) ?? "",
    profile: (profile as Profile | null) ?? null,
    roles: (roles ?? []).map((r: { role: Role }) => r.role as Role),
  };
});

export function hasRole(roles: Role[], ...allowed: Role[]) {
  return allowed.some((r) => roles.includes(r));
}

export function isAdmin(roles: Role[]) { return roles.includes("admin"); }
// There is one running role: administrators do everything that used to be split between staff and admins.
export function isStaff(roles: Role[]) { return roles.includes("admin"); }