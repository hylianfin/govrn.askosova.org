"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, User, FileText, Users, Megaphone, Bell, HandHelping, ClipboardCheck, Vote,
  Settings, ShieldCheck, ScrollText, CalendarDays, ListChecks, Trophy, LogOut, Menu, X, Scale, Building2, ClipboardList,
  ArrowLeftRight,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { NavItem, NavIcon } from "@/lib/nav";

const ICONS: Record<NavIcon, React.ComponentType<{ className?: string }>> = {
  home: LayoutDashboard, user: User, file: FileText, users: Users, megaphone: Megaphone, bell: Bell,
  volunteer: HandHelping, check: ClipboardCheck, vote: Vote, settings: Settings, shield: ShieldCheck,
  log: ScrollText, calendar: CalendarDays, list: ListChecks, trophy: Trophy, form: ClipboardList,
  scale: Scale, building: Building2,
};

function initials(name: string) {
  return name.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("") || "?";
}

function isActive(pathname: string, href: string, all: string[]) {
  if (pathname === href) return true;
  if (!pathname.startsWith(href + "/")) return false;
  // Most specific match wins, so "/admin/forms" is not active on "/admin/forms/senate".
  return !all.some((o) => o !== href && o.length > href.length && (pathname === o || pathname.startsWith(o + "/")));
}

export function DashboardShell({
  title,
  nav,
  children,
  roleLabel,
  userName,
  userEmail,
  switchLinks = [],
}: {
  title: string;
  nav: NavItem[];
  children: React.ReactNode;
  roleLabel?: string;
  userName: string;
  userEmail?: string;
  switchLinks?: { href: string; label: string }[];
}) {
  const pathname = usePathname();
  // Drawer is open only for the path it was opened on, so navigating closes it.
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === pathname;
  const setOpen = (v: boolean) => setOpenPath(v ? pathname : null);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const hrefs = nav.map((n) => n.href);
  const groups: { name: string; items: NavItem[] }[] = [];
  for (const item of nav) {
    const name = item.group ?? "";
    const g = groups.find((x) => x.name === name);
    if (g) g.items.push(item); else groups.push({ name, items: [item] });
  }
  const current = nav.find((n) => isActive(pathname, n.href, hrefs));
  const others = switchLinks.filter((l) => !(pathname === l.href || pathname.startsWith(l.href + "/")));

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-5">
        <Image src="/images/logo-mark.png" alt="ASK" width={32} height={32} className="h-8 w-8" />
        <div className="leading-tight">
          <p className="text-sm font-semibold text-foreground">ASK Elections</p>
          <p className="text-xs text-muted-foreground">{title} console</p>
        </div>
      </div>

      <nav aria-label={`${title} navigation`} className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {groups.map((g) => (
          <div key={g.name}>
            {g.name && g.name !== "Home" && (
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">{g.name}</p>
            )}
            <ul className="space-y-0.5">
              {g.items.map((n) => {
                const active = isActive(pathname, n.href, hrefs);
                const Icon = ICONS[n.icon];
                return (
                  <li key={n.href}>
                    <Link
                      href={n.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <Icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                      <span className="truncate">{n.label}</span>
                      {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 space-y-2 border-t border-border p-3">
        {others.length > 0 && (
          <div>
            <p className="mb-1 flex items-center gap-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
              <ArrowLeftRight className="h-3 w-3" /> Switch to
            </p>
            {others.map((l) => (
              <Link key={l.href} href={l.href} className="block rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
                {l.label}
              </Link>
            ))}
          </div>
        )}
        <form action="/auth/signout" method="post">
          <button type="submit" className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border bg-card lg:block">{sidebar}</aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button aria-label="Close navigation" className="absolute inset-0 bg-foreground/40 backdrop-blur-[1px]" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-card shadow-xl animate-fade-in">
            <button aria-label="Close navigation" onClick={() => setOpen(false)} className="absolute right-3 top-4 rounded-md p-1.5 text-muted-foreground hover:bg-muted">
              <X className="h-5 w-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-card/85 px-4 backdrop-blur md:px-8">
          <button aria-label="Open navigation" onClick={() => setOpen(true)} className="-ml-1 rounded-md p-2 text-muted-foreground hover:bg-muted lg:hidden">
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{current?.label ?? title}</p>
            <p className="hidden truncate text-xs text-muted-foreground sm:block">{title} console</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right leading-tight sm:block">
              <p className="max-w-[14rem] truncate text-sm font-medium">{userName}</p>
              <p className="text-xs text-muted-foreground">{roleLabel}</p>
            </div>
            <div title={userEmail} className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {initials(userName)}
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
