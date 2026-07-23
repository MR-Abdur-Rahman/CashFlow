-- Editing an account's opening balance must shift its current_balance by the same delta. current_balance
-- is maintained INCREMENTALLY by the transaction/settlement triggers (current_balance = opening_balance +
-- Σ posted effects) and there is NO trigger on accounts UPDATE, so a bare opening_balance edit would
-- break that invariant. Do the shift in one atomic UPDATE — Postgres evaluates SET expressions against
-- the pre-update row, so `current_balance + (p_new_opening - opening_balance)` and `opening_balance =
-- p_new_opening` both read the OLD values — which avoids the read-modify-write race a client-side
-- "current = staleRead + delta" would introduce if a transaction/settlement posts during the edit.
-- SECURITY DEFINER with an explicit user_id = auth.uid() guard so a user can only adjust their own account.
create or replace function public.update_account_opening_balance(
  p_account_id uuid,
  p_new_opening numeric
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_rows int;
begin
  update public.accounts
  set current_balance = current_balance + (p_new_opening - opening_balance),
      opening_balance = p_new_opening
  where id = p_account_id and user_id = auth.uid();

  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception 'Account not found or not owned by the current user';
  end if;
end;
$$;

grant execute on function public.update_account_opening_balance(uuid, numeric) to authenticated;
