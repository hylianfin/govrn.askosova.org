-- Student emails are firstname.lastname@students.askosova.org, so the confirmed address itself proves the name.
-- Only that domain counts (staff addresses never match), typos in the name on the form are forgiven for longer
-- words, and addresses with digits (ramadani2) need an exact match since they may belong to someone else.
create or replace function public.name_matches_email(p_name text, p_email text)
returns boolean language plpgsql stable set search_path = public, extensions as $$
declare
  w text[] := public.name_tokens(p_name); e text[] := public.name_tokens(split_part(coalesce(p_email, ''), '@', 1));
  f text; l text; n int := coalesce(array_length(w, 1), 0); m int := coalesce(array_length(e, 1), 0); t text;
begin
  if lower(coalesce(p_email, '')) !~ '@students\.askosova\.org$' then return false; end if;
  if n < 2 or m < 1 then return false; end if;
  f := w[1]; l := w[n];
  if m >= 2 then
    -- first and last name both present (either order), and nothing in the address that the name doesn't explain
    if not (public.tok_in(f, e) and public.tok_in(l, e)) then return false; end if;
    foreach t in array e loop
      if not public.tok_in(t, w) then return false; end if;
    end loop;
    return true;
  end if;
  -- one word: firstnamelastname, lastnamefirstname, or firstname + last initial (oniksam)
  return e[1] in (f || l, l || f, f || left(l, 1))
      or (e[1] !~ '[0-9]' and length(e[1]) >= 8 and (public.typo_equal(e[1], f || l) or public.typo_equal(e[1], l || f)));
end;
$$;

-- Is word t one of the words in arr? Exact, or a one-letter slip in words of 5+ letters (never for words with digits).
create or replace function public.tok_in(t text, arr text[])
returns boolean language sql stable set search_path = public, extensions as $$
  select exists (
    select 1 from unnest(arr) x
    where x = t or (t !~ '[0-9]' and x !~ '[0-9]' and length(t) >= 5 and length(x) >= 5 and public.typo_equal(t, x))
  );
$$;
