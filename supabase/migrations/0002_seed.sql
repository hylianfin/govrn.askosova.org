-- Seed data for ASK election (demo). Run after 0001_init.sql.

-- Academic year
insert into public.academic_years (id, label, start_date, end_date, is_current)
values ('11111111-1111-1111-1111-111111111111','2025-2026','2025-09-01','2026-06-30',true)
on conflict (label) do nothing;

-- Election
insert into public.elections (id, academic_year_id, title, timezone, current_stage)
values ('22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111','ASK Student Government Election 2025-2026','Europe/Berlin','applications_open')
on conflict do nothing;

-- Election events (timeline)
insert into public.election_events (election_id, title, description, start_at, end_at, public, order_index) values
('22222222-2222-2222-2222-222222222222','Application period','Applications open for Executive Teams and Student Senate.','2025-11-11 08:00+01','2025-11-14 15:00+01',true,1),
('22222222-2222-2222-2222-222222222222','Eligibility confirmation','Confirmed teams may begin campaigning.','2025-11-14 15:00+01','2025-11-14 17:00+01',true,2),
('22222222-2222-2222-2222-222222222222','Campaign preparation','Prepare posters, videos, and slogans.','2025-11-17 08:00+01','2025-11-21 17:00+01',true,3),
('22222222-2222-2222-2222-222222222222','Official campaign','Authorized campaigning.','2025-11-24 08:00+01','2025-11-25 17:00+01',true,4),
('22222222-2222-2222-2222-222222222222','Debate and Q&A','Teams present their platforms.','2025-12-01 10:00+01','2025-12-01 14:00+01',true,5),
('22222222-2222-2222-2222-222222222222','Election silence','No campaigning.','2025-12-02 00:00+01','2025-12-02 23:59+01',true,6),
('22222222-2222-2222-2222-222222222222','Election Day','Team videos, speeches, and paper ballot voting.','2025-12-03 08:00+01','2025-12-03 15:00+01',true,7);

-- Eligibility rules (executive)
insert into public.eligibility_rules (election_id, scope, key, label, rule_type, config, display_order) values
('22222222-2222-2222-2222-222222222222','executive','team_size','Required team size','team_size','{"value":4}',1),
('22222222-2222-2222-2222-222222222222','executive','positions','Required positions','positions','{"positions":["president","vice_president","secretary","treasurer"]}',2),
('22222222-2222-2222-2222-222222222222','executive','grade_levels','Represent all four high school grade levels','grade_levels','{"required":[9,10,11,12]}',3),
('22222222-2222-2222-2222-222222222222','executive','min_gpa','Minimum GPA C or higher','min_gpa','{"min":"C"}',4),
('22222222-2222-2222-2222-222222222222','executive','behavior','Positive behavior record','behavior','{}',5);

-- Senate eligibility rules (conflicting attendance rules flagged)
insert into public.eligibility_rules (election_id, scope, key, label, rule_type, config, is_conflicting, conflict_group, display_order) values
('22222222-2222-2222-2222-222222222222','senate','no_suspensions','No suspensions during current academic year','suspensions','{}',false,null,1),
('22222222-2222-2222-2222-222222222222','senate','no_detentions','No filed detentions during current academic year','detentions','{}',false,null,2),
('22222222-2222-2222-2222-222222222222','senate','attendance_15','No more than 15 unexcused absences per semester','attendance','{"threshold":15,"period":"semester"}',true,'attendance',3),
('22222222-2222-2222-2222-222222222222','senate','attendance_5class','No more than 5 unexcused absences per class','attendance','{"threshold":5,"period":"class"}',true,'attendance',4),
('22222222-2222-2222-2222-222222222222','senate','community_service','Ten hours of community service during academic year','community_service','{"hours":10}',false,null,5);

-- Application forms
insert into public.application_forms (id, election_id, kind, title, description, is_published) values
('33333333-3333-3333-3333-333333333333','22222222-2222-2222-2222-222222222222','executive_team','Executive Team Application','Apply as a four-member team.',true),
('44444444-4444-4444-4444-444444444444','22222222-2222-2222-2222-222222222222','senate','Student Senate Application','Apply individually to represent your class.',true)
on conflict do nothing;

-- Form versions
insert into public.application_form_versions (id, form_id, version_number, opens_at, closes_at, status) values
('55555555-5555-5555-5555-555555555555','33333333-3333-3333-3333-333333333333',1,'2025-11-11 08:00+01','2025-11-14 15:00+01','published'),
('66666666-6666-6666-6666-666666666666','44444444-4444-4444-4444-444444444444',1,'2025-11-11 08:00+01','2025-11-14 15:00+01','published')
on conflict do nothing;

-- Executive questions (individual/team mix)
insert into public.application_questions (form_id, version_id, scope, label, description, type, required, order_index) values
('33333333-3333-3333-3333-333333333333','55555555-5555-5555-5555-555555555555','team','Team name',null,'short_text',true,1),
('33333333-3333-3333-3333-333333333333','55555555-5555-5555-5555-555555555555','team','Optional slogan',null,'short_text',false,2),
('33333333-3333-3333-3333-333333333333','55555555-5555-5555-5555-555555555555','team','Team introduction',null,'long_text',true,3),
('33333333-3333-3333-3333-333333333333','55555555-5555-5555-5555-555555555555','individual','Introduce yourself. Who are you? What makes you YOU?',null,'long_text',true,4),
('33333333-3333-3333-3333-333333333333','55555555-5555-5555-5555-555555555555','individual','Why would you like to be in Student Senate? What contributions can you offer?',null,'long_text',true,5),
('33333333-3333-3333-3333-333333333333','55555555-5555-5555-5555-555555555555','individual','Describe the importance of being part of a leadership team.',null,'long_text',true,6),
('33333333-3333-3333-3333-333333333333','55555555-5555-5555-5555-555555555555','individual','List some ideas you have to make this high school year better.',null,'long_text',true,7),
('33333333-3333-3333-3333-333333333333','55555555-5555-5555-5555-555555555555','individual','What do you think Student Council can do for our school?',null,'long_text',true,8),
('33333333-3333-3333-3333-333333333333','55555555-5555-5555-5555-555555555555','individual','Student Council will take a good portion of your time. What other activities do you plan on participating in? Describe how you plan to balance them. What is your plan for maintaining your grades and staying organized if selected?',null,'long_text',true,9),
('33333333-3333-3333-3333-333333333333','55555555-5555-5555-5555-555555555555','individual','Share your favorite school memory and explain its significance.',null,'long_text',true,10);

-- Senate questions
insert into public.application_questions (form_id, version_id, scope, label, description, type, required, order_index) values
('44444444-4444-4444-4444-444444444444','66666666-6666-6666-6666-666666666666','applicant','Homeroom Teacher',null,'short_text',true,1),
('44444444-4444-4444-4444-444444444444','66666666-6666-6666-6666-666666666666','applicant','Please explain in detail why you are interested in being part of the Student Senate.',null,'long_text',true,2),
('44444444-4444-4444-4444-444444444444','66666666-6666-6666-6666-666666666666','applicant','What are your areas of interest in which you would like to contribute as a senator?',null,'long_text',true,3);

-- Announcements
insert into public.announcements (title, body, published, published_at) values
('Applications are now open','Executive Team and Student Senate applications are open until November 14 at 3:00 PM.',true,now()),
('Debate scheduled for December 1','All approved teams will present their platforms on December 1.',true,now());