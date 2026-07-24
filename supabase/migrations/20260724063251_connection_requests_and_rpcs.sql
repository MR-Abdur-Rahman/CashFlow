-- Request/accept model for search-based linking (unlike QR, no physical co-presence implies consent).
do $$ begin
  if not exists (select 1 from pg_type where typname = 'connection_request_status') then
    create type public.connection_request_status as enum ('pending','accepted','declined');
  end if;
end $$;

create table if not exists public.connection_requests (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references public.profiles(id) on delete cascade,
  to_user_id   uuid not null references public.profiles(id) on delete cascade,
  status public.connection_request_status not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

-- At most one pending request per ordered pair.
create unique index if not exists connection_requests_pending_uniq
  on public.connection_requests (from_user_id, to_user_id)
  where status = 'pending';
create index if not exists connection_requests_to_idx on public.connection_requests (to_user_id, status);

alter table public.connection_requests enable row level security;

-- Read-only for clients: each party sees requests they sent or received. All writes go through the RPCs.
drop policy if exists connection_requests_select on public.connection_requests;
create policy connection_requests_select on public.connection_requests
  for select to authenticated
  using (auth.uid() = from_user_id or auth.uid() = to_user_id);

grant select on public.connection_requests to authenticated;

-- ── Send a connection request (identity derived from auth.uid(), never trusted from a param) ──
create or replace function public.request_connection(target_user_id uuid)
returns uuid language plpgsql security definer set search_path to 'public'
as $$
declare v_me uuid := auth.uid(); v_from_name text; v_req_id uuid;
begin
  if v_me is null then raise exception 'not authenticated'; end if;
  if target_user_id = v_me then raise exception 'cannot connect to yourself'; end if;
  if not exists (select 1 from public.profiles where id = target_user_id) then
    raise exception 'user not found';
  end if;
  if exists (select 1 from public.people where user_id = v_me and linked_user_id = target_user_id) then
    raise exception 'already connected';
  end if;
  if exists (select 1 from public.connection_requests
             where from_user_id = target_user_id and to_user_id = v_me and status = 'pending') then
    raise exception 'they already sent you a request — accept it instead';
  end if;
  if exists (select 1 from public.connection_requests
             where from_user_id = v_me and to_user_id = target_user_id and status = 'pending') then
    raise exception 'request already sent';
  end if;

  insert into public.connection_requests (from_user_id, to_user_id)
  values (v_me, target_user_id) returning id into v_req_id;

  select coalesce(full_name, 'Someone') into v_from_name from public.profiles where id = v_me;
  insert into public.notifications (user_id, type, title, message)
  values (target_user_id, 'connection_request', 'New connection request',
          v_from_name || ' wants to connect with you');

  return v_req_id;
end;
$$;

-- ── Accept/decline (recipient only) ──
create or replace function public.respond_connection_request(request_id uuid, accept boolean)
returns void language plpgsql security definer set search_path to 'public'
as $$
declare v_me uuid := auth.uid(); r public.connection_requests%rowtype;
        v_from_name text; v_me_name text;
begin
  if v_me is null then raise exception 'not authenticated'; end if;
  select * into r from public.connection_requests where id = request_id;
  if not found or r.to_user_id <> v_me then raise exception 'not authorized'; end if;
  if r.status <> 'pending' then raise exception 'already responded'; end if;

  if accept then
    select coalesce(full_name, 'Friend') into v_from_name from public.profiles where id = r.from_user_id;
    select coalesce(full_name, 'Friend') into v_me_name   from public.profiles where id = v_me;
    -- Reuse the hardened linking routine: the acceptor is the "scanner" (= auth.uid()).
    perform public.create_mutual_connection(v_me, v_me_name, null, r.from_user_id, v_from_name, null);
    update public.connection_requests set status = 'accepted', responded_at = now() where id = request_id;
    insert into public.notifications (user_id, type, title, message)
    values (r.from_user_id, 'connection_accepted', 'Connection accepted',
            v_me_name || ' accepted your connection request');
  else
    update public.connection_requests set status = 'declined', responded_at = now() where id = request_id;
  end if;
end;
$$;

-- ── Prefix search over opt-in-public usernames (minimal public info; excludes self + existing links) ──
create or replace function public.search_users_by_username(prefix text)
returns table (id uuid, full_name text, avatar_url text, username text)
language plpgsql stable security definer set search_path to 'public'
as $$
declare v_me uuid := auth.uid(); v text := lower(trim(prefix));
begin
  if v_me is null or length(v) < 2 then return; end if;
  return query
    select p.id, p.full_name, p.avatar_url, p.username
    from public.profiles p
    where p.discoverable_by_username
      and p.username is not null
      and p.username like v || '%'
      and p.id <> v_me
      and not exists (
        select 1 from public.people pe where pe.user_id = v_me and pe.linked_user_id = p.id
      )
    order by p.username
    limit 20;
end;
$$;

grant execute on function public.request_connection(uuid) to authenticated;
grant execute on function public.respond_connection_request(uuid, boolean) to authenticated;
grant execute on function public.search_users_by_username(text) to authenticated;
