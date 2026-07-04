# CashFlow Bug List

## Open

### [P1] Settlement payer's balance direction reversed
- Scope: multi-user-sync
- Severity: blocking
- Users involved: A, B (any settling pair)
- Steps to reproduce:
  1. User A owes User B money (existing split debt).
  2. User A settles up with User B via the Settle Up flow.
  3. Check both users' balances after settlement.
- Expected: Payer's (User A's) balance owed should decrease by the settled amount.
- Actual: Balance direction is reversed — it increases (or moves the wrong way) instead of decreasing. Happens on both settlement creation and settlement deletion.
- Added: 2026-07-04
- Root cause (2026-07-04): SettleUpDialog set `pending_for_user_id` from `split.created_by` instead of the split's actual payer (creditor). When the creator is the debtor (created a split someone else paid), the trigger `update_account_balance_on_settlement` misreads the settlement as a creditor receipt (+1) and reverses the account direction. Same root cause as #5 below.
- Fix (2026-07-04): resolve creditor from `paid_by`/`paid_by_person_id` in SettleUpDialog.tsx. Implemented, typecheck clean — NOT yet deployed/tested. Existing prod settlement needs a one-off balance repair.
- Test Log: (none yet — awaiting deploy)

### [P1] Settlement pending rows missing from receiver's Pending tab
- Scope: multi-user-sync
- Severity: blocking
- Users involved: A, B (any settling pair)
- Steps to reproduce:
  1. User A creates a settlement paying User B.
  2. User B opens their Pending tab.
- Expected: The settlement should appear as a pending row for User B to confirm/see.
- Actual: Nothing appears — the row is missing entirely.
- Added: 2026-07-04
- Test Log: (none yet)

### [P1] Account type filtering broken on Pending tab dropdowns
- Scope: single-user
- Severity: major
- Users involved: TBD — reproduce with one user first
- Steps to reproduce:
  1. Go to Pending tab, open the account selector dropdown for a settlement.
  2. Select a payment method (cash/bank/e-wallet).
- Expected: Dropdown should only show accounts matching that type.
- Actual: Filtering doesn't work — shows unrelated account types too, or doesn't filter at all.
- Added: 2026-07-04
- Test Log: (none yet)

### [P1] Split edit corruption bug
- Scope: TBD — confirm single-user vs multi-user-sync before diagnosing
- Severity: blocking
- Users involved: TBD
- Steps to reproduce: TBD — re-confirm exact steps and corrupted fields before investigating.
- Expected: Editing a split should update only the intended fields, cleanly.
- Actual: Split data becomes corrupted after edit (exact symptoms need re-confirmation).
- Added: 2026-07-04
- Test Log: (none yet)

### [P1] Settlement account direction fix
- Scope: multi-user-sync
- Severity: blocking
- Users involved: A, B
- Steps to reproduce: TBD — likely overlaps with the balance-direction bug above; confirm whether this is the same root cause or a separate account-crediting issue.
- Expected: The correct account (payer's or receiver's) should be debited/credited appropriately during settlement.
- Actual: Wrong account direction — needs reproduction to confirm exact mismatch.
- Added: 2026-07-04
- Resolution (2026-07-04): CONFIRMED same root cause as #1 (SettleUpDialog keyed direction off `created_by` not the payer). Fixed by the same SettleUpDialog change. Verify alongside #1.
- Test Log: (none yet — awaiting deploy)

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
