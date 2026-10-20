import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PageHero } from "@/components/public/page-hero";
import { getAnnouncements } from "@/lib/queries/elections";

export default async function AnnouncementsPage() {
  const announcements = await getAnnouncements(true);
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <SiteHeader />
      <PageHero eyebrow="Campaign trail" title="News & Announcements">
        Official updates from the Election Office.
      </PageHero>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6">
        <div className="space-y-5">
          {announcements.map((a: any) => (
            <article key={a.id} className="overflow-hidden rounded-xl border-2 border-border bg-card">
              <div className="h-1.5 bg-danger" />
              <div className="p-6">
                <p className="text-xs font-bold uppercase tracking-wider text-danger">
                  {new Date(a.published_at || a.created_at).toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" })}
                </p>
                <h2 className="mt-1 font-display text-2xl font-bold uppercase text-navy">{a.title}</h2>
                <p className="mt-2 whitespace-pre-line text-sm text-foreground/80">{a.body}</p>
              </div>
            </article>
          ))}
          {announcements.length === 0 && <p className="text-sm text-muted-foreground">No announcements yet.</p>}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
