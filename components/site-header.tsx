import Link from "next/link";
import { Button } from "@/components/ui/button";
import { NavLinks } from "@/components/public/nav-links";
import { getConfig } from "@/lib/config-server";

export async function SiteHeader({ signedIn = false }: { signedIn?: boolean }) {
  const c = await getConfig();
  return (
    <header className="sticky top-0 z-50 w-full bg-card shadow-sm">
      <div className="bg-navy text-white">
        <div className="mx-auto flex h-8 max-w-7xl items-center justify-between px-4 text-[11px] font-medium uppercase tracking-[0.18em] sm:px-6">
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-danger animate-pulse-ring" />
            Student Government Elections
          </span>
          <span className="hidden text-white/60 sm:inline">{c.organizationName}</span>
        </div>
      </div>
      <div className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.logoUrl} alt={c.siteName} width={40} height={40} className="h-10 w-10 rounded-full object-contain" />
            <div className="flex flex-col leading-none">
              <span className="font-display text-lg font-bold uppercase tracking-wide text-navy">{c.siteName}</span>
              <span className="mt-0.5 hidden text-[10px] font-semibold uppercase tracking-[0.2em] text-danger sm:block">{c.tagline}</span>
            </div>
          </Link>
          <NavLinks />
          <div className="flex items-center gap-2">
            {signedIn ? (
              <Button asChild size="sm"><Link href="/dashboard">Dashboard</Link></Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex"><Link href="/sign-in">Sign In</Link></Button>
                <Button asChild size="sm" className="bg-danger font-display uppercase tracking-wider hover:bg-danger/90">
                  <Link href="/sign-up">Run for Office</Link>
                </Button>
              </>
            )}
          </div>
        </div>
        <NavLinks mobile />
      </div>
      <div className="ribbon" />
    </header>
  );
}
