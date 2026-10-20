import { CalendarDays, Clock, CheckCircle2 } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, StatTile } from "@/components/dashboard/primitives";
import { MyShifts, type MyAssignment, type ShiftTask } from "@/components/volunteers/my-shifts";
import { validTimezone } from "@/lib/datetime";
import { ACTIVE, fmtHours, overlaps } from "@/lib/volunteers";

export default async function VolunteerPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const isVolunteer = !!user?.roles.includes("volunteer");

  const { data: election } = await supabase.from("elections").select("timezone").order("created_at", { ascending: false }).limit(1).maybeSingle();
  const tz = validTimezone(election?.timezone) ? election!.timezone : "UTC";

  const [{ data: mine }, { data: tasks }, { data: counts }] = await Promise.all([
    supabase.from("volunteer_assignments").select("*, volunteer_tasks(*)").eq("volunteer_id", user?.id ?? "").order("created_at"),
    supabase.from("volunteer_tasks").select("*").order("starts_at", { ascending: true, nullsFirst: false }),
    supabase.rpc("volunteer_task_fill"),
  ]);

  // Visibility rules only show a volunteer their own assignments, so fill counts come from a database function.
  const taken = new Map<string, number>((counts ?? []).map((c: any) => [c.task_id, Number(c.taken)]));
  const toTask = (t: any): ShiftTask => ({
    id: t.id, title: t.title, description: t.description, instructions: t.instructions, location: t.location,
    starts_at: t.starts_at, ends_at: t.ends_at, slots: t.slots ?? 1, free: Math.max(0, (t.slots ?? 1) - (taken.get(t.id) ?? 0)),
  });

  const assignments: MyAssignment[] = (mine ?? []).filter((a: any) => a.volunteer_tasks).map((a: any) => ({
    id: a.id, status: a.status, checked_in_at: a.checked_in_at, checked_out_at: a.checked_out_at, hours: a.hours == null ? null : Number(a.hours), task: toTask(a.volunteer_tasks),
  }));

  const now = new Date().toISOString();
  const isPast = (a: MyAssignment) => ["completed", "declined", "no_show"].includes(a.status) || (!!a.task.ends_at && a.task.ends_at < now && a.status !== "in_progress");
  const upcoming = assignments.filter((a) => !isPast(a)).sort((a, b) => (a.task.starts_at ?? "9").localeCompare(b.task.starts_at ?? "9"));
  const past = assignments.filter(isPast).sort((a, b) => (b.task.starts_at ?? "").localeCompare(a.task.starts_at ?? ""));

  const busy = assignments.filter((a) => ACTIVE.includes(a.status));
  const myTaskIds = new Set(assignments.filter((a) => !["declined", "no_show"].includes(a.status)).map((a) => a.task.id));
  const open = (tasks ?? []).map(toTask).filter((t: ShiftTask) => t.free > 0 && !myTaskIds.has(t.id) && (!t.ends_at || t.ends_at > now) && !busy.some((a) => overlaps(a.task, t)));

  const hours = assignments.reduce((s, a) => s + (a.hours ?? 0), 0);
  const done = assignments.filter((a) => a.status === "completed").length;

  return (
    <div className="space-y-6">
      <PageHeader title="Volunteer tasks" description="Your shifts, check-in and the hours you've worked." />
      {!isVolunteer && (
        <div className="rounded-lg border border-border bg-muted px-4 py-3 text-sm">You are not registered as a volunteer yet. Ask a staff member or administrator to add the Volunteer role to your account, then you can sign up for shifts here.</div>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Upcoming shifts" value={upcoming.length} icon={<CalendarDays className="h-5 w-5" />} />
        <StatTile label="Completed" value={done} icon={<CheckCircle2 className="h-5 w-5" />} tone="success" />
        <StatTile label="Hours confirmed" value={fmtHours(hours)} icon={<Clock className="h-5 w-5" />} />
      </div>
      <MyShifts upcoming={upcoming} past={past} open={open} timezone={tz} canSignUp={isVolunteer} />
    </div>
  );
}
