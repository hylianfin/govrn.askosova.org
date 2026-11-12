"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useLabels } from "@/components/config-provider";

export type CandidateList = {
  race: string; school: string; kind: "exec" | "senate"; manual: boolean; locked: boolean;
  candidates: { num: number; label: string; sub: string | null; members: { role: string; name: string }[] }[];
};

const ROLES = ["president", "vice_president", "secretary", "treasurer"];

// One name per line. For a team: "Team name | President, Vice President, Secretary, Treasurer".
const toText = (l: CandidateList) =>
  l.candidates.map((c) => (c.members.length ? `${c.label} | ${c.members.map((m) => m.name).join(", ")}` : c.label)).join("\n");

function parse(text: string, kind: "exec" | "senate") {
  return text.split("\n").map((l) => l.trim()).filter(Boolean).map((line) => {
    const [label, rest] = line.split("|").map((s) => s.trim());
    const members = kind === "exec" && rest
      ? rest.split(",").map((n) => n.trim()).filter(Boolean).slice(0, 4).map((name, i) => ({ role: ROLES[i], name }))
      : [];
    return { label, members };
  });
}

export function CandidateEditor({ lists }: { lists: CandidateList[] }) {
  const router = useRouter();
  const { race: raceLabel } = useLabels();
  const [text, setText] = useState<Record<string, string>>(() => Object.fromEntries(lists.map((l) => [l.race, toText(l)])));
  const [busy, setBusy] = useState<string | null>(null);

  const save = async (l: CandidateList) => {
    setBusy(l.race);
    const { error } = await createClient().rpc("save_candidates", { p_race: l.race, p_entries: parse(text[l.race] ?? "", l.kind) });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Saved. This is the order printed on the ballot.");
    router.refresh();
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {lists.map((l) => (
        <section key={l.race} className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-lg font-bold uppercase text-navy">{raceLabel(l.race)}</h2>
            {l.locked && <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Lock className="h-3 w-3" /> Locked, counting started</span>}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {l.kind === "exec" ? "One team per line: Team name | President, Vice President, Secretary, Treasurer (names after | are optional)." : "One name per line."}
            {" "}Numbers follow the order below, so match your printed ballot.
            {!l.manual && l.candidates.length > 0 && " These came from approved applications; saving replaces them with this list."}
          </p>
          <textarea
            value={text[l.race] ?? ""}
            onChange={(e) => setText((t) => ({ ...t, [l.race]: e.target.value }))}
            disabled={l.locked}
            rows={8}
            className="mt-3 w-full rounded-md border border-input bg-background p-3 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
            placeholder={l.kind === "exec" ? "Team Eagle | Ana Krasniqi, Ben Hoxha, Dea Berisha, Leo Gashi" : "Ana Krasniqi\nBen Hoxha"}
          />
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{parse(text[l.race] ?? "", l.kind).length} on the list</span>
            <Button size="sm" disabled={l.locked || busy === l.race} onClick={() => save(l)}>{busy === l.race ? "Saving…" : "Save list"}</Button>
          </div>
        </section>
      ))}
      <p className="text-sm text-muted-foreground lg:col-span-2">
        When the lists are saved, <Link href="/admin/election-results" className="font-medium text-primary underline-offset-4 hover:underline">open Election Results</Link> and press Start counting.
      </p>
    </div>
  );
}
