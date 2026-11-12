"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export const publicNav = [
  { href: "/", label: "Candidates" },
];

export function NavLinks({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  return (
    <nav className={cn(mobile ? "flex gap-1 overflow-x-auto px-4 py-2 md:hidden" : "hidden items-center gap-1 md:flex")}>
      {publicNav.map((n) => {
        const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-md px-3 py-2 font-display text-sm font-medium uppercase tracking-wider transition-colors",
              active ? "bg-primary text-white" : "text-navy/70 hover:bg-muted hover:text-navy",
            )}
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
