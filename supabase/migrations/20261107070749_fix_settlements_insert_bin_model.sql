-- Fix: settlements_insert's WITH CHECK was written for the old per-split settlement model and
-- required can_see_split(split_id) unconditionally. The bin model (person-to-person net
-- settlements) always inserts split_id = NULL, and can_see_split(NULL) is always false
-- (comparing a column to NULL is NULL, so EXISTS(...) is false) — so every Settle Up confirmation
-- has been failing RLS since the bin model shipped (settlements table had 0 rows in prod).
--
-- Current policy definitions on public.settlements at the time of this migration (for the record;
-- these were created directly via MCP and never captured in a local migration file):
--
-- settlements_delete (DELETE):
--   USING (created_by = auth.uid())
--
-- settlements_insert (INSERT) -- REPLACED BELOW:
--   WITH CHECK ((created_by = auth.uid()) AND can_see_split(split_id))
--
-- settlements_select (SELECT):
--   USING (can_see_split(split_id) OR (created_by = auth.uid()))
--
-- settlements_select_counterparty (SELECT):
--   USING (person_id IN (SELECT people.id FROM people WHERE people.linked_user_id = auth.uid()))
--
-- settlements_select_pending (SELECT):
--   USING (pending_for_user_id = auth.uid())
--
-- settlements_select_split_creator (SELECT):
--   USING (split_id IN (SELECT splits.id FROM splits WHERE splits.created_by = auth.uid()))
--
-- settlements_update_pending (UPDATE):
--   USING ((pending_for_user_id = auth.uid()) AND (receiver_account_pending = true))
--   WITH CHECK (pending_for_user_id = auth.uid())

drop policy if exists settlements_insert on public.settlements;

create policy settlements_insert on public.settlements
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and (split_id is null or public.can_see_split(split_id))
    and (account_id is null or exists (
          select 1 from public.accounts a
          where a.id = account_id and a.user_id = auth.uid()))
    and (person_id is null or exists (
          select 1 from public.people p
          where p.id = person_id and p.user_id = auth.uid()))
    and (pending_for_user_id is null or exists (
          select 1 from public.people p
          where p.id = person_id
            and p.user_id = auth.uid()
            and p.linked_user_id = pending_for_user_id))
  );
