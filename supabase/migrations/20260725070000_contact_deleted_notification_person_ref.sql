-- Let the "contact left CashFlow" notification reference the affected local contact row, so tapping it
-- opens that specific person's detail instead of the generic Manage page. SET NULL so removing the
-- contact later doesn't delete the notification.
alter table public.notifications
  add column if not exists related_person_id uuid references public.people(id) on delete set null;

-- Recreate the deletion trigger to stamp each notification with the recipient's affected people row id.
create or replace function public.handle_profile_deletion()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_name text := coalesce(nullif(btrim(old.full_name), ''), 'A contact');
begin
  -- Notify each user who had the deleted user as a linked contact, referencing their people row so the
  -- notification can deep-link to that (now local) contact.
  insert into public.notifications (user_id, type, title, message, related_person_id)
  select pe.user_id,
         'contact_account_deleted',
         'Contact left CashFlow',
         v_name || ' deleted their CashFlow account — they''re now a local contact.',
         pe.id
  from public.people pe
  where pe.linked_user_id = old.id;

  -- Keep the saved name; only clear the link so it becomes a plain local (unlinked) contact.
  update public.people
  set linked_user_id = null
  where linked_user_id = old.id;

  return old;
end;
$function$;
