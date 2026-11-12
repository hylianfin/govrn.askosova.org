"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export type Announcement = { id: string; title: string; body: string; published: boolean; published_at: string | null; created_at: string };

const field = "w-full rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "Draft");

// Write, edit, publish and remove the notices shown on the public home page.
export function AnnouncementManager({ initial }: { initial: Announcement[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [publish, setPublish] = useState(true);
  const [busy, setBusy] = useState(false);
  const supabase = createClient();

  const reset = () => { setEditing(null); setTitle(""); setBody(""); setPublish(true); };
  const done = (msg: string) => { toast.success(msg); router.refresh(); };

  const save = async () => {
    if (!title.trim() || !body.trim()) return toast.error("Add a title and a message.");
    setBusy(true);
    const current = initial.find((a) => a.id === editing);
    const row = { title: title.trim(), body: body.trim(), published: publish, published_at: publish ? current?.published_at ?? new Date().toISOString() : null, updated_at: new Date().toISOString() };
    const { error } = editing
      ? await supabase.from("announcements").update(row).eq("id", editing)
      : await supabase.from("announcements").insert({ ...row, author_id: (await supabase.auth.getUser()).data.user?.id });
    setBusy(false);
    if (error) return toast.error(error.message);
    reset();
    done(editing ? "Announcement updated." : publish ? "Announcement published." : "Draft saved.");
  };

  const toggle = async (a: Announcement) => {
    const { error } = await supabase.from("announcements").update({ published: !a.published, published_at: !a.published ? new Date().toISOString() : a.published_at, updated_at: new Date().toISOString() }).eq("id", a.id);
    if (error) return toast.error(error.message);
    done(a.published ? "Hidden from the home page." : "Published on the home page.");
  };

  const remove = async (a: Announcement) => {
    if (!confirm(`Delete "${a.title}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("announcements").delete().eq("id", a.id);
    if (error) return toast.error(error.message);
    done("Announcement deleted.");
  };

  const edit = (a: Announcement) => { setEditing(a.id); setTitle(a.title); setBody(a.body); setPublish(a.published); window.scrollTo({ top: 0, behavior: "smooth" }); };

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm">
        <h2 className="text-base font-semibold">{editing ? "Edit announcement" : "New announcement"}</h2>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className={`${field} h-10`} />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Message" rows={5} className={`${field} py-2`} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} /> Show on the home page</label>
          <div className="flex gap-2">
            {editing && <Button variant="ghost" size="sm" onClick={reset}>Cancel</Button>}
            <Button size="sm" disabled={busy} onClick={save}>{busy ? "Saving…" : editing ? "Save changes" : publish ? "Publish" : "Save draft"}</Button>
          </div>
        </div>
      </section>

      <ul className="space-y-3">
        {initial.map((a) => (
          <li key={a.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold">{a.title}</p>
                <p className="text-xs text-muted-foreground">{a.published ? `Published ${when(a.published_at)}` : "Draft, not shown"}</p>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => toggle(a)}>{a.published ? <><EyeOff className="h-4 w-4" /> Hide</> : <><Eye className="h-4 w-4" /> Publish</>}</Button>
                <Button size="sm" variant="outline" onClick={() => edit(a)} aria-label="Edit"><Pencil className="h-4 w-4" /></Button>
                <Button size="sm" variant="outline" onClick={() => remove(a)} aria-label="Delete" className="text-danger"><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
            <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{a.body}</p>
          </li>
        ))}
        {initial.length === 0 && <li className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No announcements yet.</li>}
      </ul>
    </div>
  );
}
