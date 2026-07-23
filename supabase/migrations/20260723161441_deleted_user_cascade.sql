-- When a user deletes their account (currently a client-side delete of their public.profiles row),
-- every OTHER user who had them as a LINKED contact should keep that contact as a local, renameable
-- entry labelled "Deleted user" — scoped only to that specific deleted user's connections.
--
-- This runs BEFORE the delete (and before the people_linked_user_id_fkey ON DELETE SET NULL fires),
-- so the links still point at OLD.id and can be matched. It sets the name AND nulls the link in one
-- statement, leaving the FK's SET NULL as a no-op. SECURITY DEFINER so it can update other users'
-- rows (RLS would otherwise block cross-user writes; the FK already does cross-user writes with
-- system rights, so this is consistent). Works for the current profiles delete and any future
-- auth.users-based deletion, since a cascade delete of the profiles row still fires this trigger.
--
-- Intentionally leaves split_shares.person_name (history snapshots) and group_members.member_user_id
-- untouched — history keeps the name as it was at the time of the split.
create or replace function public.handle_profile_deletion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.people
  set name = 'Deleted user', linked_user_id = null
  where linked_user_id = old.id;
  return old;
end;
$$;

create trigger on_profile_delete
  before delete on public.profiles
  for each row
  execute function public.handle_profile_deletion();
