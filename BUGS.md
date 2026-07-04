# CashFlow Bug List

## Open

### [P2] Settle Up dialog redesign — remove split checkboxes
- Scope: ui
- Severity: major
- Users involved: A, B
- Steps to reproduce: N/A — this is a redesign, not a reproduce-and-fix bug.
- Expected: Settle Up flow should be net-balance-only — you settle the overall amount owed, not individual splits via checkboxes.
- Actual: Current dialog still shows per-split checkboxes for selection, which is more complex than needed.
- Added: 2026-07-04
- Test Log: (none yet)

### [P2] FIFO settlement allocation
- Scope: multi-user-sync
- Severity: major
- Users involved: A, B
- Steps to reproduce: N/A — new feature, not a bug yet.
- Expected: When a settlement is applied, it should pay off the oldest unsettled split first, then the next oldest, etc.
- Actual: No allocation order currently enforced.
- Added: 2026-07-04
- Test Log: (none yet)

### [P2] Group member balance bugs
- Scope: multi-user-sync
- Severity: major
- Users involved: 3+ users in a group (A, B, C minimum)
- Steps to reproduce: TBD — reproduce with a real group split first to capture exact wrong numbers.
- Expected: Each member's balance within a group should reflect their true share/debt accurately.
- Actual: Balances per member are incorrect (specifics TBD).
- Added: 2026-07-04
- Test Log: (none yet)

### [P2] Group split formatting and bilateral balances
- Scope: multi-user-sync
- Severity: major
- Users involved: 3+ users in a group
- Steps to reproduce: TBD
- Expected: Group split rows should format correctly, and bilateral (person-to-person) balances within a group should calculate correctly even with third-party payers.
- Actual: Formatting issues present; bilateral calculation skips third-party payers incorrectly.
- Added: 2026-07-04
- Test Log: (none yet)

### [P2] Real-time sync for settlements
- Scope: multi-user-sync
- Severity: major
- Users involved: A, B
- Steps to reproduce: TBD — confirm whether Realtime is enabled on the settlements table and whether the subscription filter is correct.
- Expected: When one user creates/edits a settlement, the other linked user should see it update live, same as splits already do.
- Actual: Settlements don't sync in real-time.
- Added: 2026-07-04
- Test Log: (none yet)

### [P3] Auto-settlement (opposing debts cancel automatically)
- Scope: multi-user-sync
- Severity: minor
- Users involved: A, B
- Steps to reproduce: N/A — new feature.
- Expected: If A owes B and B owes A, the smaller debt should automatically cancel out, leaving only the net difference.
- Actual: Not implemented — debts sit separately even when they'd naturally offset.
- Added: 2026-07-04
- Test Log: (none yet)

### [P3] History page filter additions
- Scope: ui
- Severity: minor
- Users involved: single-user
- Steps to reproduce: N/A
- Expected: Additional filters needed on History page (specifics to be defined when picked up).
- Actual: Current filter set is incomplete.
- Added: 2026-07-04
- Test Log: (none yet)

### [P3] Full split edit testing matrix
- Scope: other
- Severity: minor
- Users involved: A, B, C, D as needed per scenario
- Steps to reproduce: N/A — this is a QA task, not a single bug. Run once the split edit corruption bug (above) is fixed.
- Expected: A systematic pass confirming split editing works correctly across all scenarios (creator edits, payer edits, group vs individual, etc.)
- Actual: Not yet run.
- Added: 2026-07-04
- Test Log: (none yet)

## Fixed

### [P1] Split edit corruption (individual → "people split", name shown twice) — fixed 2026-07-04
- Commit: (see git) · Migration: add_update_split_rpc
- Repro: an individual split, edited by the PAYER (non-creator), turned into a "people" split showing the counterpart's name twice.
- Root cause: `split_shares` RLS lets ANY authed user INSERT but only the split CREATOR DELETE/UPDATE. The home `EditSplitSheet` regenerated shares via delete-then-insert; for a non-creator payer the delete silently matched 0 rows (RLS) while the insert added a duplicate → `shares.length > 1` → `SplitDirectRow` renders it as a people split with the name doubled, and the debt double-counts. (The person/group edit sheets had the opposite bug — they never updated shares, so amounts went stale.)
- Fix: new `update_split` SECURITY DEFINER RPC — enforces creator-or-payer, reconciles shares in place by person (preserves share ids so settlements stay linked, no duplicates), and syncs the linked transaction so `trg_account_balance_on_transaction` auto-adjusts the payer's account by the amount delta. Who-paid + account are LOCKED (removed from the edit UI). Merged the three divergent `EditSplitSheet` copies into the single home one; person/group screens now import it.
- Test Log:
  1. 2026-07-04 — PASS (DB-level, rolled back) — creator edit: in-place, share_count=1, id preserved; payer edit: permitted, share_count=1 (no duplicate); unrelated user: rejected; total/share/transaction update correctly. Typecheck + vite build clean.
  2. Pending — live UI verification across individual / people / group edits (creator + payer), confirming balances auto-adjust.

### [P1] Account type filtering broken on Pending tab dropdowns — already fixed (verified 2026-07-04)
- Commit: (pre-existing — no change needed)
- Investigation: The Pending-tab receiver row (`PendingSettlementRow`, split.tsx:243-244) already filters accounts by `methodToAccountType[settlement.method]`, and the payer-side `SettleUpDialog` does the same. Account types written by the app (`cash`/`bank`/`e-wallet`) match the mapping targets; settlement methods (`cash`/`bank_transfer`/`e-wallet`) match the mapping keys; `accountsQuery` returns `type`. Logic is correct.
- Why it looked broken: the account set is currently all `cash` and settlements are `cash`, so every account passes the cash filter — visually indistinguishable from "no filtering." Report predates the filter being implemented.
- Resolution: confirmed already-fixed with the user; no code change.
- Test Log:
  1. 2026-07-04 — PASS (by inspection + user confirmation) — filter runs correctly; symptom was a homogeneous all-cash-accounts artifact. To visibly confirm, add a non-cash account and check it is excluded from a cash settlement's dropdown.

### [P1] Settlement payer's balance direction reversed — fixed 2026-07-04
- Commit: 521ca1f
- Root cause: SettleUpDialog set `pending_for_user_id` from `split.created_by` instead of the split's actual payer (creditor). When the creator is the debtor (created a split someone else paid), `update_account_balance_on_settlement` misread the settlement as a creditor receipt (+1) and reversed the account direction on create and delete.
- Fix: resolve creditor from `paid_by`/`paid_by_person_id` in SettleUpDialog.tsx; only flag a remote debtor-payment when the creditor is a different linked user than the settler.
- Data repair: existing prod settlement `f1db5e23` corrected (A's Cash 50,500→49,500) + receiver notification issued.
- Test Log:
  1. 2026-07-04 — PASS — live build: A→B settlements (500 + 200) moved money correctly — A's Cash 49,300, B's Cash 48,700; balances reconcile exactly.

### [P1] Settlement pending rows missing from receiver's Pending tab — fixed 2026-07-04
- Commit: 521ca1f (same change as balance-direction bug)
- Root cause: SAME as the balance-direction bug. Not an RLS/query issue — receiver has read/update access via `settlements_select_pending`. Rows were missing purely because the old code never set `pending_for_user_id`/`receiver_account_pending` when the debtor created the split, so nothing matched `pendingSettlementsQuery`.
- Fix: the SettleUpDialog creditor-resolution change now populates the pending flags correctly.
- Test Log:
  1. 2026-07-04 — PASS — live build: B's Pending tab rendered both settlement rows and B confirmed the receiving account on each (`receiver_account_id` set, +credit applied).

### [P1] Settlement account direction fix — fixed 2026-07-04 (duplicate of balance-direction bug)
- Commit: 521ca1f
- Resolution: CONFIRMED same root cause as the balance-direction bug (SettleUpDialog keyed direction off `created_by` not the payer). Closed by the same change; no separate fix.
- Test Log:
  1. 2026-07-04 — PASS — verified together with the balance-direction bug (correct debit/credit on both accounts).

### [P1] Cache invalidation bug (missing accounts join) — fixed 2026-06-XX
- Commit: (not recorded)
- Test Log:
  1. 2026-06-XX — PASS — verified account labels showed correctly in incoming splits

### [P1] Payer category selection hidden on Other Paid splits — fixed 2026-06-XX
- Commit: (not recorded)
- Test Log:
  1. 2026-06-XX — PASS — category/sub-category now shown in Pending tab confirmation row

### [P1] Payer splits missing from Reports/History — fixed 2026-06-XX
- Commit: (not recorded)
- Test Log:
  1. 2026-06-XX — PASS — payer splits now appear under both Expense and Split filters

### [P1] Double balance deduction (app + Supabase trigger) — fixed 2026-06-XX
- Commit: (not recorded)
- Test Log:
  1. 2026-06-XX — PASS — deduction confirmed to happen only once

### [P1] Balance restoration on split delete — fixed 2026-06-XX
- Commit: (not recorded)
- Test Log:
  1. 2026-06-XX — PASS — all ten test cases passed (creator-or-payer permissions, settlement blocking, five delete cases, multi-participant notifications)
