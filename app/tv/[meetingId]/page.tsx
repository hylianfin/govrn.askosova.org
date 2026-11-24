import { MeetingTv, type TvData } from "@/components/government/meeting-tv";
import { createClient } from "@/lib/supabase/server";
import { TvAutoRefresh } from "./tv-auto-refresh";

export const dynamic = "force-dynamic";

export default async function MeetingTvPage({ params }: { params: Promise<{ meetingId: string }> }) {
  const { meetingId } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("gov_tv", { p_meeting: meetingId });
  return <><TvAutoRefresh /><MeetingTv data={data as TvData} /></>;
}
