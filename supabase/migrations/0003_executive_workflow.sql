-- Align executive-team workflow labels with the published application rules,
-- and make the nomination requirement an editable eligibility rule instead of
-- being hardcoded in the page.

-- Eligibility rules must be publicly readable (like election_events), since
-- prospective candidates read them before signing in. The prior policy
-- required auth.uid() is not null, so the public page silently rendered
-- nothing for anonymous visitors.
drop policy if exists "elig_rules read" on public.eligibility_rules;
create policy "elig_rules read" on public.eligibility_rules for select using (true);

-- Sharpen timeline wording so the public workflow reads correctly.
update public.election_events set
  title = 'Application deadline',
  description = 'Teams must submit their application.'
where title = 'Application period';

update public.election_events set
  title = 'Campaign period'
where title = 'Official campaign';

update public.election_events set
  title = 'Pre-election silence',
  description = 'No campaigning.'
where title = 'Election silence';

-- Nomination requirement: teacher endorsements + student signatures.
insert into public.eligibility_rules (election_id, scope, key, label, description, rule_type, config, display_order)
select e.id, 'executive', 'nomination', 'Nomination requirements',
  'Each candidate must gather teacher endorsements and signatures from a minimum number of fellow students to ensure broad support.',
  'documents', '{"teacher_endorsements_min":1,"student_signatures_min":25}'::jsonb, 6
from public.elections e
where not exists (select 1 from public.eligibility_rules r where r.election_id = e.id and r.scope = 'executive' and r.key = 'nomination')
order by e.created_at desc
limit 1;

-- Debate requirement, surfaced alongside eligibility rather than only in the timeline.
insert into public.eligibility_rules (election_id, scope, key, label, description, rule_type, config, display_order)
select e.id, 'executive', 'debate', 'Debate requirement',
  'Teams will participate in a live debate prior to the election, where they present their platform and answer questions from students.',
  'acknowledgments', '{}'::jsonb, 7
from public.elections e
where not exists (select 1 from public.eligibility_rules r where r.election_id = e.id and r.scope = 'executive' and r.key = 'debate')
order by e.created_at desc
limit 1;
