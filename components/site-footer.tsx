import Link from "next/link";
import { getConfig } from "@/lib/config-server";

const columns = [
  { title: "The Race", links: [{ href: "/executive-team", label: "Executive Team" }, { href: "/senate", label: "Student Senate" }, { href: "/election-timeline", label: "Election Timeline" }, { href: "/announcements", label: "News" }] },
  { title: "Get Involved", links: [{ href: "/dashboard/applications/executive-team", label: "Executive Application" }, { href: "/dashboard/applications/senate", label: "Senate Application" }, { href: "/dashboard/campaign", label: "Campaign" }, { href: "/dashboard/volunteer", label: "Volunteer" }] },
  { title: "Account", links: [{ href: "/sign-in", label: "Sign In" }, { href: "/sign-up", label: "Create Account" }, { href: "/dashboard/notifications", label: "Notifications" }, { href: "/dashboard/profile", label: "Profile" }] },
];

export async function SiteFooter() {
  const c = await getConfig();
  return (
    <footer className="bg-navy text-white">
      <div className="ribbon" />
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 md:grid-cols-5">
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.logoUrl} alt={c.siteName} width={44} height={44} className="h-11 w-11 rounded-full object-contain" />
              <div className="leading-none">
                <span className="block font-display text-xl font-bold uppercase tracking-wide">{c.siteName}</span>
                <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.2em] text-white/60">{c.tagline} Elections</span>
              </div>
            </Link>
            <p className="mt-4 max-w-sm text-sm text-white/70">
              Applications, eligibility, campaigns and results for the {c.organizationName} {c.tagline.toLowerCase() || "election"}.
            </p>
          </div>
          {columns.map((c) => (
            <div key={c.title}>
              <h3 className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-white/50">{c.title}</h3>
              <ul className="mt-4 space-y-2">
                {c.links.map((l) => (
                  <li key={l.label}><Link href={l.href} className="text-sm text-white/80 hover:text-white">{l.label}</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col justify-between gap-3 border-t border-white/15 pt-6 text-xs text-white/50 sm:flex-row">
          <p>© {new Date().getFullYear()} {c.organizationName}. All rights reserved.</p>
          <p>Internal school platform — not a public political election website.</p>
        </div>
      </div>
    </footer>
  );
}
