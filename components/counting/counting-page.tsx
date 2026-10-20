import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, isAdmin } from "@/lib/auth/session";
import { CountingConsoleClient } from "@/components/counting/counting-console-client";
import { EMPTY_LIVE, type LiveState } from "@/lib/live";

export async function CountingPage({ base }: { base: "/staff" | "/admin" }) {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const [{ data }, { data: alerts }] = await Promise.all([
    supabase.rpc("live_results"),
    // Unread integrity alerts for this person (sent to every admin when the count does not add up).
    user
      ? supabase.from("notifications").select("id, title, body").eq("user_id", user.id).eq("read", false)
          .or("title.ilike.Election integrity%,title.ilike.Recount started%,title.ilike.Election ended with%").order("created_at", { ascending: false }).limit(5)
      : Promise.resolve({ data: [] }),
  ]);
  return (
    <CountingConsoleClient
      initial={(data as LiveState | null) ?? EMPTY_LIVE}
      isAdmin={!!user && isAdmin(user.roles)}
      base={base}
      alerts={(alerts ?? []) as { id: string; title: string; body: string | null }[]}
    />
  );
}
