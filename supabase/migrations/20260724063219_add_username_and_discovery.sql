-- Public, opt-in handle for discovery. Nullable until set; lowercase; format enforced by CHECK.
alter table public.profiles
  add column if not exists username text,
  add column if not exists discoverable_by_username boolean not null default true;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_username_format') then
    alter table public.profiles
      add constraint profiles_username_format
      check (username is null or username ~ '^[a-z][a-z0-9_]{2,19}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_username_key') then
    alter table public.profiles add constraint profiles_username_key unique (username);
  end if;
end $$;

-- authenticated has only column-level SELECT on profiles → grant the new readable columns.
grant select (username, discoverable_by_username) on public.profiles to authenticated;

-- Reserved handles nobody may claim.
create or replace function public.username_is_reserved(candidate text)
returns boolean language sql immutable as $$
  select lower(candidate) = any (array[
    'admin','administrator','support','help','cashflow','root','system','moderator',
    'official','staff','security','api','www','null','undefined','me','you','settings'
  ]);
$$;

-- Availability check for the settings UI. Public info (usernames are opt-in-public), so no privacy
-- concern. Returns false for malformed or reserved handles.
create or replace function public.username_available(candidate text)
returns boolean language plpgsql stable security definer set search_path to 'public'
as $$
declare v text := lower(trim(candidate));
begin
  if v !~ '^[a-z][a-z0-9_]{2,19}$' then return false; end if;
  if public.username_is_reserved(v) then return false; end if;
  return not exists (select 1 from public.profiles where username = v);
end;
$$;

-- Sets the caller's own username (derives identity from auth.uid(); never trusts a passed-in id).
-- Validates format, reserved list, and uniqueness. Returns the stored handle.
create or replace function public.set_username(new_username text)
returns text language plpgsql security definer set search_path to 'public'
as $$
declare v_me uuid := auth.uid(); v text := lower(trim(new_username));
begin
  if v_me is null then raise exception 'not authenticated'; end if;
  if v !~ '^[a-z][a-z0-9_]{2,19}$' then
    raise exception 'Username must be 3–20 chars, lowercase letters/numbers/underscore, starting with a letter';
  end if;
  if public.username_is_reserved(v) then raise exception 'That username is reserved'; end if;
  if exists (select 1 from public.profiles where username = v and id <> v_me) then
    raise exception 'That username is taken';
  end if;
  update public.profiles set username = v, updated_at = now() where id = v_me;
  return v;
end;
$$;

grant execute on function public.username_available(text) to authenticated;
grant execute on function public.set_username(text) to authenticated;
