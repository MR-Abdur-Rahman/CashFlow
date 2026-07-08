# CashFlow Bug List

## Open

### [P3] Scheduled transactions — true OS push (buzz while app fully closed)
- The server cron already flags due schedules and drops an in-app `scheduled_due` bell notification (migration `scheduled_due_cron`), and the client shows a live toast + home badge + confirm prompt. What's missing is OS-level push so the phone alerts while the app is fully closed.
- Needs (external, can't be done without user setup): a Firebase/FCM project + credentials (store in Supabase Vault), the `@capacitor/push-notifications` plugin (→ native APK rebuild via the Actions workflow), a device-token table + client token registration on login, and an edge function to send FCM. The cron is structured so this is one `pg_net` call per due row (pg_net already available).
- Blocked on: user providing Firebase/FCM setup.

## Fixed

### [Feature] Scheduled (recurring) transactions + server cron — 2026-07-08
- Commits: 74c15bf · 27e5d3e · 69a1541 · 5a0c630 · 14a85fd · bc20c71 · Migrations: scheduled_transactions, scheduled_due_cron. Full story in DEVLOG.md.
- Recurring income/expense/transfer; confirm-on-open posting (insert → balance trigger); leap-safe day-of-month; Settings → Scheduled Transaction (swipe edit/delete); home "N due" badge; pg_cron hourly job flags due + inserts a `scheduled_due` bell notification.
- Test Log:
  1. 2026-07-08 — build/typecheck clean; Vercel READY; `mark_scheduled_due()` runs clean and the `mark-scheduled-due` cron job is registered/active (hourly). Live end-to-end confirm/skip verification pending user.

### [Chore] Regenerated Supabase types + fixed exposed bugs — 2026-07-08
- Commit: bd87bf4
- Regenerated `types.ts` (now covers `scheduled_transactions` + the cycle's new columns/RPCs); error count dozens → ~11 (rest pre-existing nullability). Exposed + fixed: QR connections storing empty phones (read locked `profile.phone_number` → now `my_phone()` RPC), Settings-header phone same, and a missing `cn` import in `SettlementEditSheet` (latent crash).
- Test Log:
  1. 2026-07-08 — build/typecheck clean; Vercel READY. Note: QR links created since the phone-column lock captured no phone (data caveat); new links now carry it. Live QR reconnect check pending user.

### [Feature] Notifications page revamp — 2026-07-07 → 07-08
- Commits: 85d206b · 46200d2
- Renamed toggles (Split/Settlement Notification); AM/PM `TimePicker` replaces the native time input; merged Split and Settlement toast toggles; renamed Account selection (already gates split+settlement); removed Delete attempt + Payment reminder rows.
- Test Log:
  1. 2026-07-08 — build/typecheck clean; Vercel READY. Live check pending user.

### [Feature] Profile-visibility control + app-wide enforcement — 2026-07-07
- Commits: c70cc62 (row + DB) · 0e7ba2a (enforcement) · Migration: profile_visibility
- `contact_profiles()` RPC + `useContactVisibility()` hook; `contactDisplay`/`splitRowAvatar` fall back to local name + blank avatar when a contact hides their profile; wired through all split/settlement/contact surfaces.
- Caveat: display-level enforcement (app respects the setting everywhere) — the name/avatar columns aren't hard-locked like phone (would break joins), so a determined API caller could still read them.
- Test Log:
  1. 2026-07-07 — build/typecheck clean; Vercel READY. Live two-user hide/show verification pending.

### [Feature] Versioning + native update prompt + Tutorial & Update page — 2026-07-07
- Commits: f766754 · e9674e8 · 53c927b · b61a5ae · 02aeffc · b22349e
- version.json auto-bump workflow → APK versionName; NativeUpdateModal (login-gated) compares baked vs published; UpdateAvailableDialog reused by the manual check on /settings/tutorial.
- Test Log:
  1. 2026-07-07 — build clean; Vercel READY; published app-version 1.1.0. Native update-popup behavior verified only on old-vs-new by design.

### [Feature] Native Android app (Capacitor, remote-URL) + device contacts — 2026-07-07
- Commits: b328c5f · fdeb727 · 1215c20 · cded11a · 9ecae6e · 76a2cd4 · edde5ee · 476dfea · 97425ea · a247fe1 · f6d0c04 · dc04460 · 71ea95c
- Capacitor 8 shell pointing at the live URL; GitHub Actions APK build; device-contacts Invite; permissions onboarding; status-bar/safe-area/icon/splash; WRITE_CONTACTS added.
- Test Log:
  1. 2026-07-07 — web build clean; APK builds via Actions. Native on-device verification (contacts, status bar, update popup) by user.

### [Feature] Reminder system overhaul (CashFlow + WhatsApp/Telegram, direction-aware) — 2026-07-07
- Commits: 07a3092 · 6912226 · e4a2e6c · 9e71631 · fc1afe7 · ff1018a · bfa9e9a · b3bac5b
- In-app + one external channel; direction-aware messages listing only the net-direction splits; method picker + remembered preference; person-detail reminder button replaces Edit.
- Test Log:
  1. 2026-07-07 — build clean; Vercel READY. Live send-per-channel check pending user.

### [Feature] Phone-number privacy (locked column + RPCs) — 2026-07-07
- Commits: adff6d3 · cdf314b · 5c22c43
- `profiles.phone_number` SELECT revoked; own via `my_phone()`, contacts via `contact_phones()`; `profileQuery` switched to explicit columns (the lock broke `select("*")`).
- Test Log:
  1. 2026-07-07 — build/typecheck clean (as authenticated role); Vercel READY.

### [Fixes] Cross-user display + date-grouping cluster — 2026-07-07
- Commits: 5776b31 (split-row avatar linked-detection) · b8717df (settlement paid-by-user shows as expense, not green) · 01d9a79 (payer name on receiver's settlement-income drill; was "Unknown → You") · 3674a8c (group History by LOCAL date, not UTC).
- Test Log:
  1. 2026-07-07 — build clean; Vercel READY. b8717df/01d9a79 diagnosed via bug-investigator/bug-fixer agents. Live verification pending user.

### [Feature] Settings/Manage/Accounts rework + UI batch — 2026-07-06
- Representative commits: 444b776 · 636e31d · 54a2fac · 9972b3e · 6b8ac16 · b948b2c · 2191820 · 02f8e79 · be64f2c
- Settings hub rework; read-only Account view + Edit page + Delete→Privacy (email-OTP code, Resend deferred); Manage Accounts tab; swipe edit/delete on Accounts and removed elsewhere per user; public avatars bucket; sub-category icons; money-color tokens; SplitDirectRow extracted.
- Test Log:
  1. 2026-07-06 — build clean; Vercel READY; iterated live with user across the batch.

### [P3] History page filters — DONE 2026-07-05
- Resolved by folding all filtering into the search box + type chips + period (no separate dropdowns).
- "Daily / Today" period option added to the shared period selector (commit 24c20e1) — History, person, and group pages.
- Added a dedicated "settlement" type chip ("split" shows splits only; "settlement" shows settlements only).
- Search box now matches person NAME + MOBILE NUMBER (by contact id + linked user id), ACCOUNT, and CATEGORY across transactions, splits, and settlements (commits 26b4b4d, c713c91). A short-lived person-filter dropdown was removed per user preference.
- Test Log:
  1. 2026-07-05 — build/typecheck clean; live UI test pending user.

### [Feature] Settlement "bin" model + closes [P3] Auto-settlement — 2026-07-05
- Settlements are now person-to-person payments against the NET (not per-split; no FIFO). Net = Σ gross split debts − Σ signed settlements. Full story + phase commits in DEVLOG.md.
- **Closes [P3] Auto-settlement:** opposing debts now offset automatically inside the net (the bin IS the net), so no separate auto-cancel feature is needed.
- Commits: 8ae9d29 (net math) · 904a731 (settle) · 79e71a8 (direction/delete) · 71a98e7 (cleanup) · 5ca82ab (reports) · 8f6d570 (reports income direction) + DB migrations (person_id, delete_settlement, notification link/cleanup, drop is_settled trigger).
- Test Log:
  1. 2026-07-05 — PASS — verified on live data: bin settlements (null split refs), net A owes B 2800, balances reconcile, pending prompt + receiver confirm + delete all fire; account-selection notification auto-clears on confirm/delete; orphan removed.
  2. 2026-07-05 — PASS — Reports settlement income = money actually received (creditor side, either direction), attributed to the counterparty (commit 8f6d570).
  3. 2026-07-05 — PASS (DB sim, rolled back) — LOCAL person settlement moves only the recorder's account, no pending flow / 0 notifications. GROUP split feeds each member's bilateral bin (B & C each owe A 1000) and the full A→B net nets group + individual + settlements to −2200.

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
