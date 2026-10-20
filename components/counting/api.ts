import { createClient } from "@/lib/supabase/client";
import { EMPTY_LIVE, type BallotKind, type ChainStatus, type CountingStatus, type EndResult, type HistoryData, type IntegritySetting, type LiveState, type Reconciliation } from "@/lib/live";

// Everything the counting screen needs from the backend.
export interface CountApi {
  poll(): Promise<LiveState>;
  // Calls onChange whenever ballots, confirmations or the election status change anywhere; returns an unsubscribe function.
  subscribe(onChange: () => void): () => void;
  record(race: string, kind: BallotKind, choices: string[]): Promise<void>;
  undo(race: string): Promise<void>;
  confirm(race: string): Promise<void>;
  reopen(race: string): Promise<void>;
  // Ending the election runs the reconciliation. If it finds problems the election stays open and the report is returned;
  // ending it anyway needs a written reason.
  setStatus(status: Exclude<CountingStatus, "not_started">, reason?: string): Promise<EndResult>;
  // Undo a start pressed by mistake. Only possible while no ballot has been entered.
  cancelStart(): Promise<void>;
  reconcile(): Promise<Reconciliation>;
  verifyChain(): Promise<ChainStatus>;
  startRecount(race: string, reason: string): Promise<void>;
  history(race: string | null, limit?: number): Promise<HistoryData>;
  integrity(): Promise<IntegritySetting[]>;
  saveIntegrity(s: { school: string; printedGovernment: number | null; printedSenate: number | null; issued: number | null; registered: number | null; note: string | null }): Promise<void>;
}

// Talks to Supabase straight from the browser, so ballots entered quickly are not queued behind each other like server actions would be.
export function createCountApi(): CountApi {
  const supabase = createClient();
  const call = async (fn: string, args?: object) => {
    const { data, error } = await supabase.rpc(fn, args);
    if (error) throw new Error(error.message);
    return data;
  };
  return {
    subscribe(onChange) {
      const channel = supabase.channel("counting");
      for (const table of ["ballots", "race_confirmations", "elections", "race_rounds", "election_integrity"]) {
        channel.on("postgres_changes", { event: "*", schema: "public", table }, onChange);
      }
      channel.subscribe();
      return () => { supabase.removeChannel(channel); };
    },
    poll: async () => ((await call("live_results")) as LiveState | null) ?? EMPTY_LIVE,
    record: async (race, kind, choices) => { await call("record_ballot", { p_race: race, p_kind: kind, p_choices: choices }); },
    undo: async (race) => { await call("undo_ballot", { p_race: race }); },
    confirm: async (race) => { await call("confirm_race", { p_race: race }); },
    reopen: async (race) => { await call("reopen_race", { p_race: race }); },
    setStatus: async (status, reason) => {
      const r = (await call("set_counting", { p_status: status, p_acknowledge: reason ?? null })) as { ok: boolean; blocked?: boolean; reconciliation?: Reconciliation } | null;
      return r && r.blocked ? { ok: false, blocked: true, reconciliation: r.reconciliation! } : { ok: true, reconciliation: r?.reconciliation };
    },
    cancelStart: async () => { await call("cancel_counting"); },
    reconcile: async () => ((await call("reconciliation")) as Reconciliation) ?? { checks: [], errors: 0, warnings: 0 },
    verifyChain: async () => ((await call("verify_ballot_chain")) as ChainStatus) ?? { ok: true, checked: 0, broken: [] },
    startRecount: async (race, reason) => { await call("start_recount", { p_race: race, p_reason: reason }); },
    history: async (race, limit = 500) => ((await call("ballot_history", { p_race: race, p_limit: limit, p_offset: 0 })) as HistoryData) ?? { total: 0, rows: [], counters: [] },
    integrity: async () => ((await call("integrity_settings")) as IntegritySetting[]) ?? [],
    saveIntegrity: async (s) => { await call("set_integrity", { p_school: s.school, p_printed_government: s.printedGovernment, p_printed_senate: s.printedSenate, p_issued: s.issued, p_registered: s.registered, p_note: s.note }); },
  };
}
