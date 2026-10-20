import { redirect } from "next/navigation";
import { getCurrentUser, isAdmin } from "@/lib/auth/session";
import { DashboardShell } from "@/components/dashboard-shell";
import { adminNav, consoleLinks, homeForRoles } from "@/lib/nav";
import { ROLE_LABELS } from "@/lib/types";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (!isAdmin(user.roles)) redirect(homeForRoles(user.roles));
  return (
    <DashboardShell
      title="Admin"
      nav={adminNav()}
      userName={user.profile?.full_name || user.email}
      userEmail={user.email}
      roleLabel={ROLE_LABELS.admin}
      switchLinks={consoleLinks(user.roles)}
    >
      {children}
    </DashboardShell>
  );
}
