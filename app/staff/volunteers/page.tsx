import { HandHelping, CalendarDays, UserCheck, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, StatTile } from "@/components/dashboard/primitives";
import { VolunteerBoard, type AssignmentRow, type Person, type TaskRow } from "@/components/volunteers/volunteer-board";
import { isoToWall, validTimezone } from "@/lib/datetime";
import { ACTIVE, fmtHours } from "@/lib/volunteers";

export default async function StaffVolunteersPage() {
  const supabase = await createClient();
  const { data: election } = await supabase.from("elections").select("timezone").order("created_at", { ascending: false }).limit(1).maybeSingle();
  const tz = validTimezone(election?.timezone) ? election!.timezone : "UTC";

  const [{ data: tasks }, { data: assigns }, { data: volRoles }] = await Promise.all([
    supabase.from("volunteer_tasks").select("*").order("starts_at", { ascending: true, nullsFirst: false }),
    supabase.from("volunteer_assignments").select("*").order("created_at"),
    supabase.from("user_roles").select("user_id").eq("role", "volunteer"),
  ]);

  const volunteerIds: string[] = (volRoles ?? []).map((r: any) => r.user_id);
  const ids = Array.from(new Set([...volunteerIds, ...(assigns ?? []).map((a: any) => a.volunteer_id)]));
  const { data: profs } = ids.length ? await supabase.from("profiles").select("id, full_name, email, grade_level").in("id", ids) : { data: [] };
  const people: Person[] = (profs ?? []).map((p: any) => ({ id: p.id, name: p.full_name || p.email, email: p.email, grade: p.grade_level }));

  const taskRows: TaskRow[] = (tasks ?? []).map((t: any) => {
    const s = isoToWall(t.starts_at, tz);
    const e = isoToWall(t.ends_at, tz);
    return {
      id: t.id, title: t.title, description: t.description ?? "", instructions: t.instructions ?? "", location: t.location ?? "",
      date: s.date, startTime: s.time || "08:00", endTime: e.time || "15:00", slots: t.slots ?? 1, starts_at: t.starts_at, ends_at: t.ends_at,
    };
  });
  const rows: AssignmentRow[] = (assigns ?? []).map((a: any) => ({
    id: a.id, task_id: a.task_id, volunteer_id: a.volunteer_id, status: a.status, checked_in_at: a.checked_in_at, checked_out_at: a.checked_out_at, hours: a.hours == null ? null : Number(a.hours),
  }));

  const openSlots = taskRows.reduce((n, t) => n + Math.max(0, t.slots - rows.filter((a) => a.task_id === t.id && ACTIVE.includes(a.status)).length), 0);
  const hours = rows.reduce((s, a) => s + (a.hours ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Operations" title="Volunteers" description="Create shifts, assign volunteers, and confirm the hours they worked. Volunteers are notified when you assign them." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Shifts" value={taskRows.length} icon={<CalendarDays className="h-5 w-5" />} />
        <StatTile label="Open slots" value={openSlots} tone={openSlots ? "warning" : "success"} hint="Still to be filled" icon={<HandHelping className="h-5 w-5" />} />
        <StatTile label="Volunteers" value={volunteerIds.length} icon={<UserCheck className="h-5 w-5" />} />
        <StatTile label="Hours confirmed" value={fmtHours(hours)} icon={<Clock className="h-5 w-5" />} />
      </div>
      <VolunteerBoard tasks={taskRows} assignments={rows} people={people} volunteerIds={volunteerIds} timezone={tz} />
    </div>
  );
}
