import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getAnnouncements } from "@/lib/queries/elections";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default async function AnnouncementsPage() {
  const announcements = await getAnnouncements(true);
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto max-w-4xl flex-1 px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-bold text-primary">Announcements</h1>
        <div className="mt-8 space-y-4">
          {announcements.map((a: any) => (
            <Card key={a.id}>
              <CardHeader>
                <CardTitle>{a.title}</CardTitle>
                <CardDescription>{new Date(a.published_at || a.created_at).toLocaleString()}</CardDescription>
              </CardHeader>
              <CardContent><p className="text-sm">{a.body}</p></CardContent>
            </Card>
          ))}
          {announcements.length === 0 && <p className="text-sm text-muted-foreground">No announcements.</p>}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}