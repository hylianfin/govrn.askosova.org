import { History } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { BallotHistoryClient } from "@/components/counting/history-client";

export const dynamic = "force-dynamic";

type Log = { id: string; action: string; created_at: string; metadata: any };

// Changes made outside normal counting (corrections, signature numbers) are listed here so the ballot history is not the only record.
function describe(l: Log): { title: string; body: string } | null {
  const m = l.metadata ?? {};
  if (l.action === "ballots.correction_note") return { title: m.title ?? "Votes corrected", body: m.summary ?? "" };
  if (l.action === "integrity.updated" && m.before?.issued != null && m.after?.issued != null && m.before.issued !== m.after.issued) {
    return { title: `Signatures changed (${m.school})`, body: `${m.before.issued} to ${m.after.issued}.${m.note ? ` ${m.note}.` : ""}` };
  }
  return null;
}

export default async function Page() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("audit_logs").select("id, action, created_at, metadata")
    .in("action", ["ballots.correction_note", "integrity.updated"])
    .order("created_at", { ascending: false }).limit(50);
  const notes = ((data ?? []) as Log[]).map((l) => ({ l, d: describe(l) })).filter((x) => x.d);

  return (
    <div className="space-y-6">
      {notes.length > 0 && (
        <section className="rounded-xl border border-warning/40 bg-warning/5 p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold"><History className="h-4 w-4" /> Corrections and changes</h2>
          <ul className="mt-3 space-y-3 text-sm">
            {notes.map(({ l, d }) => (
              <li key={l.id}>
                <p className="font-medium">{d!.title} <span className="font-normal text-muted-foreground">· {new Date(l.created_at).toLocaleString("en-GB")}</span></p>
                <p className="text-muted-foreground">{d!.body}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
      <BallotHistoryClient eyebrow="Admin console" />
    </div>
  );
}
