// Shared bilateral-balance helpers. Used by the Split people list (split.tsx) and the
// group detail page (split-group.tsx) so a group member's balance is the FULL person-to-person
// net (all splits), not just the group-scoped amount.

// Split rows arrive from Supabase joins loosely typed; keep that in one place rather than
// spreading `any` across each new signature.
type SplitRow = any; // eslint-disable-line @typescript-eslint/no-explicit-any
type TargetRef = { id?: string | null; linked_user_id?: string | null };

// A two-person split: one counterparty, no group. Its single split_shares row IS the bilateral
// amount (the other side's line), not that person's slice of a bigger bill — which is why "I paid"
// renders as "You lent <that row>". Multi-person and group splits instead record one row per
// participant, leaving the creator's own portion implicit as total − Σ shares.
export function isIndividualSplit(split: SplitRow): boolean {
  return split?.type !== "group" && ((split?.split_shares ?? []) as unknown[]).length <= 1;
}

// Is the split's payer the current user?
export function payerIsUser(
  split: SplitRow,
  currentUserId: string | null,
  myPersonIds: string[],
): boolean {
  if (!currentUserId) return false;
  if (split.paid_by === "me") return split.created_by === currentUserId; // "me" = the creator
  if (split.paid_by_person_id && myPersonIds.includes(split.paid_by_person_id)) return true;
  return getPayerAuthId(split) === currentUserId;
}

// Is the split's payer `target`?
//
// The person-id comparison is what makes UNLINKED local contacts work: they have no auth identity,
// so getPayerAuthId can only ever return null for them and every split they paid used to be
// misread as third-party-paid and silently dropped from the balance.
//
// Comparing ids is sound because on a split I created, paid_by_person_id and target.id are both
// rows in MY contact list. On an incoming split they belong to the creator's list and won't match —
// but an incoming split only exists if its creator is a linked CashFlow user, which is exactly the
// case the auth-id fallback below covers.
export function payerIsTarget(split: SplitRow, target: TargetRef): boolean {
  const targetLui = target?.linked_user_id ?? null;
  if (split.paid_by === "me") return !!targetLui && split.created_by === targetLui;
  if (split.paid_by_person_id && target?.id && split.paid_by_person_id === target.id) return true;
  const auth = getPayerAuthId(split);
  return !!auth && !!targetLui && auth === targetLui;
}

// Resolve a split's payer to an auth user id. Only meaningful for linked CashFlow users — returns
// null for unlinked local contacts, so prefer payerIsUser/payerIsTarget when a known counterparty
// is in hand. Still the right tool for spotting a genuine third-party payer.
export function getPayerAuthId(split: any): string | null {
  if (split.paid_by_person_id) {
    const ps = (split.split_shares ?? []).find(
      (ss: any) => ss.person_id === split.paid_by_person_id,
    );
    if (ps?.person?.linked_user_id) return ps.person.linked_user_id;
  }
  if (split.paid_by === "me") return split.created_by; // "me" always means the creator
  if (split.paid_by) {
    const m = (split.split_shares ?? []).find(
      (ss: any) => ss.person?.name === split.paid_by || ss.person_name === split.paid_by,
    );
    if (m?.person?.linked_user_id) return m.person.linked_user_id;
  }
  return null;
}

// One split's signed contribution to the bilateral balance with `target`:
//   + = target owes me (I paid, they have a share) ; − = I owe target (they paid, I have a share).
// Returns 0 for splits that don't involve the pair or were paid by a third party. This is the exact
// per-split logic bilateralBalance sums, exposed so callers can tell which splits back the net.
export function splitBilateralContribution(
  s: any,
  target: any,
  currentUserId: string | null,
  myPersonIds: string[],
): number {
  const targetLui = target.linked_user_id ?? null;
  const shares = (s.split_shares ?? []) as any[];
  const total = Number(s.total_amount);
  const sumShares = shares.reduce((a: number, sh: any) => a + Number(sh.share_amount), 0);
  const creatorIsTarget = !!targetLui && s.created_by === targetLui;
  const targetShareEntry = shares.find(
    (ss: any) =>
      (targetLui && ss.person?.linked_user_id === targetLui) || ss.person_id === target.id,
  );
  if (!creatorIsTarget && !targetShareEntry) return 0;
  const myShareEntry = shares.find(
    (ss: any) =>
      myPersonIds.includes(ss.person_id) || ss.person?.linked_user_id === currentUserId,
  );
  if (payerIsUser(s, currentUserId, myPersonIds)) {
    if (targetShareEntry) return Number(targetShareEntry.share_amount);
    if (creatorIsTarget) return total - sumShares;
  } else if (payerIsTarget(s, target)) {
    if (myShareEntry) return -Number(myShareEntry.share_amount);
    // Two-person split: the counterparty's single row is the whole bilateral amount, so I owe it
    // outright. total − sumShares would be 0 here (their row already carries the full total) —
    // that formula only describes an implicit creator share on a multi-participant split.
    if (isIndividualSplit(s) && targetShareEntry) {
      return -Number(targetShareEntry.share_amount);
    }
    if (s.created_by === currentUserId) return -(total - sumShares);
  }
  // Neither of us paid — a genuine third party (only reachable on group/multi splits). Skipped.
  return 0;
}

// Bilateral net "bin" balance between the current user and a target contact:
//   net = Σ (gross bilateral split debts) − Σ (settlements between us, signed by money direction).
// Positive = target owes me; negative = I owe target. Third-party-paid splits are skipped.
// `settlements` is the flat list of the viewer's settlements (splitBalancesQuery.settlements), each
// with `person:person_id(id, linked_user_id, name)`. `cutoff` (a settlement created_at) makes it a
// "net as of" — only settlements up to and including that instant count (for the running net).
export function bilateralBalance(
  splits: any[],
  settlements: any[],
  target: any,
  currentUserId: string | null,
  myPersonIds: string[],
  cutoff?: string,
): number {
  const targetLui = target.linked_user_id ?? null;
  let net = 0; // + = target owes me

  // 1) GROSS bilateral split debts (no settlement subtraction — settlements are handled below).
  for (const s of splits) {
    net += splitBilateralContribution(s, target, currentUserId, myPersonIds);
  }

  // 2) SETTLEMENTS between me and target (the bin's payments). Money flows debtor→creditor; a
  // payment reduces the debtor's debt. creditorIsTarget → I paid the target (I owe less) → + ;
  // otherwise the target paid me → they owe less → − .
  for (const st of settlements) {
    if (cutoff && String(st.created_at ?? "") > cutoff) continue;
    const settler = st.created_by;
    const cpUid = st.person?.linked_user_id ?? null; // settler's counterparty auth id
    const settlerIsMe = settler === currentUserId;
    const betweenUs = settlerIsMe
      ? st.person_id === target.id || (!!targetLui && cpUid === targetLui)
      : !!targetLui && settler === targetLui && cpUid === currentUserId;
    if (!betweenUs) continue;
    const creditorIsTarget = settlerIsMe ? !st.settler_is_creditor : !!st.settler_is_creditor;
    net += (creditorIsTarget ? 1 : -1) * Number(st.amount ?? 0);
  }
  return net;
}

// The running NET balance between the current user and a settlement's counterparty, as of that
// settlement (viewer-relative: + = the other party owes you, − = you owe). Used so every settlement
// row shows the same "Still lent / Still owes" net — the newest row equals the balance card.
export function settlementNetAfter(
  splits: any[],
  settlements: any[],
  settlement: any,
  currentUserId: string | null,
  myPersonIds: string[],
): number | null {
  // The counterparty relative to the current user: my contact if I recorded it, else the recorder.
  let target: { id?: string; linked_user_id?: string | null } | null = null;
  if (settlement.created_by === currentUserId) {
    target = {
      id: settlement.person_id,
      linked_user_id: settlement.person?.linked_user_id ?? null,
    };
  } else {
    target = { id: undefined, linked_user_id: settlement.created_by };
  }
  if (!target.id && !target.linked_user_id) return null;
  return bilateralBalance(
    splits,
    settlements,
    target,
    currentUserId,
    myPersonIds,
    settlement.created_at,
  );
}
