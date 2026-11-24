// Student votes: questions put to the whole school.

export type PollKind = "single" | "multiple";
export type PollStatus = "draft" | "open" | "closed";
export type ShowResults = "live" | "after_close";

export interface PollOption { id: string; poll_id: string; label: string; position: number }
export interface Poll {
  id: string; title: string; description: string | null; kind: PollKind; max_choices: number; show_results: ShowResults;
  status: PollStatus; closes_at: string | null; opened_at: string | null; closed_at: string | null; created_at: string;
  options: PollOption[];
}
/** Counts only. `options` is null while results are hidden from the person asking. */
export interface PollSummary {
  voters: number; ended: boolean; options: { id: string; label: string; votes: number }[] | null;
}

export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 12;

export const POLL_STATUS: Record<PollStatus, { label: string; variant: "secondary" | "success" | "info" }> = {
  draft: { label: "Draft", variant: "secondary" },
  open: { label: "Voting open", variant: "success" },
  closed: { label: "Closed", variant: "info" },
};

/** The current time as an ISO string. Kept here so pages read the clock in one place. */
export function nowIso() {
  return new Date().toISOString();
}

/** A vote is over once it is closed or its closing time has passed, even if nobody pressed Close. */
export function isEnded(poll: Pick<Poll, "status" | "closes_at">, now: string) {
  return poll.status === "closed" || (poll.closes_at !== null && poll.closes_at <= now);
}

/** Options ranked as given, with each one's share of the students who voted and whether it is leading. */
export function standings(summary: PollSummary) {
  const rows = summary.options ?? [];
  const top = Math.max(0, ...rows.map((r) => r.votes));
  return rows.map((r) => ({
    ...r,
    share: summary.voters > 0 ? r.votes / summary.voters : 0,
    leading: top > 0 && r.votes === top,
  }));
}

export function choiceHint(kind: PollKind, max: number) {
  return kind === "single" ? "Choose one" : `Choose up to ${max}`;
}
