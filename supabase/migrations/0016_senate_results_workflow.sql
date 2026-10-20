-- Senate paper-ballot results get the same enter -> verify -> publish workflow as the Executive Team results.
alter table public.class_election_results
  add column if not exists entered_by uuid references auth.users(id),
  add column if not exists entered_at timestamptz,
  add column if not exists verified_by uuid references auth.users(id),
  add column if not exists verified_at timestamptz,
  add column if not exists published boolean not null default false,
  add column if not exists published_at timestamptz;

-- Everyone may read results once an admin has published them.
drop policy if exists "class_results public read published" on public.class_election_results;
create policy "class_results public read published" on public.class_election_results for select using (published = true);
