import { getCurrentUser } from "@/lib/auth/session";
import { getUserRows } from "@/lib/queries/users";
import { PageHeader, Section } from "@/components/dashboard/primitives";
import { Badge } from "@/components/ui/badge";
import { UserList } from "@/components/admin/user-list";
import { ALL_ROLES, ROLE_INFO } from "@/lib/roles";

export default async function AdminRolesPage() {
  const [me, users] = await Promise.all([getCurrentUser(), getUserRows()]);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="People & access" title="Roles & permissions" description="Click a role to give or take it away. Changes apply the next time that person loads a page and are recorded in the audit log." />

      <Section title="What each role can do">
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[...ALL_ROLES].reverse().map((r) => (
            <li key={r} className="space-y-1.5 rounded-lg border border-border p-3">
              <Badge variant={ROLE_INFO[r].variant}>{ROLE_INFO[r].label}</Badge>
              <p className="text-sm text-muted-foreground">{ROLE_INFO[r].description}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">Admins get the admin and staff consoles, staff get the staff console, everyone else uses the student dashboard.</p>
      </Section>

      <UserList users={users} editable currentUserId={me?.id ?? ""} />
    </div>
  );
}
