-- Student votes: questions student government puts to the whole school. Anyone signed in votes once per question.
-- Ballots are secret: who voted (poll_voters) and what was chosen (poll_votes) are stored apart and joined by nothing.
-- Every change goes through the functions below, so the rules hold even if someone calls the API directly.

create table if not exists public.polls (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 200),
  description text check (description is null or char_length(description) <= 2000),
  kind text not null default 'single' check (kind in ('single','multiple')),
  max_choices int not null default 1 check (max_choices between 1 and 12),
  show_results text not null default 'after_close' check (show_results in ('live','after_close')),
  status text not null default 'draft' check (status in ('draft','open','closed')),
  closes_at timestamptz,
  opened_at timestamptz,
  closed_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind = 'single' and max_choices = 1) or (kind = 'multiple' and max_choices >= 2))
);

create table if not exists public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 120),
  position int not null default 0
);
create index if not exists idx_poll_options_poll on public.poll_options(poll_id, position);

-- Who voted. Holds no choices.
create table if not exists public.poll_voters (
  poll_id uuid not null references public.polls(id) on delete cascade,
  voter_id uuid not null references auth.users(id) on delete cascade,
  voted_at timestamptz not null default now(),
  primary key (poll_id, voter_id)
);

-- What was chosen. Holds no voters and no timestamps.
create table if not exists public.poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  option_id uuid not null references public.poll_options(id) on delete cascade
);
create index if not exists idx_poll_votes_option on public.poll_votes(option_id);

drop trigger if exists polls_upd on public.polls;
create trigger polls_upd before update on public.polls for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- access
alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_voters enable row level security;
alter table public.poll_votes enable row level security;

-- Nobody writes these tables directly. Reads only, and drafts stay with the people who run votes.
revoke all on public.polls, public.poll_options, public.poll_voters, public.poll_votes from anon, authenticated;
grant select on public.polls, public.poll_options, public.poll_voters to authenticated;

drop policy if exists "polls read" on public.polls;
create policy "polls read" on public.polls for select to authenticated
  using (status <> 'draft' or public.can_run_government(auth.uid()));
drop policy if exists "poll_options read" on public.poll_options;
create policy "poll_options read" on public.poll_options for select to authenticated
  using (exists (select 1 from public.polls p where p.id = poll_id));
-- You can see that you voted, never who else did. Choices are not readable by anyone (no policy on poll_votes).
drop policy if exists "poll_voters own" on public.poll_voters;
create policy "poll_voters own" on public.poll_voters for select to authenticated using (voter_id = auth.uid());

-- ---------------------------------------------------------------- set up a vote
create or replace function public.save_poll(
  p_id uuid, p_title text, p_description text, p_kind text, p_max int, p_closes_at timestamptz, p_show_results text, p_options text[]
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  pid uuid := p_id; v_title text := trim(coalesce(p_title, '')); v_descr text := nullif(trim(coalesce(p_description, '')), '');
  labels text[] := array[]::text[]; raw text; l text; n int; maxc int; existing public.polls%rowtype;
begin
  if not public.can_run_government(auth.uid()) then raise exception 'Only the secretary or an administrator can set up a vote.'; end if;
  if char_length(v_title) < 3 then raise exception 'Give the vote a title of at least 3 characters.'; end if;
  if char_length(v_title) > 200 then raise exception 'That title is too long.'; end if;
  if v_descr is not null and char_length(v_descr) > 2000 then raise exception 'That description is too long.'; end if;
  if p_kind not in ('single','multiple') then raise exception 'Choose single or multiple choice.'; end if;
  if p_show_results not in ('live','after_close') then raise exception 'Choose when results are shown.'; end if;

  foreach raw in array coalesce(p_options, array[]::text[]) loop
    l := trim(coalesce(raw, ''));
    if l <> '' then
      if char_length(l) > 120 then raise exception 'An option is longer than 120 characters.'; end if;
      if exists (select 1 from unnest(labels) x where lower(x) = lower(l)) then raise exception 'Two options are the same: %.', l; end if;
      labels := labels || l;
    end if;
  end loop;
  n := coalesce(array_length(labels, 1), 0);
  if n < 2 then raise exception 'A vote needs at least 2 options.'; end if;
  if n > 12 then raise exception 'A vote can have at most 12 options.'; end if;
  if p_kind = 'multiple' and n < 3 then raise exception 'Choose-several votes need at least 3 options.'; end if;
  maxc := case when p_kind = 'single' then 1 else least(greatest(coalesce(p_max, 2), 2), n - 1) end;
  if p_closes_at is not null and p_closes_at <= now() then raise exception 'The closing time must be in the future.'; end if;

  if pid is null then
    insert into public.polls (title, description, kind, max_choices, show_results, closes_at, created_by)
      values (v_title, v_descr, p_kind, maxc, p_show_results, p_closes_at, auth.uid()) returning id into pid;
  else
    select * into existing from public.polls where id = pid for update;
    if not found then raise exception 'That vote no longer exists.'; end if;
    if existing.status <> 'draft' then raise exception 'Only a draft can be edited. Once voting opens the question and options are fixed.'; end if;
    update public.polls set title = v_title, description = v_descr, kind = p_kind, max_choices = maxc, show_results = p_show_results, closes_at = p_closes_at
      where id = pid;
    delete from public.poll_options where poll_id = pid;
  end if;
  insert into public.poll_options (poll_id, label, position)
    select pid, x.label, x.ord from unnest(labels) with ordinality as x(label, ord);
  return pid;
end $$;

create or replace function public.set_poll_status(p_poll uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare p public.polls%rowtype; n int;
begin
  if not public.can_run_government(auth.uid()) then raise exception 'Only the secretary or an administrator can open or close a vote.'; end if;
  select * into p from public.polls where id = p_poll for update;
  if not found then raise exception 'That vote no longer exists.'; end if;
  if p_status = 'open' then
    if p.status <> 'draft' then raise exception 'Only a draft can be opened.'; end if;
    select count(*) into n from public.poll_options where poll_id = p.id;
    if n < 2 then raise exception 'Add at least 2 options before opening the vote.'; end if;
    if p.closes_at is not null and p.closes_at <= now() then raise exception 'The closing time has passed. Set a new one first.'; end if;
    update public.polls set status = 'open', opened_at = now() where id = p.id;
    insert into public.notifications (user_id, title, body, link)
      select pr.id, left('New vote: ' || p.title, 200), 'Cast your vote before it closes.', '/vote' from public.profiles pr;
  elsif p_status = 'closed' then
    if p.status <> 'open' then raise exception 'Only an open vote can be closed.'; end if;
    update public.polls set status = 'closed', closed_at = now() where id = p.id;
  else
    raise exception 'Unknown status.';
  end if;
end $$;

create or replace function public.delete_poll(p_poll uuid)
returns void language plpgsql security definer set search_path = public as $$
declare p public.polls%rowtype;
begin
  if not public.can_run_government(auth.uid()) then raise exception 'Only the secretary or an administrator can delete a vote.'; end if;
  select * into p from public.polls where id = p_poll for update;
  if not found then return; end if;
  if p.status <> 'draft' then raise exception 'Only a draft can be deleted. A vote that has opened is kept as a record.'; end if;
  delete from public.polls where id = p.id;
end $$;

-- ---------------------------------------------------------------- vote
create or replace function public.cast_poll_vote(p_poll uuid, p_options uuid[])
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); p public.polls%rowtype; chosen uuid[]; n int; valid int;
begin
  if uid is null then raise exception 'Sign in to vote.'; end if;
  if not exists (select 1 from public.profiles where id = uid) then raise exception 'Only students with an account can vote.'; end if;
  select * into p from public.polls where id = p_poll;
  if not found or p.status = 'draft' then raise exception 'That vote does not exist.'; end if;
  if p.status <> 'open' or (p.closes_at is not null and p.closes_at <= now()) then raise exception 'Voting on this has closed.'; end if;

  chosen := array(select distinct x from unnest(coalesce(p_options, array[]::uuid[])) x);
  n := coalesce(array_length(chosen, 1), 0);
  if n < 1 then raise exception 'Choose an option.'; end if;
  if n > p.max_choices then raise exception 'You can choose at most % option(s) here.', p.max_choices; end if;
  select count(*) into valid from public.poll_options where poll_id = p.id and id = any(chosen);
  if valid <> n then raise exception 'One of those options is not part of this vote.'; end if;

  begin
    insert into public.poll_voters (poll_id, voter_id) values (p.id, uid);
  exception when unique_violation then
    raise exception 'You have already voted on this.';
  end;
  -- Shuffled so the order of rows says nothing about who chose what.
  insert into public.poll_votes (poll_id, option_id) select p.id, o from unnest(chosen) o order by random();
end $$;

-- ---------------------------------------------------------------- results
-- Counts only. Hidden from voters until the vote ends unless results are live; the people who run votes always see them.
create or replace function public.poll_summary(p_poll uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare p public.polls%rowtype; managing boolean; ended boolean; shown boolean; voters int; opts jsonb;
begin
  if auth.uid() is null then return null; end if;
  select * into p from public.polls where id = p_poll;
  if not found then return null; end if;
  managing := public.can_run_government(auth.uid());
  if p.status = 'draft' and not managing then return null; end if;
  ended := p.status = 'closed' or (p.closes_at is not null and p.closes_at <= now());
  shown := managing or ended or p.show_results = 'live';
  select count(*) into voters from public.poll_voters where poll_id = p.id;
  if shown then
    select jsonb_agg(jsonb_build_object('id', o.id, 'label', o.label, 'votes', (select count(*) from public.poll_votes v where v.option_id = o.id)) order by o.position)
      into opts from public.poll_options o where o.poll_id = p.id;
  end if;
  return jsonb_build_object('voters', voters, 'ended', ended, 'options', opts);
end $$;

create or replace function public.poll_summaries(p_polls uuid[])
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(x::text, public.poll_summary(x)), '{}'::jsonb) from unnest(p_polls) x;
$$;

revoke all on function public.save_poll(uuid, text, text, text, int, timestamptz, text, text[]) from public, anon;
revoke all on function public.set_poll_status(uuid, text) from public, anon;
revoke all on function public.delete_poll(uuid) from public, anon;
revoke all on function public.cast_poll_vote(uuid, uuid[]) from public, anon;
revoke all on function public.poll_summary(uuid) from public, anon;
revoke all on function public.poll_summaries(uuid[]) from public, anon;
grant execute on function public.save_poll(uuid, text, text, text, int, timestamptz, text, text[]) to authenticated;
grant execute on function public.set_poll_status(uuid, text) to authenticated;
grant execute on function public.delete_poll(uuid) to authenticated;
grant execute on function public.cast_poll_vote(uuid, uuid[]) to authenticated;
grant execute on function public.poll_summary(uuid) to authenticated;
grant execute on function public.poll_summaries(uuid[]) to authenticated;

-- ---------------------------------------------------------------- audit trail
drop trigger if exists polls_audit on public.polls;
create trigger polls_audit after insert or delete or update of status on public.polls for each row execute function public.gov_audit();
