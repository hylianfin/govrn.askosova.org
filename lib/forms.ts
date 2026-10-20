import type { FormQuestion } from "@/lib/types";

export type AnswerValue = { text: string; values?: string[] };
export type AnswerMap = Record<string, AnswerValue>;
export type QuestionType = FormQuestion["type"];
export type QuestionScope = FormQuestion["scope"];

export const CHOICE_TYPES: QuestionType[] = ["dropdown", "single_choice", "multiple_choice"];

export const TYPE_LABELS: Record<QuestionType, string> = {
  short_text: "Short answer",
  long_text: "Paragraph",
  single_choice: "Multiple choice",
  multiple_choice: "Checkboxes",
  dropdown: "Dropdown",
  checkbox: "Confirmation checkbox",
  date: "Date",
  number: "Number",
  email: "Email",
  file_upload: "File link",
};

export const SCOPE_LABELS: Record<QuestionScope, string> = {
  team: "Shared by the whole team",
  individual: "Each member answers",
  applicant: "Applicant answers",
};

export function isAnswered(q: Pick<FormQuestion, "type">, v?: AnswerValue) {
  if (!v) return false;
  if (q.type === "multiple_choice") return (v.values?.length ?? 0) > 0;
  return v.text.trim().length > 0;
}

export function normalizeAnswer(q: Pick<FormQuestion, "type" | "options">, raw: unknown): AnswerValue | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { text?: unknown; values?: unknown };
  const options = (q.options ?? []).map(String);
  if (q.type === "multiple_choice") {
    const vals = Array.isArray(r.values) ? r.values.map(String).filter((v) => !options.length || options.includes(v)) : [];
    return vals.length ? { text: vals.join(", "), values: vals } : null;
  }
  let text = typeof r.text === "string" ? r.text.slice(0, 10000) : "";
  if ((q.type === "single_choice" || q.type === "dropdown") && options.length && text && !options.includes(text)) text = "";
  text = q.type === "long_text" ? text.trimEnd() : text.trim();
  return text ? { text } : null;
}

export function buildAnswerMap(
  questions: { id: string; scope: QuestionScope }[],
  rows: { question_id: string; respondent_id: string | null; value: AnswerValue | null }[],
  userId: string,
): AnswerMap {
  const out: AnswerMap = {};
  for (const q of questions) {
    const want = q.scope === "team" ? null : userId;
    const row = rows.find((r) => r.question_id === q.id && (r.respondent_id ?? null) === want);
    if (row?.value && typeof row.value.text === "string") out[q.id] = row.value;
  }
  return out;
}

export const EDITABLE_STATUSES = ["not_started", "draft", "awaiting_team_members", "ready_to_submit", "changes_requested"];
