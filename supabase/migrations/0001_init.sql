-- ASK Student Government & Elections Platform
-- Initial schema

create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  grade_level int,
  homeroom text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('student','executive_member','staff_reviewer','volunteer','admin')),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

-- Academic years
create table if not exists public.academic_years (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  start_date date not null,
  end_date date not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now()
);

-- Elections
create table if not exists public.elections (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid references public.academic_years(id),
  title text not null,
  timezone text not null default 'Europe/Berlin',
  current_stage text not null default 'applications_not_open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.election_events (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.elections(id) on delete cascade,
  title text not null,
  description text,
  location text,
  instructions text,
  start_at timestamptz,
  end_at timestamptz,
  public boolean not null default true,
  order_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Application forms
create table if not exists public.application_forms (
  id uuid primary key default gen_random_uuid(),
  election_id uuid references public.elections(id),
  kind text not null check (kind in ('executive_team','senate')),
  title text not null,
  description text,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.application_form_versions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.application_forms(id) on delete cascade,
  version_number int not null,
  opens_at timestamptz,
  closes_at timestamptz,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (form_id, version_number)
);

create table if not exists public.application_questions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.application_forms(id) on delete cascade,
  version_id uuid not null references public.application_form_versions(id) on delete cascade,
  scope text not null check (scope in ('team','individual','applicant')),
  label text not null,
  description text,
  type text not null check (type in ('short_text','long_text','email','number','dropdown','single_choice','multiple_choice','checkbox','date','file_upload')),
  required boolean not null default false,
  options jsonb,
  validation jsonb,
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.application_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.application_questions(id) on delete cascade,
  label text not null,
  value text not null,
  order_index int not null default 0
);

-- Applications
create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.application_forms(id),
  form_version_id uuid not null references public.application_form_versions(id),
  applicant_id uuid references auth.users(id),
  executive_team_id uuid,
  kind text not null check (kind in ('executive_team','senate')),
  status text not null default 'draft' check (status in ('not_started','draft','awaiting_team_members','ready_to_submit','submitted','under_review','changes_requested','approved','rejected','withdrawn')),
  submitted_at timestamptz,
  submitted_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.application_answers (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  question_id uuid not null references public.application_questions(id),
  respondent_id uuid references auth.users(id),
  value jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (application_id, question_id, respondent_id)
);

-- Executive teams
create table if not exists public.executive_teams (
  id uuid primary key default gen_random_uuid(),
  election_id uuid references public.elections(id),
  application_id uuid references public.applications(id),
  name text not null,
  slogan text,
  grade_levels jsonb,
  introduction text,
  logo_url text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.executive_team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.executive_teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  position text not null check (position in ('president','vice_president','secretary','treasurer')),
  accepted boolean not null default false,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (team_id, position),
  unique (team_id, user_id)
);

create table if not exists public.team_invitations (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.executive_teams(id) on delete cascade,
  email text not null,
  position text not null check (position in ('president','vice_president','secretary','treasurer')),
  token text not null unique,
  invited_by uuid references auth.users(id),
  accepted_by uuid references auth.users(id),
  accepted_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.applications
  add constraint applications_executive_team_fk foreign key (executive_team_id) references public.executive_teams(id);

-- Eligibility
create table if not exists public.eligibility_rules (
  id uuid primary key default gen_random_uuid(),
  election_id uuid references public.elections(id),
  scope text not null check (scope in ('executive','senate')),
  key text not null,
  label text not null,
  description text,
  rule_type text not null check (rule_type in ('team_size','positions','grade_levels','min_gpa','behavior','documents','acknowledgments','attendance','community_service','suspensions','detentions')),
  config jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  is_conflicting boolean not null default false,
  conflict_group text,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.eligibility_checks (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references public.applications(id) on delete cascade,
  team_id uuid references public.executive_teams(id) on delete cascade,
  user_id uuid references auth.users(id),
  rule_id uuid not null references public.eligibility_rules(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','verified','failed','requires_review')),
  verified_by uuid references auth.users(id),
  verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Reviews
create table if not exists public.application_reviews (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  reviewer_id uuid references auth.users(id),
  decision text check (decision in ('approved','rejected','changes_requested','pending')),
  reason text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.review_notes (
  id uuid primary key default gen_random_uuid(),
  review_id uuid references public.application_reviews(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  author_id uuid references auth.users(id),
  note text not null,
  internal boolean not null default true,
  created_at timestamptz not null default now()
);

-- Campaign
create table if not exists public.campaign_materials (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.executive_teams(id) on delete cascade,
  application_id uuid references public.applications(id),
  slogan text,
  platform text,
  goals text,
  poster_url text,
  video_url text,
  speech_notes text,
  debate_notes text,
  status text not null default 'draft' check (status in ('draft','submitted','under_review','changes_requested','approved','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campaign_material_reviews (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.campaign_materials(id) on delete cascade,
  reviewer_id uuid references auth.users(id),
  decision text check (decision in ('approved','rejected','changes_requested')),
  reason text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

-- Announcements
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  published boolean not null default false,
  published_at timestamptz,
  author_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Notifications
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- Volunteers
create table if not exists public.volunteer_tasks (
  id uuid primary key default gen_random_uuid(),
  election_id uuid references public.elections(id),
  title text not null,
  description text,
  instructions text,
  due_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.volunteer_assignments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.volunteer_tasks(id) on delete cascade,
  volunteer_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'assigned' check (status in ('assigned','in_progress','completed')),
  supervisor_id uuid references auth.users(id),
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.volunteer_hours (
  id uuid primary key default gen_random_uuid(),
  volunteer_id uuid not null references auth.users(id) on delete cascade,
  hours numeric not null,
  description text,
  recorded_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- Senate
create table if not exists public.senate_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  academic_year_id uuid references public.academic_years(id),
  grade_level int,
  elected boolean not null default false,
  appointed boolean not null default false,
  workshop_attended boolean not null default false,
  community_service_hours numeric not null default 0,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists public.class_election_results (
  id uuid primary key default gen_random_uuid(),
  election_id uuid references public.elections(id),
  grade_level int not null,
  candidate_id uuid references auth.users(id),
  votes int not null default 0,
  elected boolean not null default false,
  created_at timestamptz not null default now()
);

-- Election results (paper ballots)
create table if not exists public.official_election_results (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.elections(id),
  team_id uuid not null references public.executive_teams(id),
  ballot_count int not null default 0,
  invalid_ballots int not null default 0,
  blank_ballots int not null default 0,
  entered_by uuid references auth.users(id),
  entered_at timestamptz,
  verified_by uuid references auth.users(id),
  verified_at timestamptz,
  published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.result_verifications (
  id uuid primary key default gen_random_uuid(),
  result_id uuid not null references public.official_election_results(id) on delete cascade,
  verifier_id uuid not null references auth.users(id),
  verified_at timestamptz not null default now(),
  notes text
);

-- Audit logs
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_applications_applicant on public.applications(applicant_id);
create index if not exists idx_applications_team on public.applications(executive_team_id);
create index if not exists idx_answers_application on public.application_answers(application_id);
create index if not exists idx_notifications_user on public.notifications(user_id, read);
create index if not exists idx_audit_created on public.audit_logs(created_at desc);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

do $$ begin
  create trigger profiles_upd before update on public.profiles for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

-- RLS
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.academic_years enable row level security;
alter table public.elections enable row level security;
alter table public.election_events enable row level security;
alter table public.application_forms enable row level security;
alter table public.application_form_versions enable row level security;
alter table public.application_questions enable row level security;
alter table public.application_options enable row level security;
alter table public.applications enable row level security;
alter table public.application_answers enable row level security;
alter table public.executive_teams enable row level security;
alter table public.executive_team_members enable row level security;
alter table public.team_invitations enable row level security;
alter table public.eligibility_rules enable row level security;
alter table public.eligibility_checks enable row level security;
alter table public.application_reviews enable row level security;
alter table public.review_notes enable row level security;
alter table public.campaign_materials enable row level security;
alter table public.campaign_material_reviews enable row level security;
alter table public.announcements enable row level security;
alter table public.notifications enable row level security;
alter table public.volunteer_tasks enable row level security;
alter table public.volunteer_assignments enable row level security;
alter table public.volunteer_hours enable row level security;
alter table public.senate_memberships enable row level security;
alter table public.class_election_results enable row level security;
alter table public.official_election_results enable row level security;
alter table public.result_verifications enable row level security;
alter table public.audit_logs enable row level security;

-- Helper: is admin
create or replace function public.is_admin(uid uuid)
returns boolean language sql security definer as $$
  select exists (select 1 from public.user_roles where user_id = uid and role = 'admin');
$$;

create or replace function public.is_staff(uid uuid)
returns boolean language sql security definer as $$
  select exists (select 1 from public.user_roles where user_id = uid and role in ('admin','staff_reviewer'));
$$;

-- Profiles policies
create policy "profiles self read" on public.profiles for select using (auth.uid() = id or public.is_staff(auth.uid()));
create policy "profiles self update" on public.profiles for update using (auth.uid() = id);
create policy "profiles insert self" on public.profiles for insert with check (auth.uid() = id);

-- user_roles: only admins manage; users can read own
create policy "user_roles self read" on public.user_roles for select using (auth.uid() = user_id or public.is_admin(auth.uid()));
create policy "user_roles admin manage" on public.user_roles for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- Academic years / elections / events: public read published/current; admin write
create policy "academic_years read" on public.academic_years for select using (true);
create policy "academic_years admin" on public.academic_years for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create policy "elections read" on public.elections for select using (true);
create policy "elections admin" on public.elections for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create policy "election_events read public" on public.election_events for select using (public = true or public.is_staff(auth.uid()));
create policy "election_events admin" on public.election_events for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- Forms: published read by all authenticated; admin manage
create policy "forms read" on public.application_forms for select using (auth.uid() is not null);
create policy "forms admin" on public.application_forms for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create policy "form_versions read" on public.application_form_versions for select using (auth.uid() is not null);
create policy "form_versions admin" on public.application_form_versions for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create policy "questions read" on public.application_questions for select using (auth.uid() is not null);
create policy "questions admin" on public.application_questions for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create policy "options read" on public.application_options for select using (auth.uid() is not null);
create policy "options admin" on public.application_options for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- Applications: owner, team members, staff
create policy "applications select" on public.applications for select using (
  applicant_id = auth.uid()
  or public.is_staff(auth.uid())
  or exists (select 1 from public.executive_team_members m where m.team_id = applications.executive_team_id and m.user_id = auth.uid())
);
create policy "applications insert" on public.applications for insert with check (auth.uid() is not null);
create policy "applications update owner/staff" on public.applications for update using (
  applicant_id = auth.uid() or public.is_staff(auth.uid())
  or exists (select 1 from public.executive_team_members m where m.team_id = applications.executive_team_id and m.user_id = auth.uid())
);

-- Answers
create policy "answers select" on public.application_answers for select using (
  respondent_id = auth.uid() or public.is_staff(auth.uid())
  or exists (select 1 from public.applications a where a.id = application_answers.application_id and a.applicant_id = auth.uid())
  or exists (select 1 from public.applications a join public.executive_team_members m on m.team_id = a.executive_team_id where a.id = application_answers.application_id and m.user_id = auth.uid())
);
create policy "answers insert" on public.application_answers for insert with check (auth.uid() is not null);
create policy "answers update" on public.application_answers for update using (respondent_id = auth.uid() or public.is_staff(auth.uid()));

-- Executive teams
create policy "teams select" on public.executive_teams for select using (
  created_by = auth.uid() or public.is_staff(auth.uid())
  or exists (select 1 from public.executive_team_members m where m.team_id = executive_teams.id and m.user_id = auth.uid())
);
create policy "teams insert" on public.executive_teams for insert with check (auth.uid() is not null);
create policy "teams update" on public.executive_teams for update using (
  created_by = auth.uid() or public.is_staff(auth.uid())
  or exists (select 1 from public.executive_team_members m where m.team_id = executive_teams.id and m.user_id = auth.uid())
);

-- Team members
create policy "team_members select" on public.executive_team_members for select using (
  user_id = auth.uid() or public.is_staff(auth.uid())
  or exists (select 1 from public.executive_team_members m2 where m2.team_id = executive_team_members.team_id and m2.user_id = auth.uid())
);
create policy "team_members manage" on public.executive_team_members for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- Invitations
create policy "invitations select" on public.team_invitations for select using (
  invited_by = auth.uid() or accepted_by = auth.uid() or public.is_staff(auth.uid())
  or exists (select 1 from public.executive_team_members m where m.team_id = team_invitations.team_id and m.user_id = auth.uid())
);
create policy "invitations manage" on public.team_invitations for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- Eligibility rules: read auth; admin manage
create policy "elig_rules read" on public.eligibility_rules for select using (auth.uid() is not null);
create policy "elig_rules admin" on public.eligibility_rules for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- Eligibility checks: staff manage, owner read
create policy "elig_checks select" on public.eligibility_checks for select using (public.is_staff(auth.uid()) or user_id = auth.uid());
create policy "elig_checks manage" on public.eligibility_checks for all using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

-- Reviews
create policy "reviews select" on public.application_reviews for select using (public.is_staff(auth.uid()) or exists (select 1 from public.applications a where a.id = application_reviews.application_id and (a.applicant_id = auth.uid() or exists (select 1 from public.executive_team_members m where m.team_id = a.executive_team_id and m.user_id = auth.uid()))));
create policy "reviews manage" on public.application_reviews for all using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

create policy "review_notes select" on public.review_notes for select using (public.is_staff(auth.uid()) or (internal = false and exists (select 1 from public.applications a where a.id = review_notes.application_id and (a.applicant_id = auth.uid() or exists (select 1 from public.executive_team_members m where m.team_id = a.executive_team_id and m.user_id = auth.uid())))));
create policy "review_notes manage" on public.review_notes for all using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

-- Campaign materials: team members + staff; public approved readable
create policy "campaign select" on public.campaign_materials for select using (
  public.is_staff(auth.uid())
  or exists (select 1 from public.executive_team_members m where m.team_id = campaign_materials.team_id and m.user_id = auth.uid())
  or status = 'approved'
);
create policy "campaign manage" on public.campaign_materials for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "campaign_reviews manage" on public.campaign_material_reviews for all using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create policy "campaign_reviews read" on public.campaign_material_reviews for select using (public.is_staff(auth.uid()));

-- Announcements: published read by all; admin manage
create policy "announcements read" on public.announcements for select using (published = true or public.is_staff(auth.uid()));
create policy "announcements manage" on public.announcements for all using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

-- Notifications: own
create policy "notifications own" on public.notifications for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Volunteers
create policy "volunteer_tasks read" on public.volunteer_tasks for select using (auth.uid() is not null);
create policy "volunteer_tasks manage" on public.volunteer_tasks for all using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

create policy "volunteer_assignments select" on public.volunteer_assignments for select using (
  volunteer_id = auth.uid() or public.is_staff(auth.uid())
);
create policy "volunteer_assignments manage" on public.volunteer_assignments for all using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

create policy "volunteer_hours select" on public.volunteer_hours for select using (volunteer_id = auth.uid() or public.is_staff(auth.uid()));
create policy "volunteer_hours manage" on public.volunteer_hours for all using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

-- Senate
create policy "senate_memberships select" on public.senate_memberships for select using (user_id = auth.uid() or public.is_staff(auth.uid()));
create policy "senate_memberships manage" on public.senate_memberships for all using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

create policy "class_results select" on public.class_election_results for select using (public.is_staff(auth.uid()));
create policy "class_results manage" on public.class_election_results for all using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

-- Results
create policy "official_results select" on public.official_election_results for select using (published = true or public.is_staff(auth.uid()));
create policy "official_results manage" on public.official_election_results for all using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

create policy "result_verifications manage" on public.result_verifications for all using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create policy "result_verifications select" on public.result_verifications for select using (public.is_staff(auth.uid()));

-- Audit logs: admin read; insert via service/admin
create policy "audit read admin" on public.audit_logs for select using (public.is_admin(auth.uid()));
create policy "audit insert" on public.audit_logs for insert with check (auth.uid() is not null);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''));
  insert into public.user_roles (user_id, role) values (new.id, 'student') on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();