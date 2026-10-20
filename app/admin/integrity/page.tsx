import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, isAdmin } from "@/lib/auth/session";
import { IntegrityClient } from "@/components/counting/integrity-client";
import type { IntegritySetting } from "@/lib/live";

export const dynamic = "force-dynamic";

export default async function IntegrityPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data } = await supabase.rpc("integrity_settings");
  return <IntegrityClient initial={(data as IntegritySetting[] | null) ?? []} isAdmin={!!user && isAdmin(user.roles)} />;
}
