import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/dashboard/primitives";
import { TimelineEditor, type TimelineRow } from "@/components/forms/timeline-editor";
import { isoToWall, validTimezone } from "@/lib/datetime";

export default async function AdminTimelinePage() {
  const supabase = await createClient();
  const { data: election } = await supabase.from("elections").select("id, timezone").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!election) return <p className="text-muted-foreground">Create an election first under Elections.</p>;

  const tz = validTimezone(election.timezone) ? election.timezone : "UTC";
  const { data: events } = await supabase.from("election_events").select("*").eq("election_id", election.id).order("order_index");

  const rows: TimelineRow[] = (events ?? []).map((e: any) => {
    const s = isoToWall(e.start_at, tz);
    const n = isoToWall(e.end_at, tz);
    return {
      id: e.id, title: e.title ?? "", description: e.description ?? "", location: e.location ?? "",
      startDate: s.date, startTime: s.time, endDate: n.date, endTime: n.time, public: !!e.public,
    };
  });

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <PageHeader eyebrow="Election setup" title="Election timeline" description="Pick a date and time for each milestone. Everything saves as you type and updates the public timeline." />
      <TimelineEditor key={tz} initial={rows} timezone={tz} />
    </div>
  );
}
