// Shared bilateral-balance helpers. Used by the Split people list (split.tsx) and the
// group detail page (split-group.tsx) so a group member's balance is the FULL person-to-person
// net (all splits), not just the group-scoped amount.

// Resolve a split's payer to an auth user id (creator paid / a participant paid / a third party).
export function getPayerAuthId(split: any): string | null {
  if (split.paid_by_person_id) {
    const ps = (split.split_shares ?? []).find((ss: any) => ss.person_id === split.paid_by_person_id);
    if (ps?.person?.linked_user_id) return ps.person.linked_user_id;
  }
  if (split.paid_by === "me") return split.created_by; // "me" always means the creator
  if (split.paid_by) {
    const m = (split.split_shares ?? []).find((ss: any) => ss.person?.name === split.paid_by || ss.person_name === split.paid_by);
    if (m?.person?.linked_user_id) return m.person.linked_user_id;
  }
  return null;
}

// Bilateral net balance between the current user and a target contact.
// Positive = target owes me; negative = I owe target. Third-party-paid splits are skipped.
// `cutoff` (a settlement created_at) makes it a "net as of" — only settlements up to and
// including that instant count, so it can produce the running net after any settlement.
export function bilateralBalance(splits: any[], target: any, currentUserId: string | null, myPersonIds: string[], cutoff?: string): number {
  let net = 0;
  const targetLui = target.linked_user_id;
  for (const s of splits) {
    const shares = (s.split_shares ?? []) as any[];
    const settlements = (cutoff
      ? (s.settlements ?? []).filter((x: any) => String(x.created_at ?? "") <= cutoff)
      : (s.settlements ?? [])) as any[];
    const total = Number(s.total_amount);
    const sumShares = shares.reduce((a: number, sh: any) => a + Number(sh.share_amount), 0);
    const settledOf = (ss: any) => !ss ? 0 :
      settlements.filter((x: any) => x.split_share_id === ss.id).reduce((a: number, x: any) => a + Number(x.amount), 0);

    // Only count splits where the target is actually involved.
    const creatorIsTarget = !!targetLui && s.created_by === targetLui;
    const targetShareEntry = shares.find((ss: any) =>
      (targetLui && ss.person?.linked_user_id === targetLui) || ss.person_id === target.id);
    if (!creatorIsTarget && !targetShareEntry) continue;

    const payerAuthId = getPayerAuthId(s);
    const myShareEntry = shares.find((ss: any) =>
      myPersonIds.includes(ss.person_id) || ss.person?.linked_user_id === currentUserId);

    // Implicit creator shares have no split_share row, so settlements on a bilateral split all land
    // on the other party's share. Subtract ALL settlements on the split for the implicit branches.
    const allSettledOnSplit = settlements.reduce((a: number, x: any) => a + Number(x.amount ?? 0), 0);
    if (payerAuthId && payerAuthId === currentUserId) {
      // I paid → target owes me their share (or their implicit creator share)
      if (targetShareEntry) net += Number(targetShareEntry.share_amount) - settledOf(targetShareEntry);
      else if (creatorIsTarget) net += (total - sumShares) - allSettledOnSplit;
    } else if (payerAuthId && targetLui && payerAuthId === targetLui) {
      // Target paid → I owe my share (or my implicit creator share)
      if (myShareEntry) net -= Number(myShareEntry.share_amount) - settledOf(myShareEntry);
      else if (s.created_by === currentUserId) net -= (total - sumShares) - allSettledOnSplit;
    }
    // Third party paid → skip
  }
  return net;
}

// The running NET balance between the current user and the settlement's counterparty, as of that
// settlement (viewer-relative: + = the other party owes you, − = you owe). Used so every settlement
// row on every page shows the same "Still lent / Still owes" net — the newest row equals the balance
// card. `allSplits` must be the viewer's full own+incoming splits (splitBalancesQuery), with
// split_shares(*, person:people(id, linked_user_id, name)) and settlements(*).
export function settlementNetAfter(
  allSplits: any[], settlement: any, currentUserId: string | null, myPersonIds: string[],
): number | null {
  const split = (allSplits ?? []).find((s) => s.id === settlement.split_id);
  if (!split) return null;
  const shares = (split.split_shares ?? []) as any[];
  const payer = getPayerAuthId(split);
  let target: { id?: string; linked_user_id?: string | null } | null = null;
  if (payer && payer === currentUserId) {
    // Viewer is the creditor → counterparty is the debtor = the settled share's person.
    const share = shares.find((ss: any) => ss.id === settlement.split_share_id);
    if (share?.person) target = { id: share.person.id, linked_user_id: share.person.linked_user_id };
  } else {
    // Counterparty is the payer (creditor).
    if (split.paid_by_person_id) {
      const ps = shares.find((ss: any) => ss.person_id === split.paid_by_person_id);
      if (ps?.person) target = { id: ps.person.id, linked_user_id: ps.person.linked_user_id };
    }
    if (!target && payer) target = { id: undefined, linked_user_id: payer };
  }
  if (!target) return null;
  return bilateralBalance(allSplits, target, currentUserId, myPersonIds, settlement.created_at);
}
