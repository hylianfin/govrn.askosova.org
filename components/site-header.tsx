import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const nav = [
  { href: "/", label: "Home" },
  { href: "/executive-team", label: "Executive Team" },
  { href: "/senate", label: "Student Senate" },
  { href: "/election-timeline", label: "Election Timeline" },
  { href: "/announcements", label: "Announcements" },
];

export function SiteHeader({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-3">
          <Image
            src="/images/logo-mark.png"
            alt="ASK"
            width={36}
            height={36}
            className="h-9 w-9 rounded-md"
            priority
          />
          <div className="hidden flex-col leading-tight sm:flex">
            <span className="text-sm font-semibold text-primary">ASK Student Government</span>
            <span className="text-xs text-muted-foreground">Elections Platform</span>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {signedIn ? (
            <Button asChild variant="default" size="sm">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/sign-in">Sign In</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/sign-up">Apply Now</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}