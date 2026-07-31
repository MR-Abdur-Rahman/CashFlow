-- Lock down the new SECURITY DEFINER RPCs: only signed-in users may call them (they all guard on
-- auth.uid() anyway, but revoking anon/public is defense-in-depth for a privacy-sensitive feature).
alter function public.username_is_reserved(text) set search_path to 'public';

revoke execute on function public.username_is_reserved(text) from public, anon;
revoke execute on function public.username_available(text) from public, anon;
revoke execute on function public.set_username(text) from public, anon;
revoke execute on function public.request_connection(uuid) from public, anon;
revoke execute on function public.respond_connection_request(uuid, boolean) from public, anon;
revoke execute on function public.search_users_by_username(text) from public, anon;
revoke execute on function public.create_mutual_connection(uuid, text, text, uuid, text, text) from public, anon;

grant execute on function public.username_available(text) to authenticated;
grant execute on function public.set_username(text) to authenticated;
grant execute on function public.request_connection(uuid) to authenticated;
grant execute on function public.respond_connection_request(uuid, boolean) to authenticated;
grant execute on function public.search_users_by_username(text) to authenticated;
grant execute on function public.create_mutual_connection(uuid, text, text, uuid, text, text) to authenticated;
