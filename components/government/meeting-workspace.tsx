"use client";

import { useState } from "react";
import { CalendarClock, MapPin, Pencil, Play, RotateCcw, Square, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { setMeetingStatus, type MeetingPatch } from "@/lib/actions/government";
import {
  BODY_LABEL, MEETING_STATUS, MINUTES_STATUS, type ActionItem, type AgendaItem, type AttendanceRow, type GovMeeting, type GovMember, type Motion, type Person,
} from "@/lib/government";
import { ActionItems } from "./action-items";
import { AgendaPanel } from "./agenda-panel";
import { AttendancePanel } from "./attendance-panel";
import { MeetingForm } from "./meeting-form";
import { MinutesPanel } from "./minutes-panel";
import { MotionsPanel } from "./motions-panel";
import { MeetingRealtime } from "./meeting-realtime";
import { ErrorNote, useAction } from "./ui";

export type WorkspaceProps = {
  meeting: GovMeeting; whenLabel: string; approvedLabel: string | null; editPatch: MeetingPatch; plannedMinutes: number | null;
  agenda: AgendaItem[]; attendance: AttendanceRow[]; motions: Motion[]; actions: ActionItem[];
  people: Person[]; expected: GovMember[]; voters: Person[]; assignees: Person[];
  today: string; draft: string; canRun: boolean; canMakeMotions: boolean; admin: boolean; currentUserId: string;
};

export function MeetingWorkspace(w: WorkspaceProps) {
  const { meeting: m } = w;
  const [editing, setEditing] = useState(false);
  const { run, pending, error } = useAction();
  const status = MEETING_STATUS[m.status];
  const present = w.attendance.filter((a) => a.status === "present" || a.status === "late").length;
  const here = w.expected.filter((x) => w.attendance.some((a) => a.user_id === x.user_id && (a.status === "present" || a.status === "late"))).length;
  const tab = m.status === "in_progress" ? "attendance" : m.status === "completed" ? "minutes" : "agenda";
  const move = (to: Parameters<typeof setMeetingStatus>[1]) => run(() => setMeetingStatus(m.id, to));

  return (
    <div className="space-y-6">
      <MeetingRealtime meetingId={m.id} />
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={status.variant}>{status.label}</Badge>
              <Badge variant="outline">{BODY_LABEL[m.body]}</Badge>
              <Badge variant="outline">TV code {m.display_code}</Badge>
              {m.minutes_status !== "none" && <Badge variant={MINUTES_STATUS[m.minutes_status].variant}>{MINUTES_STATUS[m.minutes_status].label}</Badge>}
            </div>
            <p className="flex items-center gap-2 text-sm"><CalendarClock className="h-4 w-4 text-muted-foreground" /> {w.whenLabel}</p>
            {m.location && <p className="flex items-center gap-2 text-sm"><MapPin className="h-4 w-4 text-muted-foreground" /> {m.location}</p>}
          </div>
          {w.canRun && (
            <div className="flex flex-wrap gap-2">
              {m.status === "scheduled" && <Button disabled={pending} onClick={() => move("in_progress")}><Play className="h-4 w-4" /> Start meeting</Button>}
              {m.status === "in_progress" && <Button disabled={pending} onClick={() => move("completed")}><Square className="h-4 w-4" /> End meeting</Button>}
              {m.status === "completed" && <Button variant="outline" disabled={pending} onClick={() => move("in_progress")}><RotateCcw className="h-4 w-4" /> Reopen meeting</Button>}
              {m.status === "cancelled" && <Button variant="outline" disabled={pending} onClick={() => move("scheduled")}><RotateCcw className="h-4 w-4" /> Restore meeting</Button>}
              {m.status === "scheduled" && (
                <Button variant="outline" disabled={pending} onClick={() => { if (confirm("Cancel this meeting? Every member is told.")) move("cancelled"); }}>
                  <XCircle className="h-4 w-4" /> Cancel
                </Button>
              )}
              <Button variant="ghost" onClick={() => setEditing((v) => !v)}><Pencil className="h-4 w-4" /> {editing ? "Close" : "Edit details"}</Button>
            </div>
          )}
        </div>
        <div className="mt-3"><ErrorNote message={error} /></div>
      </section>

      {editing && w.canRun && <MeetingForm meetingId={m.id} initial={w.editPatch} onDone={() => setEditing(false)} />}

      <Tabs defaultValue={tab}>
        <TabsList className="h-auto flex-wrap justify-start gap-0.5">
          <TabsTrigger value="agenda">Agenda{w.agenda.length ? ` (${w.agenda.length})` : ""}</TabsTrigger>
          <TabsTrigger value="attendance">Attendance{w.attendance.length ? ` (${here}/${w.expected.length})` : ""}</TabsTrigger>
          <TabsTrigger value="motions">Motions{w.motions.length ? ` (${w.motions.length})` : ""}</TabsTrigger>
          <TabsTrigger value="minutes">Minutes</TabsTrigger>
          <TabsTrigger value="actions">Action items{w.actions.length ? ` (${w.actions.length})` : ""}</TabsTrigger>
        </TabsList>
        <TabsContent value="agenda">
          <AgendaPanel meetingId={m.id} items={w.agenda} people={w.people} presenters={w.assignees} canRun={w.canRun} plannedMinutes={w.plannedMinutes} />
        </TabsContent>
        <TabsContent value="attendance">
          <AttendancePanel meetingId={m.id} expected={w.expected} attendance={w.attendance} people={w.people} canRun={w.canRun} />
        </TabsContent>
        <TabsContent value="motions">
          <MotionsPanel meetingId={m.id} motions={w.motions} agenda={w.agenda} people={w.people} voters={w.voters} canRun={w.canRun} canMakeMotions={w.canMakeMotions} currentUserId={w.currentUserId} />
        </TabsContent>
        <TabsContent value="minutes">
          <MinutesPanel meetingId={m.id} saved={m.minutes ?? ""} status={m.minutes_status} approvedLabel={w.approvedLabel} draft={w.draft} canRun={w.canRun} admin={w.admin} />
        </TabsContent>
        <TabsContent value="actions">
          <ActionItems items={w.actions} people={w.people} assignees={w.assignees} canRun={w.canRun} today={w.today} meetingId={m.id} currentUserId={w.currentUserId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
