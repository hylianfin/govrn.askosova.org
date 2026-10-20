"use client";

import { useMemo, useState, useTransition } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { ALL_ROLES, ROLE_INFO } from "@/lib/roles";
import { setUserRole } from "@/lib/actions/roles";
import type { Role } from "@/lib/types";

export type UserRow = {
  id: string; name: string; email: string; grade: number | null; homeroom: string | null; joined: string; roles: Role[];
};

function initials(s: string) {
  return s.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("") || "?";
}

export function UserList({ users: initial, editable, currentUserId }: { users: UserRow[]; editable: boolean; currentUserId: string }) {
  const [users, setUsers] = useState(initial);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Role | "all">("all");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [, startTransition] = useTransition();

  const counts = useMemo(() => {
    const c = Object.fromEntries(ALL_ROLES.map((r) => [r, 0])) as Record<Role, number>;
    users.forEach((u) => u.roles.forEach((r) => { c[r]++; }));
    return c;
  }, [users]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => (filter === "all" || u.roles.includes(filter)) && (!q || `${u.name} ${u.email}`.toLowerCase().includes(q)));
  }, [users, query, filter]);

  function toggle(u: UserRow, role: Role) {
    const has = u.roles.includes(role);
    if (role === "admin" && !has && !confirm(`Make ${u.name} an administrator? Admins can change every setting and every user's roles.`)) return;
    if (role === "admin" && has && !confirm(`Remove administrator access from ${u.name}?`)) return;
    const apply = (on: boolean) => setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, roles: on ? [...x.roles, role] : x.roles.filter((r) => r !== role) } : x)));
    apply(!has);
    setErrors((p) => ({ ...p, [u.id]: "" }));
    startTransition(async () => {
      const res = await setUserRole(u.id, role, !has);
      if (!res.ok) { apply(has); setErrors((p) => ({ ...p, [u.id]: res.error })); }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input type="search" aria-label="Search users" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or email"
            className="h-10 w-full rounded-md border border-border bg-card pl-9 pr-9 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
          {query && <button aria-label="Clear search" onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by role">
        {(["all", ...ALL_ROLES] as const).map((r) => {
          const n = r === "all" ? users.length : counts[r];
          const on = filter === r;
          return (
            <button key={r} type="button" aria-pressed={on} onClick={() => setFilter(r)}
              className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-muted")}>
              {r === "all" ? "Everyone" : ROLE_INFO[r].label} <span className="opacity-70">{n}</span>
            </button>
          );
        })}
      </div>

      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {shown.map((u) => (
          <li key={u.id} className="space-y-3 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{initials(u.name)}</div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{u.name}{u.id === currentUserId && <span className="ml-2 text-xs font-normal text-muted-foreground">(you)</span>}</p>
                <p className="truncate text-sm text-muted-foreground">{u.email}</p>
                <p className="text-xs text-muted-foreground">
                  {u.grade ? `Grade ${u.grade}` : "Grade not set"}{u.homeroom ? ` · ${u.homeroom}` : ""} · Joined {new Date(u.joined).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>
              {!editable && (
                <div className="flex max-w-[50%] flex-wrap justify-end gap-1">
                  {u.roles.map((r) => <Badge key={r} variant={ROLE_INFO[r].variant}>{ROLE_INFO[r].label}</Badge>)}
                  {u.roles.length === 0 && <Badge variant="outline">No role</Badge>}
                </div>
              )}
            </div>
            {editable && (
              <div className="flex flex-wrap gap-1.5 sm:pl-[3.25rem]" role="group" aria-label={`Roles for ${u.name}`}>
                {ALL_ROLES.map((r) => {
                  const on = u.roles.includes(r);
                  return (
                    <button key={r} type="button" aria-pressed={on} title={ROLE_INFO[r].description} onClick={() => toggle(u, r)}
                      className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                        on ? "border-primary bg-primary/10 text-primary" : "border-dashed border-border text-muted-foreground hover:border-primary/50 hover:text-foreground")}>
                      {on ? "✓ " : "+ "}{ROLE_INFO[r].label}
                    </button>
                  );
                })}
              </div>
            )}
            {errors[u.id] && <p role="alert" className="text-sm text-danger sm:pl-[3.25rem]">{errors[u.id]}</p>}
          </li>
        ))}
        {shown.length === 0 && <li className="p-8 text-center text-sm text-muted-foreground">No users match.</li>}
      </ul>
      <p className="text-xs text-muted-foreground">Showing {shown.length} of {users.length}</p>
    </div>
  );
}
