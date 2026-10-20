-- Some exports (e.g. the Senate Google Form) have no email column. Such responses are saved by name and
-- staff attach an account to them afterwards; until then they cannot link to anyone.
alter table public.imported_responses alter column email drop not null;
alter table public.imported_responses drop constraint if exists imported_responses_has_identity;
alter table public.imported_responses add constraint imported_responses_has_identity check (email is not null or nullif(trim(full_name), '') is not null);

create unique index if not exists imported_responses_dedupe_noemail
  on public.imported_responses (kind, lower(full_name), coalesce(submitted_at, 'epoch'::timestamptz)) where email is null;
