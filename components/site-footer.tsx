import Link from "next/link";
import Image from "next/image";

const columns = [
  { title: "Navigation", links: [{ href: "/", label: "Home" }, { href: "/executive-team", label: "Executive Team" }, { href: "/senate", label: "Student Senate" }, { href: "/election-timeline", label: "Election Timeline" }, { href: "/announcements", label: "Announcements" }] },
  { title: "Program", links: [{ href: "/dashboard/applications/executive-team", label: "Executive Application" }, { href: "/dashboard/applications/senate", label: "Senate Application" }, { href: "/dashboard/campaign", label: "Campaign" }, { href: "/dashboard/volunteer", label: "Volunteer" }] },
  { title: "About", links: [{ href: "/executive-team", label: "Eligibility" }, { href: "/senate", label: "Senate Eligibility" }, { href: "/election-timeline", label: "Election Process" }, { href: "/sign-in", label: "Sign In" }] },
  { title: "Resources", links: [{ href: "/announcements", label: "Announcements" }, { href: "/election-timeline", label: "Timeline" }, { href: "/dashboard/notifications", label: "Notifications" }, { href: "/dashboard/profile", label: "Profile" }] },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 md:grid-cols-5">
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center gap-3">
              <Image src="/images/logo-mark.png" alt="ASK" width={40} height={40} className="h-10 w-10" />
              <div className="leading-tight">
                <span className="block text-sm font-semibold text-primary">ASK Student Government</span>
                <span className="block text-xs text-muted-foreground">Elections Platform</span>
              </div>
            </Link>
            <p className="mt-4 max-w-sm text-sm text-muted-foreground">
              An internal platform for managing the ASK Student Government and Student Senate process — applications, eligibility, campaigns, and election results.
            </p>
          </div>
          {columns.map((c) => (
            <div key={c.title}>
              <h3 className="text-sm font-semibold text-primary">{c.title}</h3>
              <ul className="mt-4 space-y-2">
                {c.links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="text-sm text-muted-foreground hover:text-foreground">{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-border pt-6 sm:flex-row sm:items-center">
          <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} American School of Kosovo. All rights reserved.</p>
          <p className="text-sm text-muted-foreground">Internal school platform — not a public political election website.</p>
        </div>
      </div>
    </footer>
  );
}