"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CHOICE_TYPES } from "@/lib/forms";
import type { FormQuestion } from "@/lib/types";

const TYPES = ["short_text", "long_text", "email", "number", "dropdown", "single_choice", "multiple_choice", "checkbox", "date", "file_upload"];
const SCOPES = ["team", "individual", "applicant"];

export type QuestionPatch = {
  label: string; description: string | null; type: FormQuestion["type"]; scope: FormQuestion["scope"];
  required: boolean; options: string[] | null;
};
type ListResult = { ok: true; questions: FormQuestion[] } | { ok: false; error: string };

const pathFor = (kind: string) => `/admin/forms/${kind === "executive_team" ? "executive-team" : "senate"}`;

async function admin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
  return data ? supabase : null;
}

async function latestVersion(supabase: any, kind: string) {
  const { data: form } = await supabase.from("application_forms").select("*").eq("kind", kind).limit(1).maybeSingle();
  const { data: version } = await supabase.from("application_form_versions").select("*").eq("form_id", form?.id).order("version_number", { ascending: false }).limit(1).maybeSingle();
  return { form, version };
}

async function list(supabase: any, versionId: string): Promise<FormQuestion[]> {
  const { data } = await supabase.from("application_questions").select("*").eq("version_id", versionId).order("order_index").order("created_at");
  return data ?? [];
}

async function writeOrder(supabase: any, ordered: FormQuestion[]) {
  for (let i = 0; i < ordered.length; i++) {
    if (ordered[i].order_index !== i + 1) {
      const { error } = await supabase.from("application_questions").update({ order_index: i + 1 }).eq("id", ordered[i].id);
      if (error) return error.message as string;
    }
  }
  return null;
}

function cleanOptions(type: string, options: unknown): string[] | null {
  if (!CHOICE_TYPES.includes(type as any) && type !== "checkbox") return null;
  const arr = Array.isArray(options) ? options.map((o) => String(o).trim()).filter(Boolean).slice(0, 50) : [];
  return arr.length ? arr : null;
}

export async function createQuestion(kind: string, afterId: string | null): Promise<ListResult> {
  const supabase = await admin();
  if (!supabase) return { ok: false, error: "Admins only." };
  const { form, version } = await latestVersion(supabase, kind);
  if (!form || !version) return { ok: false, error: "Form not found." };
  const current = await list(supabase, version.id);
  const after = current.find((q) => q.id === afterId);
  const { data: created, error } = await supabase.from("application_questions").insert({
    form_id: form.id, version_id: version.id,
    scope: after?.scope ?? (kind === "executive_team" ? "individual" : "applicant"),
    label: "Untitled question", type: "short_text", required: false,
    order_index: current.length + 1,
  }).select().single();
  if (error || !created) return { ok: false, error: error?.message ?? "Could not add the question." };
  const idx = after ? current.indexOf(after) + 1 : current.length;
  const ordered = [...current.slice(0, idx), created as FormQuestion, ...current.slice(idx)];
  const err = await writeOrder(supabase, ordered);
  if (err) return { ok: false, error: err };
  revalidatePath(pathFor(kind));
  return { ok: true, questions: await list(supabase, version.id) };
}

export async function saveQuestion(id: string, patch: QuestionPatch): Promise<{ ok: boolean; error?: string }> {
  const supabase = await admin();
  if (!supabase) return { ok: false, error: "Admins only." };
  const type = TYPES.includes(patch.type) ? patch.type : "short_text";
  const scope = SCOPES.includes(patch.scope) ? patch.scope : "applicant";
  const { error } = await supabase.from("application_questions").update({
    label: String(patch.label ?? "").trim().slice(0, 500) || "Untitled question",
    description: String(patch.description ?? "").trim().slice(0, 2000) || null,
    type, scope, required: !!patch.required,
    options: cleanOptions(type, patch.options),
  }).eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function removeQuestion(kind: string, id: string): Promise<ListResult> {
  const supabase = await admin();
  if (!supabase) return { ok: false, error: "Admins only." };
  const { version } = await latestVersion(supabase, kind);
  if (!version) return { ok: false, error: "Form not found." };
  const { error } = await supabase.from("application_questions").delete().eq("id", id).eq("version_id", version.id);
  if (error) return { ok: false, error: error.message };
  const rest = await list(supabase, version.id);
  const err = await writeOrder(supabase, rest);
  if (err) return { ok: false, error: err };
  revalidatePath(pathFor(kind));
  return { ok: true, questions: await list(supabase, version.id) };
}

export async function duplicateQuestion(kind: string, id: string): Promise<ListResult> {
  const supabase = await admin();
  if (!supabase) return { ok: false, error: "Admins only." };
  const { version } = await latestVersion(supabase, kind);
  if (!version) return { ok: false, error: "Form not found." };
  const current = await list(supabase, version.id);
  const src = current.find((q) => q.id === id);
  if (!src) return { ok: false, error: "Question not found." };
  const { data: copy, error } = await supabase.from("application_questions").insert({
    form_id: src.form_id, version_id: src.version_id, scope: src.scope, label: src.label, description: src.description,
    type: src.type, required: src.required, options: src.options, order_index: current.length + 1,
  }).select().single();
  if (error || !copy) return { ok: false, error: error?.message ?? "Could not duplicate." };
  const at = current.indexOf(src) + 1;
  const err = await writeOrder(supabase, [...current.slice(0, at), copy as FormQuestion, ...current.slice(at)]);
  if (err) return { ok: false, error: err };
  revalidatePath(pathFor(kind));
  return { ok: true, questions: await list(supabase, version.id) };
}

export async function moveQuestion(kind: string, id: string, dir: "up" | "down"): Promise<ListResult> {
  const supabase = await admin();
  if (!supabase) return { ok: false, error: "Admins only." };
  const { version } = await latestVersion(supabase, kind);
  if (!version) return { ok: false, error: "Form not found." };
  const current = await list(supabase, version.id);
  const i = current.findIndex((q) => q.id === id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= current.length) return { ok: true, questions: current };
  [current[i], current[j]] = [current[j], current[i]];
  const err = await writeOrder(supabase, current);
  if (err) return { ok: false, error: err };
  revalidatePath(pathFor(kind));
  return { ok: true, questions: await list(supabase, version.id) };
}

export async function updateFormMeta(kind: string, meta: { title: string; description: string }): Promise<{ ok: boolean; error?: string }> {
  const supabase = await admin();
  if (!supabase) return { ok: false, error: "Admins only." };
  const title = meta.title.trim().slice(0, 200);
  if (!title) return { ok: false, error: "The form needs a title." };
  const { error } = await supabase.from("application_forms").update({ title, description: meta.description.trim().slice(0, 2000) || null }).eq("kind", kind);
  if (error) return { ok: false, error: error.message };
  revalidatePath(pathFor(kind));
  return { ok: true };
}

export async function createNewVersion(kind: string, path: string) {
  const supabase = await admin();
  if (!supabase) return { error: "Admins only." };
  const { form, version } = await latestVersion(supabase, kind);
  if (!form || !version) return { error: "Form not found." };
  const { data: newVersion, error } = await supabase.from("application_form_versions").insert({
    form_id: form.id,
    version_number: version.version_number + 1,
    status: "draft",
  }).select().single();
  if (error || !newVersion) return { error: error?.message ?? "Could not create a version." };

  const qs = await list(supabase, version.id);
  if (qs.length) {
    const { error: copyErr } = await supabase.from("application_questions").insert(qs.map((q) => ({
      form_id: form.id, version_id: newVersion.id, scope: q.scope, label: q.label, description: q.description,
      type: q.type, required: q.required, options: q.options, order_index: q.order_index,
    })));
    if (copyErr) return { error: copyErr.message };
  }
  revalidatePath(path);
  return { success: "New draft version created." };
}

export async function publishVersion(versionId: string, path: string) {
  const supabase = await admin();
  if (!supabase) return { error: "Admins only." };
  const { data: v } = await supabase.from("application_form_versions").select("form_id").eq("id", versionId).single();
  await supabase.from("application_form_versions").update({ status: "archived" }).eq("form_id", v?.form_id).neq("id", versionId);
  const { error } = await supabase.from("application_form_versions").update({ status: "published" }).eq("id", versionId);
  if (error) return { error: error.message };
  await supabase.from("application_forms").update({ is_published: true }).eq("id", v?.form_id);
  revalidatePath(path);
  return { success: "Published." };
}
