-- A "typo" is one wrong, missing or extra letter, or two neighbouring letters swapped (Emsa for Esma).
create or replace function public.typo_equal(a text, b text)
returns boolean language plpgsql immutable set search_path = public, extensions as $$
declare i int;
begin
  if a = b then return true; end if;
  if levenshtein(a, b) <= 1 then return true; end if;
  if length(a) = length(b) and length(a) >= 2 then
    for i in 1..length(a) - 1 loop
      if overlay(a placing substr(a, i + 1, 1) || substr(a, i, 1) from i for 2) = b then return true; end if;
    end loop;
  end if;
  return false;
end;
$$;

create or replace function public.name_fuzzy_equal(a text, b text)
returns boolean language plpgsql stable set search_path = public, extensions as $$
declare x text[] := public.name_tokens(a); y text[] := public.name_tokens(b); tmp text[]; used int[] := '{}'; i int; j int; ok boolean;
begin
  if coalesce(array_length(x, 1), 0) < 2 or coalesce(array_length(y, 1), 0) < 2 then return false; end if;
  if abs(array_length(x, 1) - array_length(y, 1)) > 1 then return false; end if;
  if array_length(x, 1) > array_length(y, 1) then tmp := x; x := y; y := tmp; end if;
  for i in 1..array_length(x, 1) loop
    ok := false;
    for j in 1..array_length(y, 1) loop
      if not (j = any(used)) and (x[i] = y[j] or (length(x[i]) >= 5 and length(y[j]) >= 5 and public.typo_equal(x[i], y[j]))) then
        used := used || j; ok := true; exit;
      end if;
    end loop;
    if not ok then return false; end if;
  end loop;
  return true;
end;
$$;

create or replace function public.homeroom_matches(p_input text, p_answer text, p_grade int)
returns boolean language plpgsql stable set search_path = public, extensions as $$
declare
  titles text[] := array['ms','mr','mrs','miss','mz','dr','prof','professor','teacher','sir','madam'];
  a text[]; i text[]; t text; k int; hit boolean; surname_ok boolean := false; g text;
begin
  g := substring(coalesce(p_answer, '') from '(?:^|[^0-9])(9|10|11|12)(?:[^0-9]|$)');
  if g is not null and p_grade is not null and g::int <> p_grade then return false; end if;
  select coalesce(array_agg(x order by o), '{}') into a from unnest(public.name_tokens(p_answer)) with ordinality s(x, o) where x <> all(titles) and x !~ '[0-9]';
  select coalesce(array_agg(x order by o), '{}') into i from unnest(public.name_tokens(p_input)) with ordinality s(x, o) where x <> all(titles) and x !~ '[0-9]';
  if coalesce(array_length(a, 1), 0) = 0 or coalesce(array_length(i, 1), 0) = 0 then return false; end if;
  foreach t in array i loop
    hit := false;
    for k in 1..array_length(a, 1) loop
      if t = a[k] or (greatest(length(t), length(a[k])) >= 4 and public.typo_equal(t, a[k])) then
        hit := true;
        if k = array_length(a, 1) then surname_ok := true; end if;
      end if;
    end loop;
    if not hit then return false; end if;
  end loop;
  return surname_ok;
end;
$$;
