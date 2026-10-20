import Link from "next/link";
import { Users, GraduationCap, ClipboardCheck, ShieldCheck } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserRows } from "@/lib/queries/users";
import { PageHeader, StatTile } from "@/components/dashboard/primitives";
import { UserList } from "@/components/admin/user-list";
import { Button } from "@/components/ui/button";

export default async function AdminUsersPage() {
  const [me, users] = await Promise.all([getCurrentUser(), getUserRows()]);
  const has = (r: string) => users.filter((u) => u.roles.includes(r as never)).length;
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="People & access" title="Users" description="Everyone who has signed up. To change what someone can do, use Roles."
        actions={<Button asChild variant="outline"><Link href="/admin/roles">Manage roles</Link></Button>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Total users" value={users.length} icon={<Users className="h-5 w-5" />} />
        <StatTile label="Students" value={has("student")} icon={<GraduationCap className="h-5 w-5" />} />
        <StatTile label="Staff reviewers" value={has("staff_reviewer")} icon={<ClipboardCheck className="h-5 w-5" />} />
        <StatTile label="Administrators" value={has("admin")} icon={<ShieldCheck className="h-5 w-5" />} />
      </div>
      <UserList users={users} editable={false} currentUserId={me?.id ?? ""} />
    </div>
  );
}
