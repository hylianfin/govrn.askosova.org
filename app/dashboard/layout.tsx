import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { DashboardShell } from "@/components/dashboard-shell";
import { studentNav, homeForRoles } from "@/lib/nav";
import { ROLE_LABELS } from "@/lib/types";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const home = homeForRoles(user.roles);
  if (home !== "/dashboard") redirect(home);
  const name = user.profile?.full_name || user.email;
  return (
    <DashboardShell
      title="Student"
      nav={studentNav()}
      userName={name}
      userEmail={user.email}
      roleLabel={user.roles.includes("executive_member") ? ROLE_LABELS.executive_member : ROLE_LABELS.student}
    >
      {children}
    </DashboardShell>
  );
}
