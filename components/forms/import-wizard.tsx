"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, FileUp, Link2, Users } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { parseCsv } from "@/lib/csv";
import {
  POSITIONS, buildRows, guessMapping, isEmail, targetToValue, valueToTarget, type FieldTarget,
} from "@/lib/import";
import { importResponses, type ImportSummary } from "@/lib/actions/import";

export type ImportableForm = { kind: "executive_team" | "senate"; title: string; questions: { id: string; label: string; required: boolean }[] };

const box = "h-10 w-full rounded-md border border-border bg-card px-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

export function ImportWizard({ forms }: { forms: ImportableForm[] }) {
  const router = useRouter();
  const [kind, setKind] = useState<ImportableForm["kind"]>(forms[0]?.kind ?? "executive_team");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [records, setRecords] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<FieldTarget[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Extract<ImportSummary, { ok: true }> | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const form = forms.find((f) => f.kind === kind)!;
  const exec = kind === "executive_team";

  function load(file: File | undefined) {
    setError(null); setResult(null);
    if (!file) return;
    if (file.size > 5_000_000) { setError("That file is over 5 MB. Export fewer responses at a time."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseCsv(String(reader.result ?? ""));
      if (rows.length < 2) { setError("That file has no responses. Export the responses as a .csv from Google Forms."); return; }
      const [head, ...rest] = rows;
      setFileName(file.name); setHeaders(head); setRecords(rest);
      setMapping(guessMapping(head, form.questions, kind));
    };
    reader.onerror = () => setError("Could not read that file.");
    reader.readAsText(file);
  }

  function changeKind(k: ImportableForm["kind"]) {
    setKind(k);
    if (headers.length) setMapping(guessMapping(headers, forms.find((f) => f.kind === k)!.questions, k));
  }

  const rows = useMemo(() => (headers.length ? buildRows(records, headers, mapping) : []), [records, headers, mapping]);
  const emailCols = mapping.filter((m) => m.type === "email").length;
  const validRows = rows.filter((r) => isEmail(r.email) || r.name.trim()).length;
  const withoutEmail = rows.filter((r) => !isEmail(r.email) && r.name.trim()).length;
  const nameCols = mapping.filter((m) => m.type === "name").length;
  const mappedQuestions = new Set(mapping.flatMap((m) => (m.type === "question" ? [m.id] : [])));
  const unmappedRequired = form.questions.filter((q) => q.required && !mappedQuestions.has(q.id));
  const dupQuestions = mapping.filter((m, i) => m.type === "question" && mapping.findIndex((x) => x.type === "question" && x.id === m.id) !== i).length;

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await importResponses(kind, rows);
      if (!res.ok) { setError(res.error); return; }
      setResult(res);
      setHeaders([]); setRecords([]); setMapping([]); setFileName("");
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
        <div>
          <h2 className="text-base font-semibold">1. Choose the form and upload the responses</h2>
          <p className="text-sm text-muted-foreground">In Google Forms open <strong>Responses</strong>, then the ⋮ menu, then <strong>Download responses (.csv)</strong>.</p>
        </div>
        <div role="radiogroup" aria-label="Form" className="grid gap-2 sm:grid-cols-2">
          {forms.map((f) => (
            <button key={f.kind} type="button" role="radio" aria-checked={kind === f.kind} onClick={() => changeKind(f.kind)}
              className={cn("rounded-lg border p-3 text-left transition-colors", kind === f.kind ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border hover:bg-muted")}>
              <p className="text-sm font-semibold">{f.title}</p>
              <p className="text-xs text-muted-foreground">{f.questions.length} questions{f.kind === "executive_team" ? " · one row per team" : " · one row per applicant"}</p>
            </button>
          ))}
        </div>
        <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border px-4 py-5 hover:bg-muted/60">
          <FileUp className="h-5 w-5 text-primary" />
          <span className="text-sm">{fileName ? <><strong>{fileName}</strong> · {records.length} responses</> : "Choose a .csv file"}</span>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => load(e.target.files?.[0])} />
        </label>
      </section>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>
      )}

      {result && (
        <section className="space-y-2 rounded-xl border border-success/40 bg-success/10 p-5 text-sm" role="status">
          <p className="flex items-center gap-2 font-semibold text-success"><CheckCircle2 className="h-5 w-5" /> Import finished</p>
          <ul className="list-disc space-y-1 pl-6">
            <li><strong>{result.imported}</strong> responses saved.{result.imported - result.withoutEmail > 0 ? " Those with an email wait for that person to sign up with it." : ""}</li>
            {result.withoutEmail > 0 && <li><strong>{result.withoutEmail}</strong> have no email. Match each to an account in <em>Imported responses</em> below. If the person has already signed up, you&apos;ll see a suggestion.</li>}
            {result.linkedNow > 0 && <li><strong>{result.linkedNow}</strong> already had a confirmed account, so their application was created now.</li>}
            {result.duplicates > 0 && <li>{result.duplicates} were already imported earlier and were skipped.</li>}
            {result.skipped.length > 0 && (
              <li>{result.skipped.length} rows were skipped: {result.skipped.slice(0, 5).map((s) => `line ${s.line} (${s.reason})`).join("; ")}{result.skipped.length > 5 ? "…" : ""}</li>
            )}
          </ul>
        </section>
      )}

      {headers.length > 0 && (
        <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
          <div>
            <h2 className="text-base font-semibold">2. Check how the columns match</h2>
            <p className="text-sm text-muted-foreground">I matched columns to questions by their wording. Fix anything that is wrong. Map the person&apos;s <strong>Email</strong> if your file has one, because that is how a response finds its owner. If it has none, map the <strong>Full name</strong> instead and you will attach each response to an account afterwards.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead><tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground"><th className="py-2 pr-3">Column in your file</th><th className="py-2 pr-3">Example</th><th className="py-2 w-72">Goes to</th></tr></thead>
              <tbody>
                {headers.map((h, i) => {
                  const sample = records.map((r) => r[i]).find((v) => v && v.trim()) ?? "";
                  return (
                    <tr key={i} className="border-b border-border/60 align-top">
                      <td className="max-w-[18rem] py-2 pr-3"><p className="line-clamp-3 font-medium">{h || <em className="text-muted-foreground">(no title)</em>}</p></td>
                      <td className="max-w-[14rem] py-2 pr-3"><p className="line-clamp-2 text-muted-foreground">{sample || "—"}</p></td>
                      <td className="py-2">
                        <select aria-label={`Target for ${h}`} value={targetToValue(mapping[i] ?? { type: "ignore" })}
                          onChange={(e) => setMapping((m) => m.map((t, j) => (j === i ? valueToTarget(e.target.value) : t)))} className={box}>
                          <option value="ignore">Ignore this column</option>
                          <optgroup label="Person">
                            <option value="email">Email (required)</option>
                            <option value="name">Full name</option>
                            <option value="timestamp">Submitted at</option>
                          </optgroup>
                          {exec && (
                            <optgroup label="Team">
                              <option value="team_name">Team name</option>
                              {POSITIONS.map((p) => <option key={`e${p.value}`} value={`member_email:${p.value}`}>{p.label} email</option>)}
                              {POSITIONS.map((p) => <option key={`n${p.value}`} value={`member_name:${p.value}`}>{p.label} name</option>)}
                            </optgroup>
                          )}
                          <optgroup label="Form questions">
                            {form.questions.map((q) => <option key={q.id} value={`question:${q.id}`}>{q.label.length > 70 ? `${q.label.slice(0, 70)}…` : q.label}</option>)}
                          </optgroup>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-1 text-sm">
            {emailCols > 1 && <p className="flex items-center gap-1.5 text-danger"><AlertCircle className="h-4 w-4" />Only one column can be the Email.</p>}
            {emailCols === 0 && nameCols === 0 && <p className="flex items-center gap-1.5 text-danger"><AlertCircle className="h-4 w-4" />Choose which column is the Email or the Full name, so each response can be told apart.</p>}
            {emailCols === 0 && nameCols > 0 && <p className="text-warning">This file has no email column. The responses will be saved by name, and you match each one to an account in the list below after importing.</p>}
            {dupQuestions > 0 && <p className="flex items-center gap-1.5 text-danger"><AlertCircle className="h-4 w-4" />Two columns are set to the same question.</p>}
            {unmappedRequired.length > 0 && <p className="text-warning">{unmappedRequired.length} required question{unmappedRequired.length > 1 ? "s have" : " has"} no column: {unmappedRequired.slice(0, 3).map((q) => `“${q.label.slice(0, 40)}”`).join(", ")}{unmappedRequired.length > 3 ? "…" : ""}. The applicant will have to fill {unmappedRequired.length > 1 ? "them" : "it"} in if staff ask for changes.</p>}
            <p className="flex items-center gap-1.5 text-muted-foreground"><Users className="h-4 w-4" />{validRows} of {rows.length} responses can be imported{withoutEmail ? ` (${withoutEmail} by name only)` : ""}{validRows < rows.length ? `, ${rows.length - validRows} have neither a valid email nor a name and will be skipped` : ""}.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={submit} disabled={pending || emailCols > 1 || (emailCols === 0 && nameCols === 0) || dupQuestions > 0 || validRows === 0}>
              <Link2 className="h-4 w-4" /> {pending ? "Importing…" : `Import ${validRows} responses`}
            </Button>
            <p className="text-xs text-muted-foreground">Responses already imported are skipped, so it is safe to import the same file twice.</p>
          </div>
        </section>
      )}
    </div>
  );
}
