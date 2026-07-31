-- Raise the username minimum length from 3 to 8 characters (total 8–20). Existing usernames are all
-- >= 8, so the validated constraint is safe.
alter table public.profiles drop constraint if exists profiles_username_format;
alter table public.profiles
  add constraint profiles_username_format
  check (username is null or username ~ '^[a-z][a-z0-9_]{7,19}$');

create or replace function public.username_available(candidate text)
returns boolean language plpgsql stable security definer set search_path to 'public'
as $$
declare v text := lower(trim(candidate));
begin
  if v !~ '^[a-z][a-z0-9_]{7,19}$' then return false; end if;
  if public.username_is_reserved(v) then return false; end if;
  return not exists (select 1 from public.profiles where username = v);
end;
$$;

create or replace function public.set_username(new_username text)
returns text language plpgsql security definer set search_path to 'public'
as $$
declare v_me uuid := auth.uid(); v text := lower(trim(new_username));
begin
  if v_me is null then raise exception 'not authenticated'; end if;
  if v !~ '^[a-z][a-z0-9_]{7,19}$' then
    raise exception 'Username must be 8–20 chars, lowercase letters/numbers/underscore, starting with a letter';
  end if;
  if public.username_is_reserved(v) then raise exception 'That username is reserved'; end if;
  if exists (select 1 from public.profiles where username = v and id <> v_me) then
    raise exception 'That username is taken';
  end if;
  update public.profiles set username = v, updated_at = now() where id = v_me;
  return v;
end;
$$;
