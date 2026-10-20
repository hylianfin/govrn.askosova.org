import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { PageHeader, Section, StatusBadge, EmptyState } from "@/components/dashboard/primitives";
import { NoteForm, ReviewPanel, type Criterion } from "@/components/review/review-panel";
import { STATUS_LABELS } from "@/lib/types";

const POS: Record<string, string> = { president: "President", vice_president: "Vice President", secretary: "Secretary", treasurer: "Treasurer" };
const DECISION_LABEL: Record<string, string> = { approved: "Approved", rejected: "Denied", changes_requested: "Changes requested", pending: "Pending" };
const DECISION_VARIANT: Record<string, "success" | "danger" | "warning" | "secondary"> = { approved: "success", rejected: "danger", changes_requested: "warning", pending: "secondary" };

export default async function ApplicationReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: app } = await supabase.from("applications").select("*, executive_teams(name, slogan, introduction)").eq("id", id).maybeSingle();
  if (!app) notFound();

  const isExec = app.kind === "executive_team";
  const [{ data: questions }, { data: answers }, { data: members }, { data: rules }, { data: checks }, { data: reviews }, { data: notes }, { data: applicant }] = await Promise.all([
    supabase.from("application_questions").select("*").eq("version_id", app.form_version_id).order("order_index"),
    supabase.from("application_answers").select("question_id, respondent_id, value").eq("application_id", id),
    isExec ? supabase.from("executive_team_members").select("user_id, position, accepted").eq("team_id", app.executive_team_id) : Promise.resolve({ data: [] as any[] }),
    supabase.from("eligibility_rules").select("*").eq("scope", isExec ? "executive" : "senate").eq("is_active", true).order("display_order"),
    supabase.from("eligibility_checks").select("rule_id, status, notes").eq("application_id", id).is("user_id", null),
    supabase.from("application_reviews").select("*").eq("application_id", id).order("created_at", { ascending: false }),
    supabase.from("review_notes").select("*").eq("application_id", id).order("created_at", { ascending: false }),
    app.applicant_id ? supabase.from("profiles").select("full_name, email, grade_level, homeroom").eq("id", app.applicant_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const personIds = Array.from(new Set([...(members ?? []).map((m: any) => m.user_id), ...(reviews ?? []).map((r: any) => r.reviewer_id), ...(notes ?? []).map((n: any) => n.author_id)].filter(Boolean)));
  const { data: people } = personIds.length ? await supabase.from("profiles").select("id, full_name, email, grade_level").in("id", personIds) : { data: [] };
  const person = new Map<string, any>((people ?? []).map((p: any) => [p.id, p]));
  const nameOf = (uid?: string | null) => (uid ? person.get(uid)?.full_name || person.get(uid)?.email || "Unknown" : "Unknown");

  const memberList: any[] = members ?? [];
  const grades = new Set(memberList.map((m) => person.get(m.user_id)?.grade_level).filter(Boolean));
  const hintFor = (r: any): Criterion["hint"] => {
    if (!isExec) return undefined;
    if (r.rule_type === "team_size") { const want = r.config?.value ?? 4; return { text: `${memberList.length} of ${want} members`, ok: memberList.length === want }; }
    if (r.rule_type === "positions") {
      const need: string[] = r.config?.positions ?? Object.keys(POS);
      const missing = need.filter((p) => !memberList.some((m) => m.position === p));
      return { text: missing.length ? `Missing ${missing.map((p) => POS[p] ?? p).join(", ")}` : "All positions filled", ok: !missing.length };
    }
    if (r.rule_type === "grade_levels") {
      const need: number[] = r.config?.required ?? [9, 10, 11, 12];
      const missing = need.filter((g) => !grades.has(g));
      return { text: missing.length ? `No member in grade ${missing.join(", ")} (from profiles)` : "All grade levels represented", ok: !missing.length };
    }
    return undefined;
  };

  const checkBy = new Map<string, any>((checks ?? []).map((c: any) => [c.rule_id, c]));
  const criteria: Criterion[] = (rules ?? []).map((r: any) => ({
    ruleId: r.id, label: r.label, description: r.description, status: checkBy.get(r.id)?.status ?? "pending", notes: checkBy.get(r.id)?.notes ?? "", hint: hintFor(r),
  }));

  const answerFor = (qid: string, respondent: string | null) => (answers ?? []).find((a: any) => a.question_id === qid && (a.respondent_id ?? null) === respondent)?.value?.text as string | undefined;
  const title = isExec ? app.executive_teams?.name ?? "Unnamed team" : applicant?.full_name || applicant?.email || "Senate applicant";
  const lastDecision = (reviews ?? []).find((r: any) => r.decision && r.decision !== "pending");

  return (
    <div className="space-y-6">
      <Link href={isExec ? "/staff/applications/executive-teams" : "/staff/applications/senate"} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to {isExec ? "executive teams" : "senate applicants"}
      </Link>
      <PageHeader
        eyebrow={isExec ? "Executive Team application" : "Student Senate application"}
        title={title}
        description={app.submitted_at ? `Submitted ${new Date(app.submitted_at).toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" })}` : "Not submitted yet"}
        actions={<StatusBadge status={app.status} label={STATUS_LABELS[app.status as keyof typeof STATUS_LABELS] ?? app.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="space-y-6">
          {isExec && (
            <Section title="Team" description={app.executive_teams?.slogan ? `“${app.executive_teams.slogan}”` : undefined}>
              {app.executive_teams?.introduction && <p className="mb-4 whitespace-pre-line text-sm text-muted-foreground">{app.executive_teams.introduction}</p>}
              <ul className="grid gap-2 sm:grid-cols-2">
                {memberList.map((m) => (
                  <li key={m.user_id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{POS[m.position] ?? m.position}</p>
                      <p className="truncate text-xs text-muted-foreground">{nameOf(m.user_id)}{person.get(m.user_id)?.grade_level ? ` · grade ${person.get(m.user_id).grade_level}` : ""}</p>
                    </div>
                    <Badge variant={m.accepted ? "success" : "warning"}>{m.accepted ? "Accepted" : "Pending"}</Badge>
                  </li>
                ))}
                {memberList.length === 0 && <li className="text-sm text-muted-foreground">No members.</li>}
              </ul>
            </Section>
          )}
          {!isExec && applicant && (
            <Section title="Applicant">
              <p className="text-sm">{applicant.full_name} · {applicant.email}</p>
              <p className="text-xs text-muted-foreground">{applicant.grade_level ? `Grade ${applicant.grade_level}` : "Grade not set"}{applicant.homeroom ? ` · Homeroom: ${applicant.homeroom}` : ""}</p>
            </Section>
          )}

          <Section title="Answers">
            <div className="space-y-5">
              {(questions ?? []).map((q: any) => (
                <div key={q.id} className="space-y-1.5">
                  <p className="text-sm font-medium">{q.label}{q.required && <span className="ml-1 text-danger">*</span>}</p>
                  {q.scope === "individual" && isExec ? (
                    <ul className="space-y-1.5">
                      {memberList.map((m) => {
                        const a = answerFor(q.id, m.user_id);
                        return (
                          <li key={m.user_id} className="rounded-lg bg-muted/60 px-3 py-2">
                            <p className="text-xs font-medium text-muted-foreground">{POS[m.position] ?? m.position} · {nameOf(m.user_id)}</p>
                            {a ? <p className="whitespace-pre-line text-sm">{a}</p> : <p className="text-sm italic text-muted-foreground">No answer</p>}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (() => {
                    const a = answerFor(q.id, q.scope === "team" ? null : app.applicant_id);
                    return (
                      <div className="rounded-lg bg-muted/60 px-3 py-2">
                        {a ? <p className="whitespace-pre-line text-sm">{a}</p> : <p className="text-sm italic text-muted-foreground">No answer</p>}
                      </div>
                    );
                  })()}
                </div>
              ))}
              {(questions ?? []).length === 0 && <EmptyState>This application has no questions.</EmptyState>}
            </div>
          </Section>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <ReviewPanel applicationId={id} status={app.status} criteria={criteria} lastReason={lastDecision?.reason} />

          <Section title="Decision history">
            {(reviews ?? []).length === 0 ? <EmptyState>No decisions yet.</EmptyState> : (
              <ul className="space-y-4">
                {(reviews ?? []).map((r: any) => (
                  <li key={r.id} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant={DECISION_VARIANT[r.decision] ?? "secondary"}>{DECISION_LABEL[r.decision] ?? r.decision}</Badge>
                      <span className="text-xs text-muted-foreground">{new Date(r.decided_at ?? r.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">by {nameOf(r.reviewer_id)}</p>
                    {r.reason && <p className="whitespace-pre-line text-sm">{r.reason}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Internal notes" description="Only staff can see these.">
            <div className="space-y-4">
              <NoteForm applicationId={id} />
              <ul className="space-y-3">
                {(notes ?? []).map((n: any) => (
                  <li key={n.id} className="rounded-lg border border-border p-3 text-sm">
                    <p className="whitespace-pre-line">{n.note}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{nameOf(n.author_id)} · {new Date(n.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</p>
                  </li>
                ))}
              </ul>
            </div>
          </Section>
        </aside>
      </div>
    </div>
  );
}
