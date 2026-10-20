"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";
import type { AnswerValue } from "@/lib/forms";
import type { FormQuestion } from "@/lib/types";

type Q = Pick<FormQuestion, "id" | "type" | "options" | "label">;

const underline =
  "w-full border-0 border-b border-border bg-transparent px-0 py-2 text-sm outline-none transition-[border-color,box-shadow] " +
  "placeholder:text-muted-foreground focus:border-primary focus:shadow-[0_1px_0_0_var(--primary)] disabled:cursor-not-allowed disabled:text-muted-foreground";

export function QuestionField({
  q, value, onChange, disabled, invalid,
}: {
  q: Q; value?: AnswerValue; onChange: (v: AnswerValue) => void; disabled?: boolean; invalid?: boolean;
}) {
  const uid = useId();
  const text = value?.text ?? "";
  const options = (q.options ?? []).map(String);
  const label = `Answer: ${q.label}`;
  const ariaInvalid = invalid ? true : undefined;

  switch (q.type) {
    case "long_text":
      return (
        <textarea
          aria-label={label} aria-invalid={ariaInvalid} disabled={disabled} rows={1} value={text} placeholder="Your answer"
          onChange={(e) => { e.currentTarget.style.height = "auto"; e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`; onChange({ text: e.target.value }); }}
          ref={(el) => { if (el) { el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; } }}
          className={cn(underline, "min-h-[2.25rem] resize-none overflow-hidden")}
        />
      );
    case "single_choice":
      return (
        <div role="radiogroup" aria-label={label} aria-invalid={ariaInvalid} className="space-y-1">
          {options.length === 0 && <p className="text-sm text-muted-foreground">No options configured.</p>}
          {options.map((o, i) => (
            <label key={`${o}-${i}`} className={cn("flex cursor-pointer items-center gap-3 rounded-md px-1 py-1.5 text-sm hover:bg-muted", disabled && "cursor-not-allowed opacity-70")}>
              <input type="radio" name={`${uid}-${q.id}`} className="h-4 w-4 accent-[var(--primary)]" checked={text === o} disabled={disabled} onChange={() => onChange({ text: o })} />
              {o}
            </label>
          ))}
          {text && !disabled && (
            <button type="button" onClick={() => onChange({ text: "" })} className="px-1 pt-1 text-xs font-medium text-muted-foreground hover:text-foreground">Clear selection</button>
          )}
        </div>
      );
    case "multiple_choice": {
      const sel = value?.values ?? [];
      return (
        <div role="group" aria-label={label} className="space-y-1">
          {options.length === 0 && <p className="text-sm text-muted-foreground">No options configured.</p>}
          {options.map((o, i) => (
            <label key={`${o}-${i}`} className={cn("flex cursor-pointer items-center gap-3 rounded-md px-1 py-1.5 text-sm hover:bg-muted", disabled && "cursor-not-allowed opacity-70")}>
              <input
                type="checkbox" className="h-4 w-4 accent-[var(--primary)]" checked={sel.includes(o)} disabled={disabled}
                onChange={(e) => {
                  const next = e.target.checked ? [...sel, o] : sel.filter((x) => x !== o);
                  onChange({ text: next.join(", "), values: next });
                }}
              />
              {o}
            </label>
          ))}
        </div>
      );
    }
    case "dropdown":
      return (
        <select
          aria-label={label} aria-invalid={ariaInvalid} disabled={disabled} value={text} onChange={(e) => onChange({ text: e.target.value })}
          className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-70 sm:w-64"
        >
          <option value="">Choose</option>
          {options.map((o, i) => <option key={`${o}-${i}`} value={o}>{o}</option>)}
        </select>
      );
    case "checkbox":
      return (
        <label className="flex cursor-pointer items-start gap-3 rounded-md px-1 py-1.5 text-sm hover:bg-muted">
          <input type="checkbox" aria-invalid={ariaInvalid} className="mt-0.5 h-4 w-4 accent-[var(--primary)]" checked={text === "Yes"} disabled={disabled} onChange={(e) => onChange({ text: e.target.checked ? "Yes" : "" })} />
          {options[0] || "I confirm"}
        </label>
      );
    case "date":
      return <input type="date" aria-label={label} aria-invalid={ariaInvalid} disabled={disabled} value={text} onChange={(e) => onChange({ text: e.target.value })} className={cn(underline, "sm:w-48")} />;
    case "number":
      return <input type="number" inputMode="decimal" aria-label={label} aria-invalid={ariaInvalid} disabled={disabled} value={text} placeholder="Your answer" onChange={(e) => onChange({ text: e.target.value })} className={cn(underline, "sm:w-48")} />;
    case "email":
      return <input type="email" aria-label={label} aria-invalid={ariaInvalid} disabled={disabled} value={text} placeholder="name@example.com" onChange={(e) => onChange({ text: e.target.value })} className={cn(underline, "sm:w-2/3")} />;
    case "file_upload":
      return (
        <div>
          <input type="url" aria-label={label} aria-invalid={ariaInvalid} disabled={disabled} value={text} placeholder="Paste a link (Google Drive, YouTube, ...)" onChange={(e) => onChange({ text: e.target.value })} className={underline} />
          <p className="mt-1 text-xs text-muted-foreground">Share the file so anyone with the link can view it.</p>
        </div>
      );
    default:
      return <input type="text" aria-label={label} aria-invalid={ariaInvalid} disabled={disabled} value={text} placeholder="Your answer" onChange={(e) => onChange({ text: e.target.value })} className={cn(underline, "sm:w-2/3")} />;
  }
}
