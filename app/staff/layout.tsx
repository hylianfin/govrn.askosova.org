import { redirect } from "next/navigation";
import { getCurrentUser, isStaff } from "@/lib/auth/session";
import { DashboardShell } from "@/components/dashboard-shell";
import { staffNav, consoleLinks, homeForRoles } from "@/lib/nav";
import { ROLE_LABELS } from "@/lib/types";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (!isStaff(user.roles)) redirect(homeForRoles(user.roles));
  return (
    <DashboardShell
      title="Staff"
      nav={staffNav()}
      userName={user.profile?.full_name || user.email}
      userEmail={user.email}
      roleLabel={ROLE_LABELS.staff_reviewer}
      switchLinks={consoleLinks(user.roles)}
    >
      {children}
    </DashboardShell>
  );
}
