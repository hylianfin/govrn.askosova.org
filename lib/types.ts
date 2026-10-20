export type Role = "student" | "executive_member" | "staff_reviewer" | "volunteer" | "admin";

export type ApplicationStatus =
  | "not_started"
  | "draft"
  | "awaiting_team_members"
  | "ready_to_submit"
  | "submitted"
  | "under_review"
  | "changes_requested"
  | "approved"
  | "rejected"
  | "withdrawn";

export type CampaignMaterialStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "changes_requested"
  | "approved"
  | "rejected";

export type ElectionStage =
  | "applications_not_open"
  | "applications_open"
  | "eligibility_review"
  | "campaign_preparation"
  | "official_campaign"
  | "debate_qa"
  | "election_silence"
  | "election_day"
  | "results_published"
  | "election_completed";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  grade_level: number | null;
  homeroom: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  user_id: string;
  role: Role;
}

export interface Election {
  id: string;
  academic_year: string;
  title: string;
  timezone: string;
  current_stage: ElectionStage;
  created_at: string;
}

export interface FormQuestion {
  id: string;
  form_id: string;
  version_id: string;
  scope: "team" | "individual" | "applicant";
  label: string;
  description: string | null;
  type:
    | "short_text"
    | "long_text"
    | "email"
    | "number"
    | "dropdown"
    | "single_choice"
    | "multiple_choice"
    | "checkbox"
    | "date"
    | "file_upload";
  required: boolean;
  options: string[] | null;
  order_index: number;
}

export const ROLE_LABELS: Record<Role, string> = {
  student: "Student",
  executive_member: "Executive Team Member",
  staff_reviewer: "Staff Reviewer",
  volunteer: "Volunteer",
  admin: "Administrator",
};

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  not_started: "Not Started",
  draft: "Draft",
  awaiting_team_members: "Awaiting Team Members",
  ready_to_submit: "Ready to Submit",
  submitted: "Submitted",
  under_review: "Under Review",
  changes_requested: "Changes Requested",
  approved: "Approved",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

export const STAGE_LABELS: Record<ElectionStage, string> = {
  applications_not_open: "Applications Not Open",
  applications_open: "Applications Open",
  eligibility_review: "Eligibility Review",
  campaign_preparation: "Campaign Preparation",
  official_campaign: "Official Campaign",
  debate_qa: "Debate and Q&A",
  election_silence: "Election Silence",
  election_day: "Election Day",
  results_published: "Results Published",
  election_completed: "Election Completed",
};