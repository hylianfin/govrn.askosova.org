import type { Role } from "@/lib/types";

export const ALL_ROLES: Role[] = ["student", "executive_member", "volunteer", "admin"];

export const ROLE_INFO: Record<Role, { label: string; description: string; variant: "secondary" | "success" | "warning" | "info" | "default" }> = {
  student: { label: "Student", description: "Applies for Executive Team or Senate, manages their own profile and team.", variant: "secondary" },
  executive_member: { label: "Executive member", description: "Member of an approved executive team. Same access as a student.", variant: "success" },
  volunteer: { label: "Volunteer", description: "Sees and completes assigned volunteer tasks on election day.", variant: "warning" },
  admin: { label: "Administrator", description: "Runs the election: reviews applications and eligibility, approves campaigns, counts ballots, and manages setup, forms, timeline, users and roles.", variant: "default" },
};
