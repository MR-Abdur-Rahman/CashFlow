-- On account deletion: keep each other user's saved contact name (just unlink so it becomes an
-- ordinary local contact), and notify each of those users that the contact left CashFlow.
-- Runs BEFORE DELETE so the people rows still carry linked_user_id = OLD.id (needed to find the
-- affected users) and OLD.full_name is still the deleted user's name at deletion time.
-- SECURITY DEFINER bypasses RLS, so notifications can be inserted for the OTHER users' ids — the
-- same cross-user pattern request_connection uses.
create or replace function public.handle_profile_deletion()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_name text := coalesce(nullif(btrim(old.full_name), ''), 'A contact');
begin
  -- Notify every user who had the deleted user as a linked contact (one per user).
  insert into public.notifications (user_id, type, title, message)
  select distinct pe.user_id,
         'contact_account_deleted',
         'Contact left CashFlow',
         v_name || ' deleted their CashFlow account — they''re now a local contact.'
  from public.people pe
  where pe.linked_user_id = old.id;

  -- Keep the saved name; only clear the link so it becomes a plain local (unlinked) contact.
  update public.people
  set linked_user_id = null
  where linked_user_id = old.id;

  return old;
end;
$function$;
