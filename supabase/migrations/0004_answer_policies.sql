-- Team-scope answers are stored with respondent_id = null. The old policies let nobody but staff
-- update them (and any signed-in user insert into any application), so shared team answers
-- could not be edited and duplicated on every save. Let the people on an application edit its answers.

create or replace function public.can_edit_application(app_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select public.is_staff(auth.uid()) or exists (
    select 1 from public.applications a
    where a.id = app_id
      and (
        a.applicant_id = auth.uid()
        or exists (select 1 from public.executive_team_members m where m.team_id = a.executive_team_id and m.user_id = auth.uid())
      )
  );
$$;

-- One shared answer per team question. Remove any duplicates the old behaviour created (keep the newest).
delete from public.application_answers a
using public.application_answers b
where a.respondent_id is null and b.respondent_id is null
  and a.application_id = b.application_id and a.question_id = b.question_id
  and (a.updated_at, a.id) < (b.updated_at, b.id);

create unique index if not exists application_answers_team_unique
  on public.application_answers (application_id, question_id) where respondent_id is null;

drop policy if exists "answers insert" on public.application_answers;
drop policy if exists "answers update" on public.application_answers;
drop policy if exists "answers delete" on public.application_answers;

create policy "answers insert" on public.application_answers for insert
  with check (public.can_edit_application(application_id) and (respondent_id is null or respondent_id = auth.uid() or public.is_staff(auth.uid())));
create policy "answers update" on public.application_answers for update
  using (public.can_edit_application(application_id) and (respondent_id is null or respondent_id = auth.uid() or public.is_staff(auth.uid())))
  with check (public.can_edit_application(application_id) and (respondent_id is null or respondent_id = auth.uid() or public.is_staff(auth.uid())));
create policy "answers delete" on public.application_answers for delete
  using (public.can_edit_application(application_id) and (respondent_id is null or respondent_id = auth.uid() or public.is_staff(auth.uid())));
