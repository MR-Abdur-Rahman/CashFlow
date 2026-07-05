# CashFlow Bug List

## Open

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
- Partial (2026-07-04): "Daily / Today" period option added to the shared period selector (commit 24c20e1) — applies to History, person, and group pages. Remaining filter additions still TBD.
- Test Log: (none yet)

## Fixed

### [P3] Full split edit testing matrix — PASS 2026-07-05
- QA pass over the split-edit rework (update_split RPC + merged edit sheets). Covered: individual/people/group; creator edits + payer (non-creator) edits; amount / participants / category changes; who-paid locked; settlement linkage preserved; permission block for non-creator-non-payer; same edit from Home / person / group / reports / history.
- Test Log:
  1. 2026-07-05 — PASS — user ran the full matrix (sections 1–8), all pass. No duplicate shares, no individual→people flip, balances auto-adjust by the delta, who-paid locked, settlements stay linked.

### [P2] FIFO settle ordered by date only (same-day debts arbitrary) — fixed 2026-07-05
- Commit: a5b2f0d · File: src/components/SettleUpDialog.tsx
- Surfaced during the QA pass: a newer same-day debt (#3 TEST 19:23) got settled before an older same-day debt (the "Test" group split 18:31). The FIFO allocation sorted unsettled shares by `date` only, so same-day splits tied and the order was arbitrary.
- Fix: sort by `date`+`time` (`${date}T${time}`); carry the split `time` into `unsettledItems`. (Note: FIFO is per-direction — the viewer's payments settle their own oldest debts; the counterparty's payments settle theirs.)
- Test Log:
  1. 2026-07-05 — PASS (typecheck + build). Pending — live: settle across two same-day debts and confirm the earlier-time one is consumed first. Existing settlements are historical and won't re-order.

## Fixed

### [P2] Real-time sync for settlements — fixed 2026-07-04
- Commit: (this change) · File: src/hooks/useRealtimeSplits.ts
- Investigation: the `settlements` table was ALREADY in the `supabase_realtime` publication (replica identity `full`) and the client already subscribed to it in `useRealtimeSplits` (mounted app-wide in App.tsx). So events were broadcast and received. The gap: the settlements handler called `invalidateAll`, which only invalidated `["splits"]`/`["transactions"]`/`["accounts"]`/`["people"]`. The settlement-specific views use other keys — `["pending-settlements"]` (Pending tab), `["history-settlements"]` (History), `["pending-splits"]`, `["settlements"]` — which were never invalidated. So the person page updated live (nested under `["splits"]`) but the receiver's Pending tab didn't: they got the notification but the pending row didn't appear until a manual refresh.
- Fix: broadened `invalidateAll` to also invalidate `["settlements"]`, `["pending-settlements"]`, `["history-settlements"]`, `["pending-splits"]`.
- Test Log:
  1. 2026-07-04 — PASS (typecheck + vite build). Pending — live 2-user: A records a settlement → B's Pending tab shows the account-selection row without refresh; A deletes → it disappears live.

### [P2] Group member balance bugs + group split formatting/bilateral balances — fixed 2026-07-04
- Commit: 3da0762 (group detail rework)
- Covers both group P2s (member balances wrong; row formatting + bilateral-with-third-party-payer).
- Fix: reworked the group detail page. (1) Each member's summary balance is now the FULL bilateral net between the viewer and that member across ALL splits (via shared `bilateralBalance` over `splitBalancesQuery`) — identical to the person page — instead of a group-scoped share sum. Third-party-paid splits are correctly skipped for a bilateral pair. (2) The history list now renders the same `SplitDirectRow` rows as the person page (consistent formatting), swipe edit/delete (creator-or-payer). Extracted `bilateralBalance`/`getPayerAuthId` into `src/lib/balance.ts`.
- Test Log:
  1. 2026-07-04 — PASS (typecheck + vite build). Pending — live 3-user verification: create a group with A/B/C, add group splits with different payers, confirm each member row shows the correct bilateral net and rows format like the person page.

### [P2] Symmetric Settle Up — either party can record, correct account direction + red/green — fixed 2026-07-04
- Commit: c5a3490 · Migration: settlement_symmetric_direction
- Before: only the debtor could record a settlement. If the creditor recorded it, their account went up but the debtor was never prompted and their account never went down.
- Fix: added `settler_is_creditor` to settlements; the two balance triggers now key the sign off it (settler's own account: + creditor receipt / − debtor payment; prompted party's account: the opposite, on confirm). Backfilled as `(pending_for_user_id IS NULL)` so existing balances are unchanged — verified with a rolled-back 4-phase test (no-op/insert/confirm/delete all correct).
- Client: SettleUpDialog colors the amount red (you owe) / green (you're owed) from `netBalance`, sets `settler_is_creditor`, and prompts the OTHER party in both directions (passes `personLinkedUserId`). The Pending row shows the debtor's outflow (red "−", "You paid X", "deducted from") vs the creditor's inflow; notification wording is direction-aware.
- Test Log:
  1. 2026-07-04 — PASS (DB rolled-back): creditor records → creditor +500, debtor confirms → debtor −500, delete restores; existing rows untouched. Typecheck + build clean.
  2. Pending — live: as User B settle a debt A owes → confirm A gets the prompt and A's account goes down when A confirms; check red/green colors both ways.

### [P2] Settle Up redesign — net-balance-only (removes split checkboxes) + FIFO allocation — fixed 2026-07-04
- Commit: ffd518c (net-balance shown/settled corrected in fb0cac7)
- Also closes: [P2] FIFO settlement allocation (delivered by the same change).
- Change: SettleUpDialog no longer shows per-split checkboxes or per-split custom amounts. It shows the total owed and a single "Amount to settle" field (defaults to the full owed, editable for partial, capped at owed). On confirm it allocates the amount across the person's unsettled shares OLDEST-FIRST (FIFO), creating a settlement per share consumed and marking shares settled. Reuses the creditor-direction resolution from the settlement-direction fix, so account direction stays correct.
- Both callers unchanged: split-person (unsettledItems) and split-group (legacy single share) both funnel through the same net-owed list.
- Known tradeoff: a net payment spanning multiple splits still creates one settlement row per split consumed (so a debtor-payment can raise one account-selection prompt per distinct split). Acceptable; the notify trigger dedupes per split.
- Test Log:
  1. 2026-07-04 — PASS (typecheck + vite build). Pending — live: settle full and partial amounts; confirm FIFO order, balances, and the receiver's account-selection prompt.

### [P2] Duplicate transaction-edit sheet (History couldn't edit income source) — fixed 2026-07-04
- Commit: 9700eb88
- Found while auditing the same "divergent edit copies" problem for normal transactions (income/expense/transfer), after the split-edit merge.
- Two copies existed: `EditTxSheet` (home.tsx, used by home/reports/account-detail) and a lesser `EditTransactionSheet` (settings-history.tsx). The History copy omitted the income "From" (person/source) control entirely and never wrote `income_source_type`/`income_person_id`/`income_source_text` — so an income transaction's source could not be edited from History (no data corruption; transactions have no share sub-table and are single-user, so the split RLS-delete bug doesn't apply).
- Fix: deleted the History copy; History now imports the shared `EditTxSheet`. All transaction editing goes through one component. Cache key `["transactions"]` prefix-matches the history list's `["transactions", {}]`, so it still refreshes.
- Test Log:
  1. 2026-07-04 — PASS (typecheck + vite build) — single shared sheet compiles; income/expense/transfer branches intact.
  2. Pending — live check: edit an income's source from History.

### [P1] Split edit corruption (individual → "people split", name shown twice) — fixed 2026-07-04
- Commit: 011479b · Migration: add_update_split_rpc
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
