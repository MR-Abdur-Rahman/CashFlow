// Shared settlement row helpers (kept out of the component file so React Fast Refresh stays happy).
import { contactDisplay, type ContactVis } from "./people";

// Maps a settlement's payment `method` to the account `type` that can receive/send it.
// Used to filter account dropdowns (SettleUpDialog + the Pending-tab settlement row) so a
// user can only pick an account whose type matches how the payment was made.
export const methodToAccountType: Record<string, string> = {
  cash: "cash",
  bank_transfer: "bank",
  "e-wallet": "e-wallet",
};

// Per-share remaining: share_amount minus the cumulative settlements on the SAME split_share_id
// up to and including this one (chronological). This is symmetric for both users (it reads the
// share + its settlement rows, not viewer-local share-name sums), so it fixes the receiver-side
// "0.00 remaining" bug without touching net-balance math.
export function shareRemaining(
  s: any,
  allSettlements: any[],
): { remaining: number; fullySettled: boolean } {
  const shareAmount = Number((s.split_shares as any)?.share_amount ?? 0);
  const sameShare = allSettlements
    .filter((x) => x.split_share_id === s.split_share_id)
    .sort((a, b) => String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")));
  const idx = sameShare.findIndex((x) => x.id === s.id);
  const cumulative = (idx >= 0 ? sameShare.slice(0, idx + 1) : sameShare).reduce(
    (sum, x) => sum + Number(x.amount ?? 0),
    0,
  );
  const remaining = Math.max(0, shareAmount - cumulative);
  return { remaining, fullySettled: shareAmount > 0 && remaining <= 0 };
}

// Viewer-relative direction + the other party's display name.
//   Direction is decided by who paid the SPLIT, not which share the settlement is attached to —
//   the debtor may be the creator, who has no explicit split_share row. The viewer is the debtor
//   (iPaid) unless they paid the split. Falls back to the settled-share owner when split payer data
//   isn't available. Pass `otherNameOverride` on bilateral pages (person detail).
export function settlementDirection(
  s: any,
  currentUserId: string | undefined,
  otherNameOverride?: string,
  vis?: ContactVis,
): { iPaid: boolean; otherName: string; otherAvatar: string | null } {
  const share = s.split_shares as any;
  const split = s.splits as any;

  // Bin settlement (person-to-person, no split): direction from settler_is_creditor, counterparty
  // from person_id (when I recorded it) or the recorder's profile (when they did).
  if (!split && !s.split_id) {
    const settlerIsMe = s.created_by === currentUserId;
    const iPaid = settlerIsMe ? !s.settler_is_creditor : !!s.settler_is_creditor;
    // Recorder counterparty honors profile visibility (falls back to the local name when hidden).
    const recorderHidden = !!s.created_by && !!vis?.hidden.has(s.created_by);
    const cp = settlerIsMe
      ? contactDisplay(s.person, vis)
      : {
          name: recorderHidden
            ? (vis?.localName?.get(s.created_by) ?? "Someone")
            : (s.creator?.full_name ?? "Someone"),
          avatarUrl: recorderHidden ? null : (s.creator?.avatar_url ?? null),
        };
    return { iPaid, otherName: otherNameOverride ?? cp.name, otherAvatar: cp.avatarUrl };
  }
  // Resolve the split's payer to an auth user id.
  let payerAuthId: string | null = null;
  if (split) {
    if (split.paid_by === "me") payerAuthId = split.created_by ?? null;
    else if (split.paid_by_person?.linked_user_id)
      payerAuthId = split.paid_by_person.linked_user_id;
  }
  const iPaid = payerAuthId
    ? payerAuthId !== currentUserId
    : !!currentUserId && share?.person?.linked_user_id === currentUserId; // fallback: settled share owner
  // When the viewer paid (creditor), the other party is the settled share's person (the debtor).
  // When the viewer owes (debtor), the other party is whoever paid the split (creditor).
  const splitCreatorHidden = !!split?.created_by && !!vis?.hidden.has(split.created_by);
  const splitCreatorName = splitCreatorHidden
    ? (vis?.localName?.get(split.created_by) ?? "Someone")
    : (split?.creator?.full_name ?? "Someone");
  const creditorName =
    split?.paid_by === "me" ? splitCreatorName : (split?.paid_by_person?.name ?? splitCreatorName);
  const otherName = otherNameOverride ?? (iPaid ? creditorName : (share?.person_name ?? "Someone"));
  return { iPaid, otherName, otherAvatar: null };
}
