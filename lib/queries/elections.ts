import { createClient } from "@/lib/supabase/server";

export async function getCurrentElection() {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("elections")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data;
  } catch {
    return null;
  }
}

export async function getElectionEvents(electionId?: string) {
  try {
    const supabase = await createClient();
    let q = supabase.from("election_events").select("*").order("order_index", { ascending: true });
    if (electionId) q = q.eq("election_id", electionId);
    const { data } = await q;
    return data ?? [];
  } catch {
    return [];
  }
}

export async function getAnnouncements(publishedOnly = true) {
  try {
    const supabase = await createClient();
    let q = supabase.from("announcements").select("*").order("created_at", { ascending: false });
    if (publishedOnly) q = q.eq("published", true);
    const { data } = await q;
    return data ?? [];
  } catch {
    return [];
  }
}