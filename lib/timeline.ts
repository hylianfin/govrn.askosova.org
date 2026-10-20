export type TimelineSpan = { start_at?: string | null; end_at?: string | null };

export type Position = {
  /** Index of the milestone that is happening now (or, if nothing is, the next one). -1 before nothing / no dates. */
  index: number;
  /** "now": inside its window. "next": between milestones, this one is coming up. "done": every milestone is over. */
  state: "now" | "next" | "done" | "none";
};

const t = (s?: string | null) => (s ? new Date(s).getTime() : NaN);

/** Where today falls on the timeline. Driven by the dates only, so it can never drift from reality. */
export function timelinePosition(events: TimelineSpan[], now: number = Date.now()): Position {
  const dated = events.map((e, i) => ({ i, s: t(e.start_at), e: t(e.end_at) })).filter((x) => !Number.isNaN(x.s));
  if (dated.length === 0) return { index: -1, state: "none" };

  // A milestone without an end lasts until the next one starts.
  const ends = dated.map((x, k) => (Number.isNaN(x.e) ? (dated[k + 1]?.s ?? x.s) : x.e));
  let active = -1;
  dated.forEach((x, k) => { if (x.s <= now && now <= ends[k] && (active === -1 || x.s >= dated[active].s)) active = k; });
  if (active !== -1) return { index: dated[active].i, state: "now" };

  const upcoming = dated.find((x) => x.s > now);
  if (upcoming) return { index: upcoming.i, state: "next" };
  return { index: events.length, state: "done" };
}

/** True when a milestone is completely in the past. */
export function isPast(e: TimelineSpan, now: number = Date.now()) {
  const end = t(e.end_at ?? e.start_at);
  return !Number.isNaN(end) && end < now;
}
