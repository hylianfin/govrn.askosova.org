import type { Role } from "@/lib/types";

export type NavIcon =
  | "home" | "user" | "file" | "users" | "megaphone" | "bell" | "volunteer"
  | "check" | "vote" | "settings" | "shield" | "log" | "calendar" | "list" | "trophy" | "form" | "scale" | "building";

export interface NavItem { href: string; label: string; icon: NavIcon; group?: string }

export function studentNav(): NavItem[] {
  return [
    { href: "/dashboard", label: "Overview", icon: "home", group: "Home" },
    { href: "/dashboard/applications", label: "Applications", icon: "file", group: "Election" },
    { href: "/dashboard/team", label: "My Team", icon: "users", group: "Election" },
    { href: "/dashboard/campaign", label: "Campaign", icon: "megaphone", group: "Election" },
    { href: "/dashboard/volunteer", label: "Volunteer Tasks", icon: "volunteer", group: "Election" },
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
    { href: "/staff/election-results", label: "Election Results", icon: "trophy", group: "Operations" },
  ];
}

export function adminNav(): NavItem[] {
  return [
    { href: "/admin", label: "Overview", icon: "home", group: "Home" },
    { href: "/admin/elections", label: "Elections", icon: "vote", group: "Election setup" },
    { href: "/admin/timeline", label: "Timeline", icon: "calendar", group: "Election setup" },
    { href: "/admin/eligibility-rules", label: "Eligibility Rules", icon: "scale", group: "Election setup" },
    { href: "/admin/forms", label: "Forms", icon: "form", group: "Election setup" },
    { href: "/admin/forms/executive-team", label: "Executive Form", icon: "list", group: "Election setup" },
    { href: "/admin/forms/senate", label: "Senate Form", icon: "list", group: "Election setup" },
    { href: "/admin/forms/import", label: "Import Responses", icon: "file", group: "Election setup" },
    { href: "/admin/users", label: "Users", icon: "users", group: "People & access" },
    { href: "/admin/roles", label: "Roles", icon: "shield", group: "People & access" },
    { href: "/admin/audit-logs", label: "Audit Logs", icon: "log", group: "System" },
    { href: "/admin/settings", label: "Settings", icon: "settings", group: "System" },
  ];
}

export function homeForRoles(roles: Role[]) {
  if (roles.includes("admin")) return "/admin";
  if (roles.includes("staff_reviewer")) return "/staff";
  return "/dashboard";
}

// Admins use the admin and staff consoles, staff use the staff console; the student dashboard is for students only.
export function consoleLinks(roles: Role[]) {
  const links: { href: string; label: string }[] = [];
  if (roles.includes("admin")) links.push({ href: "/admin", label: "Admin console" });
  if (roles.includes("admin") || roles.includes("staff_reviewer")) links.push({ href: "/staff", label: "Staff console" });
  return links;
}

export function navForRoles(roles: Role[]) {
  if (roles.includes("admin")) return { title: "Admin", nav: adminNav(), label: "Administrator" };
  if (roles.includes("staff_reviewer")) return { title: "Staff", nav: staffNav(), label: "Staff Reviewer" };
  if (roles.includes("volunteer")) return { title: "Volunteer", nav: studentNav(), label: "Volunteer" };
  return { title: "Student", nav: studentNav(), label: "Student" };
}
