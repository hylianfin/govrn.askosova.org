import { redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { consoleLinks, governmentNav, homeForRoles } from "@/lib/nav";
import { getGovAccess, governmentReady } from "@/lib/queries/government";
import { OFFICE_LABEL } from "@/lib/government";
import { ROLE_LABELS } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function GovernmentLayout({ children }: { children: React.ReactNode }) {
  const access = await getGovAccess();
  if (!access) redirect("/sign-in");
  // Only people in government and administrators belong here.
  if (!access.canSee) redirect(homeForRoles(access.user.roles));
  const ready = await governmentReady();
  const { user, admin, seat } = access;

  return (
    <DashboardShell
      title="Government"
      nav={governmentNav()}
      userName={user.profile?.full_name || user.email}
      userEmail={user.email}
      roleLabel={seat ? OFFICE_LABEL[seat.office] : admin ? ROLE_LABELS.admin : undefined}
      switchLinks={admin ? consoleLinks(user.roles) : [{ href: "/dashboard", label: "Student dashboard" }]}
    >
      {!ready && (
        <div role="alert" className="mb-6 flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p>
            Student government is not set up in the database yet. Apply <code className="rounded bg-muted px-1 py-0.5 text-xs">0034_student_government.sql</code> and
            reload this page.
          </p>
        </div>
      )}
      {children}
    </DashboardShell>
  );
}
