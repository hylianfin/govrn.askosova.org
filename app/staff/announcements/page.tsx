import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export default async function StaffAnnouncementsPage() {
  const supabase = await createClient();
  const { data: anns } = await supabase.from("announcements").select("*").order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-primary">Announcements</h1>
      <Card>
        <CardHeader><CardTitle>Create announcement</CardTitle></CardHeader>
        <CardContent>
          <form action={async (fd: FormData) => {
            "use server";
            const s = await createClient();
            const { data: { user } } = await s.auth.getUser();
            await s.from("announcements").insert({
              title: fd.get("title"),
              body: fd.get("body"),
              published: fd.get("published") === "on",
              published_at: fd.get("published") === "on" ? new Date().toISOString() : null,
              author_id: user?.id,
            });
          }} className="space-y-3">
            <div className="space-y-2"><Label>Title</Label><Input name="title" required /></div>
            <div className="space-y-2"><Label>Body</Label><Textarea name="body" required /></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="published" /> Publish now</label>
            <Button type="submit">Create</Button>
          </form>
        </CardContent>
      </Card>
      <div className="space-y-3">
        {(anns ?? []).map((a: any) => (
          <Card key={a.id}>
            <CardHeader><CardTitle className="text-base">{a.title}</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-muted-foreground">{a.body}</p></CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}