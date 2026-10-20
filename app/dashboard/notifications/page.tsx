import Link from "next/link";
import { revalidatePath } from "next/cache";
import { Bell } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { PageHeader, EmptyState } from "@/components/dashboard/primitives";
import { cn } from "@/lib/cn";

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data: notifs } = await supabase.from("notifications").select("*").eq("user_id", user?.id ?? "").order("created_at", { ascending: false }).limit(100);
  const unread = (notifs ?? []).filter((n: any) => !n.read).length;

  async function markAllRead() {
    "use server";
    const s = await createClient();
    const { data: { user: u } } = await s.auth.getUser();
    if (u) await s.from("notifications").update({ read: true }).eq("user_id", u.id).eq("read", false);
    revalidatePath("/dashboard/notifications");
    revalidatePath("/dashboard");
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <PageHeader title="Notifications" description={unread ? `${unread} unread` : "You're all caught up."}
        actions={unread ? <form action={markAllRead}><Button type="submit" variant="outline" size="sm">Mark all as read</Button></form> : undefined} />
      {(notifs ?? []).length === 0 ? <EmptyState>No notifications yet.</EmptyState> : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          {(notifs ?? []).map((n: any) => {
            const inner = (
              <div className="flex gap-3 px-5 py-4">
                <span className={cn("mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full", n.read ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary")}><Bell className="h-4 w-4" /></span>
                <div className="min-w-0">
                  <p className={cn("text-sm leading-snug", !n.read && "font-semibold")}>{n.title}</p>
                  {n.body && <p className="mt-0.5 line-clamp-3 whitespace-pre-line text-sm text-muted-foreground">{n.body}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</p>
                </div>
              </div>
            );
            return <li key={n.id}>{n.link ? <Link href={n.link} className="block hover:bg-muted/60">{inner}</Link> : inner}</li>;
          })}
        </ul>
      )}
    </div>
  );
}
