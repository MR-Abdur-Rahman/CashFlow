// Shared bilateral-balance helpers. Used by the Split people list (split.tsx) and the
// group detail page (split-group.tsx) so a group member's balance is the FULL person-to-person
// net (all splits), not just the group-scoped amount.

// Resolve a split's payer to an auth user id (creator paid / a participant paid / a third party).
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
  const payerAuthId = getPayerAuthId(s);
  const myShareEntry = shares.find(
    (ss: any) =>
      myPersonIds.includes(ss.person_id) || ss.person?.linked_user_id === currentUserId,
  );
  if (payerAuthId && payerAuthId === currentUserId) {
    if (targetShareEntry) return Number(targetShareEntry.share_amount);
    if (creatorIsTarget) return total - sumShares;
  } else if (payerAuthId && targetLui && payerAuthId === targetLui) {
    if (myShareEntry) return -Number(myShareEntry.share_amount);
    if (s.created_by === currentUserId) return -(total - sumShares);
  }
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
