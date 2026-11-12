import type { Role } from "@/lib/types";

export type NavIcon =
  | "home" | "user" | "file" | "users" | "megaphone" | "bell" | "volunteer"
  | "check" | "vote" | "settings" | "shield" | "log" | "calendar" | "list" | "trophy" | "form" | "scale" | "building";

export interface NavItem { href: string; label: string; icon: NavIcon; group?: string }

export function studentNav(roles: Role[] = []): NavItem[] {
  return [
    { href: "/dashboard", label: "Overview", icon: "home", group: "Home" },
    { href: "/dashboard/applications", label: "Applications", icon: "file", group: "Election" },
    { href: "/dashboard/team", label: "My Team", icon: "users", group: "Election" },
    { href: "/dashboard/campaign", label: "Campaign", icon: "megaphone", group: "Election" },
    { href: "/dashboard/volunteer", label: "Volunteer Tasks", icon: "volunteer", group: "Election" },
    ...(roles.includes("volunteer") ? [{ href: "/dashboard/polling-desk", label: "Polling Desk", icon: "vote" as const, group: "Election" }] : []),
    { href: "/dashboard/notifications", label: "Notifications", icon: "bell", group: "Account" },
    { href: "/dashboard/profile", label: "Profile", icon: "user", group: "Account" },
  ];
}

export function staffNav(): NavItem[] {
  return [
    { href: "/staff", label: "Overview", icon: "home", group: "Home" },
    { href: "/staff/applications", label: "Applications", icon: "file", group: "Review" },
    { href: "/staff/applications/executive-teams", label: "Executive Teams", icon: "users", group: "Review" },
    { href: "/staff/applications/senate", label: "Senate Applicants", icon: "building", group: "Review" },
    { href: "/staff/eligibility", label: "Eligibility", icon: "scale", group: "Review" },
    { href: "/staff/campaign-approvals", label: "Campaign Approvals", icon: "check", group: "Review" },
    { href: "/staff/announcements", label: "Announcements", icon: "megaphone", group: "Operations" },
    { href: "/staff/volunteers", label: "Volunteers", icon: "volunteer", group: "Operations" },
    { href: "/staff/senate-members", label: "Senate Members", icon: "building", group: "Operations" },
    { href: "/staff/polling-desk", label: "Polling Desk", icon: "vote", group: "Election day" },
    { href: "/staff/election-results", label: "Election Results", icon: "trophy", group: "Election day" },
    { href: "/staff/ballot-history", label: "Ballot History", icon: "log", group: "Election day" },
    { href: "/staff/practice", label: "Practice (sample data)", icon: "list", group: "Election day" },
  ];
}

export function adminNav(): NavItem[] {
  return [
    { href: "/admin", label: "Overview", icon: "home", group: "Home" },
    { href: "/admin/candidates", label: "Candidates", icon: "users", group: "Election" },
    { href: "/admin/election-results", label: "Counting", icon: "trophy", group: "Election" },
    { href: "/admin/integrity", label: "Totals & signatures", icon: "scale", group: "Election" },
    { href: "/admin/ballot-history", label: "Ballot History", icon: "log", group: "Election" },
    { href: "/admin/users", label: "Users", icon: "users", group: "System" },
    { href: "/admin/audit-logs", label: "Audit Logs", icon: "log", group: "System" },
    { href: "/admin/settings", label: "Settings", icon: "settings", group: "System" },
  ];
}

export function homeForRoles(roles: Role[]) {
  if (roles.includes("admin")) return "/admin";
  return "/dashboard";
}

// Administrators use both consoles: Admin (setup) and Review (applications and election day).
export function consoleLinks(roles: Role[]) {
  const links: { href: string; label: string }[] = [];
  if (roles.includes("admin")) links.push({ href: "/admin", label: "Admin console" });
  return links;
}

export function navForRoles(roles: Role[]) {
  if (roles.includes("admin")) return { title: "Admin", nav: adminNav(), label: "Administrator" };
  if (roles.includes("volunteer")) return { title: "Volunteer", nav: studentNav(roles), label: "Volunteer" };
  return { title: "Student", nav: studentNav(), label: "Student" };
}
