import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/dashboard/primitives";
import { AnnouncementManager, type Announcement } from "@/components/admin/announcement-manager";

export const dynamic = "force-dynamic";

export default async function AdminAnnouncementsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("announcements").select("id, title, body, published, published_at, created_at").order("published_at", { ascending: false, nullsFirst: true }).order("created_at", { ascending: false });
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Election" title="Announcements" description="Notices shown at the top of the public home page, newest first. Use them for corrections, schedule changes and other news." />
      <AnnouncementManager initial={(data ?? []) as Announcement[]} />
    </div>
  );
}
