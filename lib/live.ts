export type School = string; // a school key from the settings, for example "middle" or "high"
export type CountingStatus = "not_started" | "counting" | "ended";
export type BallotKind = "valid" | "invalid" | "blank";

export interface LiveCandidate {
  id: string;
  num: number; // the number printed next to the candidate on the paper ballot
  label: string;
  sub: string | null;
  members: { role: string; name: string }[];
  votes: number;
}

export interface RoundSummary { round: number; valid: number; invalid: number; blank: number; votes: Record<string, number> }

export interface LiveRace {
  race: string;
  kind: "exec" | "senate";
  school: School;
  maxChoices: number;
  seats: number;
  valid: number;
  invalid: number;
  blank: number;
  printed: number | null; // ballots printed for this race, entered by an admin
  issued: number | null; // ballots handed out (polling-desk check-ins, or the number an admin entered)
  registered: number; // people registered to vote in this school
  round: number; // 1 for the first count, higher after a recount
  rounds: RoundSummary[]; // earlier rounds, kept for comparison
  voided: number; // ballots undone in this round
  confirmed: boolean;
  countedByMe: boolean; // the last ballot in this race was entered by the signed-in person
  lastBallotAt: string | null;
  lastChoices: string[]; // candidate ids on the signed-in person's most recent valid ballot
  candidates: LiveCandidate[];
}

export interface LiveState {
  status: CountingStatus;
  startedAt?: string | null;
  endedAt?: string | null;
  races: LiveRace[];
}

export const EMPTY_LIVE: LiveState = { status: "not_started", races: [] };

export const ROLE_LABEL: Record<string, string> = { president: "President", vice_president: "Vice-president", secretary: "Secretary", treasurer: "Treasurer" };

export const raceBallots = (r: LiveRace) => r.valid + r.invalid + r.blank;

export interface HistoryRow {
  seq: number;
  at: string;
  race: string;
  round: number;
  kind: BallotKind;
  marks: number[]; // candidate numbers marked on the ballot
  by: string;
  byId: string | null;
  voided: boolean;
  voidedAt: string | null;
  voidedBy: string | null;
  hash: string;
}
export interface CounterSummary { name: string; id: string | null; active: number; voided: number; first: string; last: string }
export interface HistoryData { total: number; rows: HistoryRow[]; counters: CounterSummary[] }

export interface Check { id: string; level: "ok" | "warn" | "error"; school?: School; race?: string; title: string; detail: string }
export interface Reconciliation { checks: Check[]; errors: number; warnings: number }
export interface ChainStatus { ok: boolean; checked: number; broken: number[] }

export interface IntegritySetting {
  school: School;
  label?: string;
  printedGovernment: number | null;
  printedSenate: number | null;
  issuedOverride: number | null;
  registeredOverride: number | null;
  issuedAuto: number;
  registeredAuto: number;
  note: string | null;
  updatedAt: string | null;
  locked: boolean;
}

export type EndResult = { ok: true; reconciliation?: Reconciliation } | { ok: false; blocked: true; reconciliation: Reconciliation };

// Quick flags on the count screen. The full check, including the winning margin, is the reconciliation.
export function ballotFlags(r: LiveRace) {
  const out: { tone: "danger" | "warning"; text: string }[] = [];
  const counted = raceBallots(r);
  if (r.issued != null && counted > r.issued) out.push({ tone: "danger", text: `${counted - r.issued} more ballots counted than issued` });
  if (r.issued != null && r.printed != null && r.issued > r.printed) out.push({ tone: "danger", text: `${r.issued - r.printed} more ballots issued than printed` });
  if (r.registered > 0 && counted > r.registered) out.push({ tone: "danger", text: "More ballots than registered voters" });
  return out;
}
