"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Refreshes the server-rendered meeting workspace whenever Supabase broadcasts a change. */
export function MeetingRealtime({ meetingId }: { meetingId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`government-meeting-${meetingId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "gov_meetings", filter: `id=eq.${meetingId}` }, () => router.refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "gov_agenda_items", filter: `meeting_id=eq.${meetingId}` }, () => router.refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "gov_attendance", filter: `meeting_id=eq.${meetingId}` }, () => router.refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "gov_motions", filter: `meeting_id=eq.${meetingId}` }, () => router.refresh())
      // Ballots point to a motion rather than directly to a meeting. Government members can
      // read ballot changes, and the refresh keeps this meeting's tally current.
      .on("postgres_changes", { event: "*", schema: "public", table: "gov_motion_ballots" }, () => router.refresh())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [meetingId, router]);

  return null;
}
