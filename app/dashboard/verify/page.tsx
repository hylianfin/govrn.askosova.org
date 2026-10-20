import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { VerifyForm } from "@/components/forms/verify-form";

export default async function VerifyPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const supabase = await createClient();
  const { data } = await supabase.rpc("pending_import_for_me");
  const kinds: string[] = (data ?? []).map((r: { kind: string }) => r.kind);
  if (kinds.length === 0) redirect("/dashboard");
  const kindLabel = kinds[0] === "senate" ? "Student Senate application" : "Executive Team application";
  return <VerifyForm kindLabel={kindLabel} name={user.profile?.full_name?.trim() || user.email} />;
}
