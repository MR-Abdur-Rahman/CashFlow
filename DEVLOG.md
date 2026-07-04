# CashFlow Development Log

This file tells the *story* of each bug — the problem, the reasoning, and how it was actually built. `BUGS.md` tracks status and test results; this file explains the "why" and "how" behind them.

## In Progress

### [P1] Settlement payer's balance direction reversed (also fixes [P1] #5 Settlement account direction)
**Symptom.** When User A settles a debt to User B, A's account balance moves the wrong way — it *increases* instead of decreasing (and reverses the same way on settlement delete).

**Diagnosis.** Account balance for settlements is trigger-driven by `update_account_balance_on_settlement`, which picks the sign from `pending_for_user_id`:
- set → settler is the DEBTOR paying out → sign −1 (account decreases)
- null → settler is the CREDITOR recording a receipt → sign +1 (account increases)

`SettleUpDialog` set that flag from **`split.created_by`** — it assumed the split's *creator* is always the creditor being paid. But the creditor is whoever **paid** the split (`paid_by` / `paid_by_person_id`), not who created the row. A user can create a split that *someone else paid*, which makes the creator the **debtor**. In that case `created_by === settler`, so the code produced `receiverId = null` → `pending_for_user_id = null` → the trigger applied **+1**, increasing the payer's account when it should have decreased. Same misclassification reverses the restore on delete.

Confirmed against production: the one live settlement was on a split where `created_by = A` but `paid_by_person_id = B` (B is the creditor). It was written with `pending_for_user_id = null`, so the trigger credited A +500 for a payment A actually made. This is the same root cause as the separately-filed #5 "Settlement account direction fix".

**Fix.** In `SettleUpDialog`, resolve the creditor from the split's payer instead of its creator: read `paid_by`, `paid_by_person_id`, and the payer person's `linked_user_id`; treat it as a remote debtor-payment (`pending_for_user_id = creditor`) only when the creditor is a *different* linked user than the settler; otherwise leave it null (settler is the creditor recording a receipt). Trigger sign then comes out correct in every direction. Typecheck clean; not yet deployed/tested. Legacy caveat: splits with a `paid_by` name but no `paid_by_person_id` still resolve to null (unchanged behavior) — modern splits always set `paid_by_person_id`.

**Outstanding.** (1) The existing production settlement already applied the wrong-direction +500 and never created a receiver-pending row for B, so A's account is off by 1000 from correct — needs a one-off data repair, pending user go-ahead. (2) Not yet committed/pushed (deploy is outward-facing).

## Completed

(Finished bugs move here permanently, in the order they were completed. Never delete or shorten an entry — this is your permanent record of how CashFlow was actually built.)

## Queue

(Mirrors the priority order in BUGS.md's Open section — titles only, for a quick glance. Full detail lives in BUGS.md until work starts, at which point it gets a full entry above under "In Progress".)
