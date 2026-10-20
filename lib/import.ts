import type { FormQuestion } from "@/lib/types";

export type FieldTarget =
  | { type: "ignore" }
  | { type: "email" }
  | { type: "name" }
  | { type: "timestamp" }
  | { type: "team_name" }
  | { type: "member_email"; position: Position }
  | { type: "member_name"; position: Position }
  | { type: "question"; id: string };

export type Position = "president" | "vice_president" | "secretary" | "treasurer";
export const POSITIONS: { value: Position; label: string }[] = [
  { value: "president", label: "President" },
  { value: "vice_president", label: "Vice President" },
  { value: "secretary", label: "Secretary" },
  { value: "treasurer", label: "Treasurer" },
];

/** Encodes a target as a <select> value and back. */
export const targetToValue = (t: FieldTarget) =>
  t.type === "member_email" ? `member_email:${t.position}` : t.type === "member_name" ? `member_name:${t.position}` : t.type === "question" ? `question:${t.id}` : t.type;

export function valueToTarget(v: string): FieldTarget {
  const [type, arg] = v.split(":");
  if (type === "member_email" || type === "member_name") return { type, position: arg as Position };
  if (type === "question") return { type: "question", id: arg };
  if (type === "email" || type === "name" || type === "timestamp" || type === "team_name") return { type };
  return { type: "ignore" };
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const words = (s: string) => new Set(norm(s).split(" ").filter((w) => w.length > 2));

function similarity(a: string, b: string) {
  const x = norm(a), y = norm(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.includes(y) || y.includes(x)) return 0.9;
  const A = words(a), B = words(b);
  if (!A.size || !B.size) return 0;
  let hit = 0;
  A.forEach((w) => { if (B.has(w)) hit++; });
  return hit / Math.max(A.size, B.size);
}

/** Best guess of what each spreadsheet column is. Staff can change every guess before importing. */
export function guessMapping(headers: string[], questions: Pick<FormQuestion, "id" | "label">[], kind: "executive_team" | "senate"): FieldTarget[] {
  const used = new Set<string>();
  let emailTaken = false;
  return headers.map((h) => {
    const n = norm(h);
    if (n === "timestamp" || n === "submitted at" || n === "submission time") return { type: "timestamp" } as FieldTarget;
    if (!emailTaken && /(^| )e ?mail( address)?( |$)/.test(n) && !/(president|vice|secretary|treasur)/.test(n)) { emailTaken = true; return { type: "email" } as FieldTarget; }
    if (kind === "executive_team") {
      const pos = /vice/.test(n) ? "vice_president" : /president/.test(n) ? "president" : /secretary/.test(n) ? "secretary" : /treasur/.test(n) ? "treasurer" : null;
      if (pos && n.length < 40) return { type: /mail/.test(n) ? "member_email" : /name/.test(n) ? "member_name" : "member_email", position: pos } as FieldTarget;
      if (/team name|name of (your |the )?team/.test(n)) return { type: "team_name" } as FieldTarget;
    }
    if (/^(full )?name$|^your name$|^student name$/.test(n)) return { type: "name" } as FieldTarget;
    let best: { id: string; s: number } | null = null;
    for (const q of questions) {
      if (used.has(q.id)) continue;
      const s = similarity(h, q.label);
      if (s >= 0.6 && (!best || s > best.s)) best = { id: q.id, s };
    }
    if (best) { used.add(best.id); return { type: "question", id: best.id } as FieldTarget; }
    return { type: "ignore" } as FieldTarget;
  });
}

export type ImportRow = {
  email: string; name: string; submittedAt: string | null; teamName: string;
  members: Partial<Record<Position, { email?: string; name?: string }>>;
  answers: Record<string, string>;
  raw: Record<string, string>;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isEmail = (s: string) => EMAIL.test(s.trim());

/** Google Forms writes timestamps like "2026/10/20 9:14:05 AM GMT+2" or "10/20/2026 09:14:05". */
export function parseTimestamp(s: string): string | null {
  const t = s.trim();
  if (!t) return null;
  const d = new Date(t.replace(/^(\d{4})\/(\d{2})\/(\d{2})/, "$1-$2-$3").replace(/ GMT([+-]\d+)$/, (_m, z) => ` GMT${z}`));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function buildRows(records: string[][], headers: string[], mapping: FieldTarget[]): ImportRow[] {
  return records.map((rec) => {
    const row: ImportRow = { email: "", name: "", submittedAt: null, teamName: "", members: {}, answers: {}, raw: {} };
    headers.forEach((h, i) => {
      const v = (rec[i] ?? "").trim();
      if (h) row.raw[h] = v;
      const t = mapping[i];
      if (!t || !v) return;
      switch (t.type) {
        case "email": row.email = v.toLowerCase(); break;
        case "name": row.name = v; break;
        case "timestamp": row.submittedAt = parseTimestamp(v); break;
        case "team_name": row.teamName = v; break;
        case "member_email": row.members[t.position] = { ...row.members[t.position], email: v.toLowerCase() }; break;
        case "member_name": row.members[t.position] = { ...row.members[t.position], name: v }; break;
        case "question": row.answers[t.id] = v; break;
      }
    });
    return row;
  });
}
