"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isEmail, type ImportRow } from "@/lib/import";
import type { FormQuestion } from "@/lib/types";

export type ImportSummary = {
  ok: true; imported: number; duplicates: number; skipped: { line: number; reason: string }[]; linkedNow: number;
} | { ok: false; error: string };

const MAX_ROWS = 1000;

async function staff() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).in("role", ["staff_reviewer", "admin"]);
  return data?.length ? { supabase, user } : null;
}

function toAnswer(q: Pick<FormQuestion, "type" | "options">, raw: string) {
  const text = raw.trim();
  if (!text) return null;
  if (q.type === "multiple_choice") {
    const values = text.split(/\s*,\s*/).map((s) => s.trim()).filter(Boolean);
    return { text: values.join(", "), values };
  }
  if (q.type === "checkbox") return { text: "Yes" };
  return { text: text.slice(0, 10000) };
}

export async function importResponses(kind: "executive_team" | "senate", rows: ImportRow[]): Promise<ImportSummary> {
  const c = await staff();
  if (!c) return { ok: false, error: "Only staff can import responses." };
  const { supabase, user } = c;
  if (!["executive_team", "senate"].includes(kind)) return { ok: false, error: "Unknown form." };
  if (!Array.isArray(rows) || rows.length === 0) return { ok: false, error: "There are no rows to import." };
  if (rows.length > MAX_ROWS) return { ok: false, error: `Import at most ${MAX_ROWS} rows at a time.` };

  const { data: form } = await supabase.from("application_forms").select("id").eq("kind", kind).limit(1).maybeSingle();
  if (!form) return { ok: false, error: "That form does not exist." };
  const { data: versions } = await supabase.from("application_form_versions").select("id, status, version_number").eq("form_id", form.id).order("version_number", { ascending: false });
  const version = (versions ?? []).find((v: any) => v.status === "published") ?? versions?.[0];
  if (!version) return { ok: false, error: "That form has no version." };

  const { data: qs } = await supabase.from("application_questions").select("id, type, options").eq("version_id", version.id);
  const questions = new Map<string, any>((qs ?? []).map((q: any) => [q.id, q]));

  const { data: existing } = await supabase.from("imported_responses").select("email, submitted_at").eq("kind", kind);
  const seen = new Set((existing ?? []).map((e: any) => `${String(e.email).toLowerCase()}|${e.submitted_at ? new Date(e.submitted_at).getTime() : 0}`));

  const batch = crypto.randomUUID();
  const skipped: { line: number; reason: string }[] = [];
  let duplicates = 0;
  const insert: any[] = [];

  rows.forEach((r, i) => {
    const line = i + 2; // spreadsheet line, header is line 1
    const email = String(r.email ?? "").trim().toLowerCase();
    if (!isEmail(email)) { skipped.push({ line, reason: email ? `“${email.slice(0, 60)}” is not a valid email` : "no email address" }); return; }
    const at = r.submittedAt ? new Date(r.submittedAt) : null;
    const stamp = at && !Number.isNaN(at.getTime()) ? at.getTime() : 0;
    const key = `${email}|${stamp}`;
    if (seen.has(key)) { duplicates++; return; }
    seen.add(key);

    const answers: Record<string, unknown> = {};
    for (const [qid, raw] of Object.entries(r.answers ?? {})) {
      const q = questions.get(qid);
      const a = q ? toAnswer(q, String(raw)) : null;
      if (a) answers[qid] = a;
    }
    const members: Record<string, { email?: string; name?: string }> = {};
    for (const [pos, m] of Object.entries(r.members ?? {})) {
      if (!["president", "vice_president", "secretary", "treasurer"].includes(pos) || !m) continue;
      const me = (m.email ?? "").trim().toLowerCase();
      if (me && !isEmail(me)) continue;
      if (me || m.name) members[pos] = { ...(me ? { email: me } : {}), ...(m.name ? { name: String(m.name).slice(0, 200) } : {}) };
    }
    insert.push({
      batch_id: batch, kind, form_id: form.id, version_id: version.id, email,
      full_name: String(r.name ?? "").trim().slice(0, 200) || null, submitted_at: stamp ? at!.toISOString() : null,
      team_name: String(r.teamName ?? "").trim().slice(0, 200) || null, members, answers, raw: r.raw ?? null, imported_by: user.id,
    });
  });

  for (let i = 0; i < insert.length; i += 100) {
    const { error } = await supabase.from("imported_responses").insert(insert.slice(i, i + 100));
    if (error) return { ok: false, error: `Imported ${i} rows, then stopped: ${error.message}` };
  }

  let linkedNow = 0;
  if (insert.length) {
    const { data } = await supabase.rpc("link_all_imported_responses");
    linkedNow = Number(data ?? 0);
    await supabase.from("audit_logs").insert({ actor_id: user.id, action: "responses.imported", entity_type: kind, metadata: { batch, imported: insert.length, duplicates, linkedNow } });
  }
  revalidatePath("/admin/forms/import");
  return { ok: true, imported: insert.length, duplicates, skipped, linkedNow };
}

export async function deleteImported(id: string): Promise<{ ok: boolean; error?: string }> {
  const c = await staff();
  if (!c) return { ok: false, error: "Only staff can do that." };
  const { error } = await c.supabase.from("imported_responses").delete().eq("id", id).eq("status", "pending");
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/forms/import");
  return { ok: true };
}

export async function linkImportedNow(): Promise<{ ok: true; linked: number } | { ok: false; error: string }> {
  const c = await staff();
  if (!c) return { ok: false, error: "Only staff can do that." };
  const { data, error } = await c.supabase.rpc("link_all_imported_responses");
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/forms/import");
  return { ok: true, linked: Number(data ?? 0) };
}
