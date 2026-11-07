-- Enforce the custom-split invariant server-side (defense in depth — the app now validates this
-- client-side too, see src/lib/customSplit.ts): a participant's share can never be negative, and
-- the sum of submitted shares can never exceed the split's total. The creator never gets a
-- split_shares row — their implicit share is total - sum(shares) (see src/lib/balance.ts) — so an
-- over-assigned custom split silently drives that implicit share negative and corrupts bilateral
-- balance math for everyone involved.
--
-- Pre-flight check (read-only, run before writing this migration):
--   split_shares with share_amount < 0: 0 rows.
--   splits where sum(split_shares.share_amount) > total_amount: 1 row — split f5733139-ee63-4330-
--   a28f-32fcbfe33da8 ("Bla", total 9600, shares sum 9700). Left as-is per instruction; the new
--   CHECK below only targets negative amounts so it does not conflict with that row. The new
--   update_split guard will block any future edit to that split unless it's first brought back
--   into a valid total/share combination.

alter table public.split_shares
  add constraint split_shares_share_amount_check check (share_amount >= 0);

create or replace function public.update_split(
  p_split_id uuid,
  p_total_amount numeric,
  p_description text,
  p_type text,
  p_person_id uuid,
  p_group_id uuid,
  p_split_type text,
  p_category_id uuid,
  p_sub_category_id uuid,
  p_date date,
  p_time time without time zone,
  p_shares jsonb
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  v_uid uuid := auth.uid();
  v_split splits%ROWTYPE;
  v_payer_uid uuid;
  v_elem jsonb;
  v_pid uuid;
  v_amt numeric;
  v_sum numeric := 0;
BEGIN
  SELECT * INTO v_split FROM splits WHERE id = p_split_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Split not found'; END IF;

  -- Resolve the payer (creditor) to an auth user id.
  IF v_split.paid_by = 'me' THEN
    v_payer_uid := v_split.created_by;
  ELSIF v_split.paid_by_person_id IS NOT NULL THEN
    SELECT linked_user_id INTO v_payer_uid FROM people WHERE id = v_split.paid_by_person_id;
  END IF;

  -- Permission: creator OR payer only (mirrors canModifySplit / delete_split).
  IF NOT (v_uid = v_split.created_by OR (v_payer_uid IS NOT NULL AND v_uid = v_payer_uid)) THEN
    RAISE EXCEPTION 'Only the creator or payer can edit this split';
  END IF;

  -- Validate submitted shares BEFORE writing anything: no negative amounts, and their sum must
  -- not exceed the total — the creator's implicit share (total - sum(shares), see lib/balance.ts)
  -- must stay >= 0, or bilateral balance math derives the wrong direction for who owes whom.
  FOR v_elem IN SELECT * FROM jsonb_array_elements(COALESCE(p_shares, '[]'::jsonb)) LOOP
    v_amt := (v_elem->>'share_amount')::numeric;
    IF v_amt < 0 THEN
      RAISE EXCEPTION 'Share amount cannot be negative';
    END IF;
    v_sum := v_sum + v_amt;
  END LOOP;
  IF round(v_sum, 2) > round(p_total_amount, 2) THEN
    RAISE EXCEPTION 'Sum of shares (%) exceeds total amount (%)', round(v_sum, 2), round(p_total_amount, 2);
  END IF;

  -- WHO-PAID + ACCOUNT are LOCKED: paid_by, paid_by_person_id, account_id,
  -- account_pending, pending_for_user_id are deliberately NOT modified here.
  UPDATE splits SET
    total_amount    = p_total_amount,
    description     = p_description,
    type            = p_type,
    person_id       = p_person_id,
    group_id        = p_group_id,
    split_type      = p_split_type,
    category_id     = p_category_id,
    sub_category_id = p_sub_category_id,
    date            = p_date,
    time            = p_time
  WHERE id = p_split_id;

  -- Reconcile shares BY person, preserving share ids so existing settlements that
  -- reference split_share_id stay linked. Definer bypasses the creator-only RLS on
  -- split_shares, so a PAYER edit updates in place instead of duplicating rows.
  -- 1) Drop shares whose person is no longer a participant.
  DELETE FROM split_shares ss
  WHERE ss.split_id = p_split_id
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(p_shares, '[]'::jsonb)) e
      WHERE NULLIF(e->>'person_id','')::uuid IS NOT DISTINCT FROM ss.person_id
    );
  -- 2) Update existing shares in place, insert genuinely new ones.
  FOR v_elem IN SELECT * FROM jsonb_array_elements(COALESCE(p_shares, '[]'::jsonb)) LOOP
    v_pid := NULLIF(v_elem->>'person_id','')::uuid;
    UPDATE split_shares SET
      share_amount = (v_elem->>'share_amount')::numeric,
      person_name  = v_elem->>'person_name'
    WHERE split_id = p_split_id AND person_id IS NOT DISTINCT FROM v_pid;
    IF NOT FOUND THEN
      INSERT INTO split_shares (split_id, person_id, person_name, share_amount)
      VALUES (p_split_id, v_pid, v_elem->>'person_name', (v_elem->>'share_amount')::numeric);
    END IF;
  END LOOP;

  -- Keep the linked expense transaction (only exists for "me paid" splits) in sync.
  -- trg_account_balance_on_transaction reverses the old amount and applies the new,
  -- so the payer's account auto-adjusts by the delta. No-op when no transaction exists.
  UPDATE transactions SET
    amount          = p_total_amount,
    category_id     = p_category_id,
    sub_category_id = p_sub_category_id
  WHERE split_id = p_split_id;
END;
$function$;
