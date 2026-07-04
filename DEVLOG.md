# CashFlow Development Log

This file tells the *story* of each bug — the problem, the reasoning, and how it was actually built. `BUGS.md` tracks status and test results; this file explains the "why" and "how" behind them.

## In Progress

(none)

## Completed

### [P1] Settlement payer's balance direction reversed (also closed [P1] #5 Settlement account direction + [P1] #2 Pending rows missing) — 2026-07-04
**Symptom.** When User A settles a debt to User B, A's account balance moves the wrong way — it *increases* instead of decreasing (and reverses the same way on settlement delete).

**Diagnosis.** Account balance for settlements is trigger-driven by `update_account_balance_on_settlement`, which picks the sign from `pending_for_user_id`:
- set → settler is the DEBTOR paying out → sign −1 (account decreases)
- null → settler is the CREDITOR recording a receipt → sign +1 (account increases)

`SettleUpDialog` set that flag from **`split.created_by`** — it assumed the split's *creator* is always the creditor being paid. But the creditor is whoever **paid** the split (`paid_by` / `paid_by_person_id`), not who created the row. A user can create a split that *someone else paid*, which makes the creator the **debtor**. In that case `created_by === settler`, so the code produced `receiverId = null` → `pending_for_user_id = null` → the trigger applied **+1**, increasing the payer's account when it should have decreased. Same misclassification reverses the restore on delete.

Confirmed against production: the one live settlement was on a split where `created_by = A` but `paid_by_person_id = B` (B is the creditor). It was written with `pending_for_user_id = null`, so the trigger credited A +500 for a payment A actually made. This is the same root cause as the separately-filed #5 "Settlement account direction fix".

**Fix.** In `SettleUpDialog`, resolve the creditor from the split's payer instead of its creator: read `paid_by`, `paid_by_person_id`, and the payer person's `linked_user_id`; treat it as a remote debtor-payment (`pending_for_user_id = creditor`) only when the creditor is a *different* linked user than the settler; otherwise leave it null (settler is the creditor recording a receipt). Trigger sign then comes out correct in every direction. Typecheck clean; not yet deployed/tested. Legacy caveat: splits with a `paid_by` name but no `paid_by_person_id` still resolve to null (unchanged behavior) — modern splits always set `paid_by_person_id`.

**Deployed.** Committed `521ca1f`, pushed to `main` (Vercel auto-deploy).

**Data repair (done 2026-07-04).** The one pre-existing broken settlement (`f1db5e23`, split `cbbf7168`, User A → User B, LKR 500) was corrected in place:
- Flipped `receiver_account_pending=true`, `pending_for_user_id=B` on the row. `trg_account_balance_on_settlement` fires on UPDATE (old_sign +1 → new_sign −1), so it removed the erroneous +500 and applied the correct −500: A's **Cash** account 50,500 → **49,500**.
- `trigger_notify_settlement_account_selection` is INSERT-only, so it did not re-fire; inserted B's `settlement_account_selection` notification manually (mirroring the trigger's message format). B will now be prompted to pick the receiving account; on confirm, `settlement_receiver_balance` credits +500 there.

**Bug #2 (Pending rows missing from receiver's tab) — same root cause.** Separately filed, but it's the receiver-facing half of this bug. Checked the RLS policies on `settlements`: `settlements_select_pending` (USING `pending_for_user_id = auth.uid()`) and `settlements_update_pending` already give the receiver full read + confirm access — so it was never an RLS or query defect. The rows were missing purely because the old code never set `pending_for_user_id`/`receiver_account_pending` when the debtor created the split, so nothing matched `pendingSettlementsQuery`. The creditor-resolution fix populates those flags, so the rows now appear. No separate code change.

**Verification (live build, 2026-07-04).** User exercised the deployed fix with real accounts:
- New settlement `66f0f232` (LKR 200, A→B) was written with `pending_for_user_id = B` (would have been null under the old code) — #1 fixed.
- User B's Pending tab rendered both settlement rows and B confirmed the receiving account on each (`receiver_account_id` set) — #2 fixed.
- Balances reconcile exactly: A's Cash **49,300** (49,500 − 200), B's Cash **48,700** (48,000 + 500 + 200). Money moved A→B by 700 in the correct direction — #1/#5 fixed.

**Completed.** #1, #2, and #5 all closed by commit `521ca1f` plus the one-off data repair. See BUGS.md test logs.

### [P1] Account type filtering broken on Pending tab dropdowns — already fixed (verified 2026-07-04)
**Report.** Pending-tab account dropdown showed all accounts regardless of the settlement's payment method.

**Finding — no bug in current code.** The receiver row (`PendingSettlementRow`) already filters by `methodToAccountType[settlement.method]`, and the payer-side `SettleUpDialog` does the same. The value domains line up (account types `cash`/`bank`/`e-wallet` = mapping targets; methods `cash`/`bank_transfer`/`e-wallet` = mapping keys), and `accountsQuery` returns `type`. The symptom was an artifact of homogeneous data: every account on the profile is `cash` and every settlement is `cash`, so all accounts legitimately pass the cash filter — indistinguishable from "unfiltered." The report predates the filter being implemented. Confirmed already-fixed with the user; no code change. To visibly prove it, add a non-cash account and it will be excluded from a cash settlement's dropdown.

### [P1] Split edit corruption — individual split flips to "people split", name shown twice — 2026-07-04
**Symptom.** Editing an individual split (the user changed only the amount) turned it into a "people" split whose row showed the counterpart's name twice.

**Diagnosis.** Two findings combined:
1. `SplitDirectRow` decides person-vs-people purely by `shares.length` (`> 1` ⇒ people). So anything that adds a second share row flips the display.
2. `split_shares` RLS is asymmetric: `split_shares_insert` WITH CHECK `auth.uid() IS NOT NULL` (anyone), but `split_shares_delete`/`_update` restricted to the split's creator. The home `EditSplitSheet` regenerated shares by delete-then-insert. When the **payer** (allowed to edit, but not the creator) saved, the delete silently matched 0 rows and the insert added a fresh share → duplicate shares → people-split display + doubled name + double-counted debt. The person-detail and group-detail edit sheets had the mirror bug: they never wrote shares at all, so amounts went stale after an amount edit. Three divergent `EditSplitSheet` copies, three behaviors.

**Decisions (from the user).** Merge the three edit copies into one; lock "who paid" after creation (delete + recreate if wrong); allow editing even when settlements exist; auto-adjust the payer's account by the amount delta.

**Fix.** New `update_split` SECURITY DEFINER RPC (migration `add_update_split_rpc`), mirroring the existing `delete_split`:
- Permission: creator OR payer (payer resolved from `paid_by`/`paid_by_person_id` → `linked_user_id`).
- Reconciles shares **in place by person** — updates existing rows, inserts only genuinely new participants, deletes departed ones. Preserving share ids means settlements that reference `split_share_id` stay linked (critical: the live split already had a settlement on its share). This also structurally prevents the duplicate-on-payer-edit bug, since the definer bypasses the creator-only RLS.
- Syncs the linked expense transaction's amount/category; `trg_account_balance_on_transaction` reverses the old amount and applies the new, so the payer's account auto-adjusts by the delta with no manual balance math.
- Who-paid, account, and the pending/account fields are deliberately left untouched (locked).

Client: merged the three `EditSplitSheet`s into the single exported one in `home.tsx` (now RPC-backed, with the "Who paid?" control replaced by a read-only locked indicator and the account selector removed). `split-person.tsx` and `split-group.tsx` deleted their local copies + private pickers and import the shared component.

**Verification (DB-level, transactions rolled back so production was untouched).** Impersonating each role via `request.jwt.claims`: creator edit → in place, `share_count=1`, share id preserved; **payer edit → permitted, `share_count=1` (no duplicate)** — the exact bug, gone; unrelated user → rejected ("Only the creator or payer can edit this split"). Typecheck + `vite build` clean. Live UI verification across all three split types (creator + payer) still to be done on the deployed build.

### [P2] Divergent transaction-edit copies — History couldn't edit income source — 2026-07-04
**Why looked at.** After the split-edit merge, the user asked whether the same "Copy A/B/C across pages" problem existed for normal transactions (income / expense / transfer).

**Finding.** Two transaction-edit components: `EditTxSheet` (home.tsx, used by home / reports / account-detail) and a second `EditTransactionSheet` (settings-history.tsx). The History copy was a stale fork missing the income "From" (person/source) UI and never writing `income_source_type` / `income_person_id` / `income_source_text`. Effect: from the History page you could not edit an income transaction's source, though you could everywhere else. No data corruption — unlike splits, transactions have no share sub-table (so no delete-then-insert) and are single-user (so no cross-user RLS asymmetry); the transaction UPDATE balance trigger handles account deltas correctly in both copies.

**Fix.** Deleted the History copy and pointed it at the shared `EditTxSheet` (same merge approach as the split sheets). Removed the now-dead imports. Verified the shared sheet's `["transactions"]` invalidation prefix-matches the history list key `["transactions", {}]`, so the list still refreshes. Typecheck + build clean. All transaction editing now flows through one component.

### [P2] Settle Up redesign — net-balance-only + FIFO allocation — 2026-07-04
**Goal.** The Settle Up sheet forced you to tick individual splits and set a per-split amount. The user wanted it net-balance-only: just settle the overall amount owed to a person.

**Design.** Replaced the checkbox list + per-split amount inputs with a single "Amount to settle" field that defaults to the total owed (sum of the person's remaining unsettled shares), is editable for a partial payment, and is capped at the owed total. On confirm the amount is allocated across the unsettled shares **oldest-first (FIFO)** — one settlement row per share consumed, marking each share settled when fully covered. This intentionally also implements the separately-filed FIFO-allocation item.

Kept the per-share settlement model rather than a single detached settlement row: the balance math (`settledOf` by `split_share_id`), `shareRemaining`, the `settlement_*` triggers, and `delete_settlement` all key off `split_share_id`, so a detached model would have been a large ripple. The FIFO loop reuses the creditor-direction resolution from the settlement-direction fix (resolve the payer from `paid_by`/`paid_by_person_id`, set `pending_for_user_id` only for a remote creditor), so account direction stays correct per allocation.

Both entry points are unchanged: split-person passes `unsettledItems` (all the person's unsettled shares), split-group passes a legacy single `share`/`split`; both funnel into the same net-owed list. Typecheck + build clean.

**Known tradeoff.** A net payment spanning several splits still writes one settlement row per split consumed, so a debtor-payment can raise one account-selection prompt per distinct split (the notify trigger dedupes per split). Acceptable for now; a single-row model would need the detached-settlement data change above.

### [P2] Symmetric Settle Up — either party records, correct account direction — 2026-07-04
**Goal.** Both the debtor and the creditor can open Settle Up. Whoever records it sets their own account now; the other party is prompted to record theirs later. Amount is red when the viewer owes (paying out), green when owed (receiving).

**What was broken.** The old model was asymmetric: `pending_for_user_id` set ⇒ the settler was assumed to be the debtor (account debited) and the creditor was prompted (credited); `pending` null ⇒ the settler was the creditor (credited) and *nobody* was prompted. So when the creditor recorded a payment, their account went up but the debtor was never prompted and their account never went down.

**Fix (migration `settlement_symmetric_direction`).** Added `settler_is_creditor boolean` to `settlements` and rewrote the two balance triggers to key the sign off it instead of off `pending_for_user_id`:
- `update_account_balance_on_settlement` (settler's own `account_id`): `+` when settler is creditor (receipt), `−` when debtor (payment).
- `settlement_receiver_balance` (prompted party's `receiver_account_id`): the OPPOSITE sign — so a prompted debtor's account is *debited*, a prompted creditor's is *credited*.
- `notify_settlement_account_selection`: message now says "which account the payment was made from" (debtor) vs "received the payment" (creditor).
Backfilled `settler_is_creditor = (pending_for_user_id IS NULL)`, which reproduces every existing row's previous sign exactly, so no live balance moved. Verified before applying with a rolled-back 4-phase test against real accounts (no-op update, creditor-records insert, debtor-confirms update, delete) — all deltas correct, existing balances untouched.

**Client.** `SettleUpDialog` gained `personLinkedUserId` + `netBalance` props: it colors the amount red/green from the net direction, computes `settler_is_creditor` per split (creditor = whoever paid), and sets `pending_for_user_id` to the other party in BOTH directions (so the debtor is prompted in the creditor-records case). `PendingSettlementRow` reads `settler_is_creditor` to show the prompted party's true side — an outflow (red "−", "You paid X", "will be deducted from") when they're the debtor, an inflow otherwise. Net balance still reduces immediately for both users; account selection only records where the money moved.

### [P2] Group detail page reworked — person-style split rows + full bilateral member balances — 2026-07-04
**Goal (from the user).** Make the group detail page's history list identical to the person detail page's split rows (same `SplitDirectRow` style, swipe edit/delete), with NO settlement rows, no "X/3 settled" count, and no per-row Settle up link (settling is done from each member's person page). And change the member-balance summary to show each member's FULL bilateral net with the viewer (all splits, same number as the person page) — not the group-scoped balance.

**Build.**
- Extracted `bilateralBalance` + `getPayerAuthId` from split.tsx into `src/lib/balance.ts` (shared).
- Member summary: for each group member (self excluded), `bilateralBalance(allSplits, member, currentUserId, myPersonIds)` over `splitBalancesQuery` (all of the viewer's own+incoming splits) — so a member's number matches exactly what the person page shows. Each row links to `/split/person/:id`, green +/red −.
- History list: `splitBalancesQuery` splits filtered to `group_id`, enriched locally with `_myPersonId` (viewer's share) and the group name, rendered with `SplitDirectRow` inside `SwipeRow` (creator-or-payer). Added `creator`/`accounts` joins to `splitBalancesQuery` so the rows render fully.
- Removed the old group-scoped `memberBalances`, the settled-count line, the per-split Settle up link, and the group-page `SettleUpDialog`.

**Behavior note.** The group history now shows only splits the **viewer participates in** (the data source is the viewer's own+incoming splits), not every split ever attached to the group. Consistent with the "your view" framing. Typecheck + build clean.

(Finished bugs move here permanently, in the order they were completed. Never delete or shorten an entry — this is your permanent record of how CashFlow was actually built.)

## Queue

(Mirrors the priority order in BUGS.md's Open section — titles only, for a quick glance. Full detail lives in BUGS.md until work starts, at which point it gets a full entry above under "In Progress".)
