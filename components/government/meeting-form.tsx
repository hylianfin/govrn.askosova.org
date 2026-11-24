"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { saveMeeting, type MeetingPatch } from "@/lib/actions/government";
import { BODY_ABOUT, BODY_LABEL, type MeetingBody } from "@/lib/government";
import { ErrorNote, box, labelCls, useAction } from "./ui";

const BODIES: MeetingBody[] = ["senate", "executive", "joint"];
const EMPTY: MeetingPatch = { title: "", body: "senate", date: "", startTime: "15:00", endTime: "16:00", location: "" };

export function MeetingForm({
  meetingId, initial, onDone,
}: { meetingId?: string; initial?: MeetingPatch; onDone?: () => void }) {
  const router = useRouter();
  const [p, setP] = useState<MeetingPatch>(initial ?? EMPTY);
  const { run, pending, error } = useAction();
  const set = <K extends keyof MeetingPatch>(k: K, v: MeetingPatch[K]) => setP((x) => ({ ...x, [k]: v }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    run(() => saveMeeting(meetingId ?? null, p), (r) => {
      onDone?.();
      if (!meetingId && r.id) router.push(`/government/meetings/${r.id}`);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={cn(labelCls, "sm:col-span-2")}>Title
          <input id="meeting-title" required value={p.title} onChange={(e) => set("title", e.target.value)} placeholder="Senate meeting, 12 November" className={cn(box, "w-full")} />
        </label>
        <label className={labelCls}>Who attends
          <select id="meeting-body" value={p.body} onChange={(e) => set("body", e.target.value as MeetingBody)} className={cn(box, "w-full")}>
            {BODIES.map((b) => <option key={b} value={b}>{BODY_LABEL[b]}</option>)}
          </select>
          <span className="block text-[11px] font-normal">{BODY_ABOUT[p.body]}</span>
        </label>
        <label className={labelCls}>Location
          <input id="meeting-location" value={p.location} onChange={(e) => set("location", e.target.value)} placeholder="Room 204" className={cn(box, "w-full")} />
        </label>
        <label className={labelCls}>Date
          <input id="meeting-date" type="date" required value={p.date} onChange={(e) => set("date", e.target.value)} className={cn(box, "w-full")} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className={labelCls}>Starts
            <input id="meeting-start" type="time" required value={p.startTime} onChange={(e) => set("startTime", e.target.value)} className={cn(box, "w-full")} />
          </label>
          <label className={labelCls}>Ends
            <input id="meeting-end" type="time" value={p.endTime} onChange={(e) => set("endTime", e.target.value)} className={cn(box, "w-full")} />
          </label>
        </div>
      </div>
      <ErrorNote message={error} />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={pending}><CalendarPlus className="h-4 w-4" /> {meetingId ? "Save changes" : "Schedule meeting"}</Button>
        {onDone && <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>}
        {!meetingId && <p className="text-xs text-muted-foreground">Every member is notified when a meeting is scheduled.</p>}
      </div>
    </form>
  );
}

export function NewMeeting() {
  const [open, setOpen] = useState(false);
  if (!open) return <Button onClick={() => setOpen(true)}><CalendarPlus className="h-4 w-4" /> Schedule a meeting</Button>;
  return <div className="w-full"><MeetingForm onDone={() => setOpen(false)} /></div>;
}
