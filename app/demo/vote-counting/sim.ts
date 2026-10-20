import type { CountApi } from "@/components/counting/api";
import { DEFAULT_CONFIG, raceLabel } from "@/lib/config";
import { type BallotKind, type Check, type CountingStatus, type HistoryData, type IntegritySetting, type LiveRace, type LiveState, type Reconciliation, type School } from "@/lib/live";

// An in-browser stand-in for the counting backend, so the demo behaves like the real thing without saving anything.
type Who = "a" | "b";
const NAMES: Record<Who, string> = { a: "Arta Krasniqi", b: "Dren Morina" };

const team = (id: string, num: number, label: string, sub: string, m: [string, string, string, string]) => ({
  id, num, label, sub, votes: 0,
  members: ["president", "vice_president", "secretary", "treasurer"].map((role, k) => ({ role, name: m[k] })),
});
const senators = (list: string[], grade: number) => list.map((n, i) => ({ id: `s${grade}-${i}`, num: i + 1, label: n, sub: `Grade ${grade}`, members: [], votes: 0 }));

export const SEED = [
  { race: "exec-high", kind: "exec" as const, school: "high" as const, maxChoices: 1, seats: 1, candidates: [
    team("h1", 1, "Team Phoenix", "Lead with Heart", ["Arta Krasniqi", "Leon Hoxha", "Dea Berisha", "Ilir Gashi"]),
    team("h2", 2, "Team Horizon", "Building Tomorrow", ["Dren Morina", "Vesa Rama", "Rron Basha", "Lira Hoti"]),
  ] },
  { race: "senate-high", kind: "senate" as const, school: "high" as const, maxChoices: 3, seats: 5, candidates: senators(["Elira Bytyqi", "Nruen Shabani", "Yllka Morina", "Besart Gjoka", "Arben Hoxha", "Lule Rexhepi", "Ardita Berisha", "Gent Krasniqi", "Fitore Kelmendi", "Kreshnik Dema", "Drita Leka", "Rinor Gashi"], 11) },
  { race: "exec-middle", kind: "exec" as const, school: "middle" as const, maxChoices: 1, seats: 1, candidates: [
    team("m1", 1, "Team Unity", "One Voice, One School", ["Zana Beqiri", "Bora Dina", "Lola Sahiti", "Mir Kuci"]),
    team("m2", 2, "Team Spark", "Ideas that Matter", ["Rea Gjini", "Alba Mula", "Edon Rexha", "Era Seferi"]),
    team("m3", 3, "Team Bridge", "Together Forward", ["Nora Shala", "Dion Aliu", "Amar Zeka", "Lea Vata"]),
  ] },
  { race: "senate-middle", kind: "senate" as const, school: "middle" as const, maxChoices: 3, seats: 5, candidates: senators(["Dion Krasniqi", "Vlora Hasani", "Ardit Mehmeti", "Nika Rama", "Samir Dibra", "Kaltrina Peci", "Orgesa Sopi", "Rinesa Veliu"], 7) },
];

interface Ballot { seq: number; race: string; round: number; kind: BallotKind; choices: string[]; by: Who; at: string; voided?: { by: Who; at: string } }
interface Settings { printedGovernment: number | null; printedSenate: number | null; issuedOverride: number | null; registeredOverride: number | null; note: string | null; updatedAt: string | null }

export function createSim(issuedHigh: () => number) {
  const state = {
    status: "counting" as CountingStatus,
    ballots: [] as Ballot[],
    confirmed: new Set<string>(),
    rounds: {} as Record<string, number>,
    seq: 0,
    who: "a" as Who,
    settings: {
      high: { printedGovernment: 250, printedSenate: 250, issuedOverride: null, registeredOverride: null, note: null, updatedAt: null },
      middle: { printedGovernment: 320, printedSenate: 320, issuedOverride: null, registeredOverride: null, note: null, updatedAt: null },
    } as Record<School, Settings>,
  };
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());

  const round = (race: string) => state.rounds[race] ?? 1;
  const active = (race: string, r = round(race)) => state.ballots.filter((b) => b.race === race && b.round === r && !b.voided);
  const regAuto = (s: School) => (s === "high" ? 640 : 410);
  const issAuto = (s: School) => (s === "high" ? issuedHigh() : 301);
  const registered = (s: School) => state.settings[s].registeredOverride ?? regAuto(s);
  const issued = (s: School) => state.settings[s].issuedOverride ?? issAuto(s);
  const votesFor = (race: string, id: string, r = round(race)) => active(race, r).filter((b) => b.kind === "valid" && b.choices.includes(id)).length;

  const view = (): LiveState => ({
    status: state.status,
    endedAt: state.status === "ended" ? new Date().toISOString() : null,
    races: SEED.map((r): LiveRace => {
      const mine = active(r.race);
      const last = mine[mine.length - 1];
      const lastMine = [...mine].reverse().find((b) => b.by === state.who);
      const cur = round(r.race);
      return {
        race: r.race, kind: r.kind, school: r.school, maxChoices: r.maxChoices, seats: r.seats,
        valid: mine.filter((b) => b.kind === "valid").length, invalid: mine.filter((b) => b.kind === "invalid").length, blank: mine.filter((b) => b.kind === "blank").length,
        voided: state.ballots.filter((b) => b.race === r.race && b.round === cur && b.voided).length,
        round: cur,
        rounds: Array.from({ length: cur - 1 }, (_, i) => {
          const k = i + 1; const rb = active(r.race, k);
          return { round: k, valid: rb.filter((b) => b.kind === "valid").length, invalid: rb.filter((b) => b.kind === "invalid").length, blank: rb.filter((b) => b.kind === "blank").length, votes: Object.fromEntries(r.candidates.map((c) => [c.id, votesFor(r.race, c.id, k)])) };
        }),
        printed: r.kind === "exec" ? state.settings[r.school].printedGovernment : state.settings[r.school].printedSenate,
        issued: issued(r.school), registered: registered(r.school),
        confirmed: state.confirmed.has(r.race), countedByMe: !!last && last.by === state.who, lastBallotAt: last?.at ?? null,
        lastChoices: lastMine?.choices ?? [],
        candidates: r.candidates.map((c) => ({ ...c, votes: votesFor(r.race, c.id) })),
      };
    }),
  });

  const open = (race: string) => {
    if (state.status !== "counting") throw new Error("Counting is not open.");
    if (state.confirmed.has(race)) throw new Error("This race is confirmed. An admin must reopen it.");
  };

  const reconcile = (): Reconciliation => {
    const checks: Check[] = [];
    const school = (s: School) => (s === "middle" ? "Middle School" : "High School");
    const margins: Record<string, { margin: number; dev: number }> = {};
    for (const s of ["middle", "high"] as School[]) {
      const lbl = school(s), cfg = state.settings[s], reg = registered(s), iss = issued(s);
      const cg = active(`exec-${s}`).length, cs = active(`senate-${s}`).length;
      let dev = 0;
      // Government vs Senate differences and uncounted ballots only mean something once the school's count is finished.
      const done = state.confirmed.has(`exec-${s}`) && state.confirmed.has(`senate-${s}`);
      if (cfg.printedGovernment == null && cfg.printedSenate == null) checks.push({ id: `pm-${s}`, level: "warn", school: s, title: `${lbl}: printed ballots not entered`, detail: "Enter how many ballots were printed so printing and issuing can be compared." });
      if (cfg.printedGovernment != null && iss > cfg.printedGovernment) { dev = Math.max(dev, iss - cfg.printedGovernment); checks.push({ id: `ipg-${s}`, level: "error", school: s, title: `${lbl}: more Government ballots issued than printed`, detail: `${iss} issued, ${cfg.printedGovernment} printed.` }); }
      if (cfg.printedSenate != null && iss > cfg.printedSenate) { dev = Math.max(dev, iss - cfg.printedSenate); checks.push({ id: `ips-${s}`, level: "error", school: s, title: `${lbl}: more Senate ballots issued than printed`, detail: `${iss} issued, ${cfg.printedSenate} printed.` }); }
      if (iss > reg) { dev = Math.max(dev, iss - reg); checks.push({ id: `ir-${s}`, level: "error", school: s, title: `${lbl}: more ballots issued than registered voters`, detail: `${iss} issued, ${reg} registered.` }); }
      if (cg > iss) { dev = Math.max(dev, cg - iss); checks.push({ id: `cgi-${s}`, level: "error", school: s, title: `${lbl}: more Government ballots counted than issued`, detail: `${cg} counted, ${iss} issued. Ballots may have been added.` }); }
      if (cs > iss) { dev = Math.max(dev, cs - iss); checks.push({ id: `csi-${s}`, level: "error", school: s, title: `${lbl}: more Senate ballots counted than issued`, detail: `${cs} counted, ${iss} issued. Ballots may have been added.` }); }
      if (Math.max(cg, cs) > reg) checks.push({ id: `cr-${s}`, level: "error", school: s, title: `${lbl}: more ballots counted than registered voters`, detail: `${Math.max(cg, cs)} counted, ${reg} registered.` });
      if (done && cg !== cs && (cg > 0 || cs > 0)) { dev = Math.max(dev, Math.abs(cg - cs)); checks.push({ id: `gs-${s}`, level: Math.abs(cg - cs) > Math.max(3, iss * 0.02) ? "error" : "warn", school: s, title: `${lbl}: Government and Senate counts differ`, detail: `Each voter gets both ballots, but ${cg} Government and ${cs} Senate ballots were counted.` }); }
      if (done && Math.max(cg, cs) < iss && (cg > 0 || cs > 0)) checks.push({ id: `inc-${s}`, level: "warn", school: s, title: `${lbl}: issued ballots not counted`, detail: `${iss - Math.max(cg, cs)} ballots were issued but not found in the count (not cast, spoiled or lost). They should be accounted for.` });
      if (cfg.printedGovernment != null && cfg.printedGovernment >= iss) checks.push({ id: `un-${s}`, level: "ok", school: s, title: `${lbl}: unused ballots`, detail: `${cfg.printedGovernment - iss} Government ballots were printed but not issued.` });
      const sorted = SEED.find((x) => x.race === `exec-${s}`)!.candidates.map((c) => votesFor(`exec-${s}`, c.id)).sort((a, b) => b - a);
      margins[s] = { margin: (sorted[0] ?? 0) - (sorted[1] ?? 0), dev: Math.max(cg > iss ? cg - iss : 0, done ? Math.abs(cg - cs) : 0, done && iss > Math.max(cg, cs) ? iss - Math.max(cg, cs) : 0) };
    }
    for (const r of SEED) {
      const cur = round(r.race), all = state.ballots.filter((b) => b.race === r.race && b.round === cur), voided = all.filter((b) => b.voided).length;
      if (all.length >= 10 && voided * 100 > all.length * 10) checks.push({ id: `vd-${r.race}`, level: "warn", school: r.school, race: r.race, title: `${raceLabel(DEFAULT_CONFIG, r.race)}: many ballots were undone`, detail: `${voided} of ${all.length} entered ballots were voided. Check the ballot history for who undid them.` });
      if (cur > 1) {
        const diff = r.candidates.reduce((n, c) => n + Math.abs(votesFor(r.race, c.id) - votesFor(r.race, c.id, cur - 1)), 0);
        checks.push({ id: `rc-${r.race}`, level: diff > 0 ? "error" : "ok", school: r.school, race: r.race, title: `${raceLabel(DEFAULT_CONFIG, r.race)}: round ${cur} compared with round ${cur - 1}`, detail: diff > 0 ? `The recount differs from the earlier count by ${diff} vote(s) in total.` : "The recount matches the earlier count." });
      }
    }
    for (const s of ["middle", "high"] as School[]) {
      const m = margins[s];
      if (m.dev > 0 && m.dev >= m.margin && active(`exec-${s}`).length > 0) checks.push({ id: `mg-${s}`, level: "error", school: s, race: `exec-${s}`, title: `${school(s)} Government: the gap is as large as the winning margin`, detail: `The winner leads by ${m.margin} vote(s), but the numbers differ by up to ${m.dev} ballot(s). The result cannot be trusted until it is recounted or the election is repeated.` });
    }
    return { checks, errors: checks.filter((c) => c.level === "error").length, warnings: checks.filter((c) => c.level === "warn").length };
  };

  const api: CountApi = {
    poll: async () => view(),
    subscribe: (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    record: async (race, kind, choices) => { open(race); state.ballots.push({ seq: ++state.seq, race, round: round(race), kind, choices, by: state.who, at: new Date().toISOString() }); emit(); },
    undo: async (race) => {
      open(race);
      const b = [...state.ballots].reverse().find((x) => x.race === race && x.round === round(race) && !x.voided && x.by === state.who);
      if (!b) throw new Error("You have no ballot to undo in this race.");
      b.voided = { by: state.who, at: new Date().toISOString() };
      emit();
    },
    confirm: async (race) => {
      const last = [...active(race)].pop();
      if (!last) throw new Error("No ballots have been counted in this race yet.");
      if (last.by === state.who) throw new Error("A different staff member must confirm this count.");
      state.confirmed.add(race); emit();
    },
    reopen: async (race) => { state.confirmed.delete(race); emit(); },
    setStatus: async (st, reason) => {
      if (st === "counting") { state.status = "counting"; emit(); return { ok: true }; }
      if (SEED.some((r) => !state.confirmed.has(r.race))) throw new Error("Confirm every race before ending the election.");
      const rec = reconcile();
      if (rec.errors > 0 && !(reason && reason.trim().length >= 5)) return { ok: false, blocked: true, reconciliation: rec };
      state.status = "ended"; emit();
      return { ok: true, reconciliation: rec };
    },
    cancelStart: async () => {
      if (state.ballots.length > 0 || state.confirmed.size > 0) throw new Error("Ballots have already been entered, so counting cannot be cancelled.");
      state.status = "not_started"; emit();
    },
    reconcile: async () => reconcile(),
    verifyChain: async () => ({ ok: true, checked: state.ballots.length, broken: [] }),
    startRecount: async (race, reason) => {
      if (reason.trim().length < 5) throw new Error("Write the reason for the recount.");
      state.rounds[race] = round(race) + 1; state.confirmed.delete(race); emit();
    },
    history: async (race) => {
      const nums = (b: Ballot) => SEED.find((r) => r.race === b.race)!.candidates.filter((c) => b.choices.includes(c.id)).map((c) => c.num);
      const list = state.ballots.filter((b) => !race || b.race === race);
      const rows = [...list].reverse().map((b) => ({ seq: b.seq, at: b.at, race: b.race, round: b.round, kind: b.kind, marks: nums(b), by: NAMES[b.by], byId: b.by, voided: !!b.voided, voidedAt: b.voided?.at ?? null, voidedBy: b.voided ? NAMES[b.voided.by] : null, hash: (b.seq * 2654435761 >>> 0).toString(16).padStart(8, "0") + "ab" }));
      const counters = (["a", "b"] as Who[]).map((w) => { const mine = list.filter((b) => b.by === w); return { name: NAMES[w], id: w, active: mine.filter((b) => !b.voided).length, voided: mine.filter((b) => b.voided).length, first: mine[0]?.at ?? new Date().toISOString(), last: mine[mine.length - 1]?.at ?? new Date().toISOString() }; }).filter((c) => c.active + c.voided > 0);
      return { total: list.length, rows, counters } satisfies HistoryData;
    },
    integrity: async () => (["middle", "high"] as School[]).map((s): IntegritySetting => ({ school: s, ...state.settings[s], issuedAuto: issAuto(s), registeredAuto: regAuto(s), locked: state.status === "ended" })),
    saveIntegrity: async (v) => {
      state.settings[v.school as School] = { printedGovernment: v.printedGovernment, printedSenate: v.printedSenate, issuedOverride: v.issued, registeredOverride: v.registered, note: v.note, updatedAt: new Date().toISOString() };
      emit();
    },
  };

  // Stand-in for a teammate counting in the same race on another screen.
  const teammate = (race: string, n: number) => {
    const ids = SEED.find((r) => r.race === race)!.candidates.map((c) => c.id);
    for (let i = 0; i < n; i++) state.ballots.push({ seq: ++state.seq, race, round: round(race), kind: "valid", choices: [ids[Math.floor(Math.random() * ids.length)]], by: state.who === "a" ? "b" : "a", at: new Date().toISOString() });
    emit();
  };

  return { state, api, view, emit, teammate };
}
