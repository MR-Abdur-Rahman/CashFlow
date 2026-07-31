-- Let a notification reference the connection request it's about, so the row can carry inline
-- Accept/Decline that call respond_connection_request(related_request_id, …).
alter table public.notifications
  add column if not exists related_request_id uuid
  references public.connection_requests(id) on delete cascade;

-- request_connection: attach the new request id to the recipient's notification.
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
  insert into public.notifications (user_id, type, title, message, related_request_id)
  values (target_user_id, 'connection_request', 'New connection request',
          v_from_name || ' wants to connect with you', v_req_id);

  return v_req_id;
end;
$$;

-- respond_connection_request: on accept, link mutually + notify sender; on decline, notify sender too.
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

  select coalesce(full_name, 'Friend') into v_from_name from public.profiles where id = r.from_user_id;
  select coalesce(full_name, 'Friend') into v_me_name   from public.profiles where id = v_me;

  if accept then
    -- Reuse the hardened linking routine: the acceptor is the "scanner" (= auth.uid()).
    perform public.create_mutual_connection(v_me, v_me_name, null, r.from_user_id, v_from_name, null);
    update public.connection_requests set status = 'accepted', responded_at = now() where id = request_id;
    insert into public.notifications (user_id, type, title, message)
    values (r.from_user_id, 'connection_accepted', 'Connection accepted',
            v_me_name || ' accepted your connection request');
  else
    update public.connection_requests set status = 'declined', responded_at = now() where id = request_id;
    insert into public.notifications (user_id, type, title, message)
    values (r.from_user_id, 'connection_declined', 'Connection declined',
            v_me_name || ' declined your connection request');
  end if;
end;
$$;
