-- Support genuinely complete account deletion (via the delete-account Edge Function + admin.deleteUser).

-- 1) Relax FKs that would otherwise block the auth.users→profiles cascade on the deleting user's OWN
--    data. These are soft pointers, so SET NULL on deletion is correct and doesn't affect normal use.
--    (transactions.account_id/to_account_id keep RESTRICT — the Edge Function pre-deletes the user's
--    transactions so normal single-account deletion stays protected.)
alter table public.splits drop constraint splits_paid_by_person_id_fkey;
alter table public.splits add constraint splits_paid_by_person_id_fkey
  foreign key (paid_by_person_id) references public.people(id) on delete set null;

alter table public.splits drop constraint splits_pending_for_user_id_fkey;
alter table public.splits add constraint splits_pending_for_user_id_fkey
  foreign key (pending_for_user_id) references public.profiles(id) on delete set null;

alter table public.settlements drop constraint settlements_pending_for_user_id_fkey;
alter table public.settlements add constraint settlements_pending_for_user_id_fkey
  foreign key (pending_for_user_id) references public.profiles(id) on delete set null;

-- 2) Blocking conditions that make a user a dependency for OTHER people's data integrity. Returns one
--    human-readable message per unresolved blocker (empty = safe to delete). Used by both the client
--    (to warn) and the delete-account Edge Function (server-side re-check, don't trust the client).
create or replace function public.account_deletion_blockers()
returns setof text
language sql stable security definer set search_path to 'public'
as $$
  -- Member of a group you didn't create → leave it first.
  select distinct 'Leave the group "' || g.name || '" before deleting your profile.'
  from public.group_members gm
  join public.groups g on g.id = gm.group_id
  where gm.member_user_id = auth.uid() and g.created_by <> auth.uid()

  union all
  -- A split is awaiting your account confirmation.
  select 'A split is awaiting your account confirmation — resolve it in Split ▸ Pending first.'
  where exists (
    select 1 from public.splits
    where pending_for_user_id = auth.uid() and account_pending
  )

  union all
  -- A settlement is awaiting your account confirmation.
  select 'A settlement is awaiting your account confirmation — resolve it in Split ▸ Pending first.'
  where exists (
    select 1 from public.settlements
    where pending_for_user_id = auth.uid() and receiver_account_pending
  )

  union all
  -- One of your accounts is referenced by another user's settlement record.
  select 'An account of yours is used in another user''s settlement record — that settlement must be removed before you can delete your profile.'
  where exists (
    select 1 from public.settlements s
    join public.accounts a on a.id = s.receiver_account_id
    where a.user_id = auth.uid() and s.created_by <> auth.uid()
  );
$$;

revoke execute on function public.account_deletion_blockers() from public, anon;
grant execute on function public.account_deletion_blockers() to authenticated;
