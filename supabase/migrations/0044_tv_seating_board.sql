-- The public TV receives a safe display payload through this security-definer function.
-- It includes every expected seat, even before attendance or a ballot is recorded.
create or replace function public.gov_tv(p_meeting uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare meeting_row public.gov_meetings%rowtype; seats_data jsonb; motions_data jsonb;
begin
  select * into meeting_row from public.gov_meetings where id = p_meeting;
  if not found then return null; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', member.user_id,
    'name', profile.full_name,
    'office', member.office,
    'status', coalesce(attendance.status, 'unmarked')
  ) order by profile.full_name), '[]'::jsonb) into seats_data
  from public.government_members member
  join public.profiles profile on profile.id = member.user_id
  left join public.gov_attendance attendance on attendance.meeting_id = meeting_row.id and attendance.user_id = member.user_id
  where member.status = 'active'
    and (meeting_row.body = 'joint'
      or (meeting_row.body = 'senate' and member.office in ('hs_senator', 'ms_senator'))
      or (meeting_row.body = 'executive' and member.office not in ('hs_senator', 'ms_senator')));

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', motion.id, 'text', motion.text, 'open', motion.voting_open,
    'yes', motion.votes_yes, 'no', motion.votes_no, 'abstain', motion.votes_abstain,
    'status', motion.status,
    'ballots', coalesce((select jsonb_agg(jsonb_build_object(
      'userId', ballot.user_id, 'name', profile.full_name, 'choice', ballot.choice
    ) order by profile.full_name) from public.gov_motion_ballots ballot
      join public.profiles profile on profile.id = ballot.user_id where ballot.motion_id = motion.id), '[]'::jsonb)
  ) order by motion.created_at), '[]'::jsonb) into motions_data
  from public.gov_motions motion where motion.meeting_id = meeting_row.id;

  return jsonb_build_object(
    'meeting', jsonb_build_object('title', meeting_row.title, 'status', meeting_row.status, 'body', meeting_row.body, 'displayCode', meeting_row.display_code),
    'seats', seats_data,
    'motions', motions_data
  );
end;
$$;
grant execute on function public.gov_tv(uuid) to anon, authenticated;
