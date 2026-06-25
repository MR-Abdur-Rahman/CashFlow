// Shared settlement row helpers (kept out of the component file so React Fast Refresh stays happy).

// Per-share remaining: share_amount minus the cumulative settlements on the SAME split_share_id
// up to and including this one (chronological). This is symmetric for both users (it reads the
// share + its settlement rows, not viewer-local share-name sums), so it fixes the receiver-side
// "0.00 remaining" bug without touching net-balance math.
export function shareRemaining(s: any, allSettlements: any[]): { remaining: number; fullySettled: boolean } {
  const shareAmount = Number((s.split_shares as any)?.share_amount ?? 0);
  const sameShare = allSettlements
    .filter((x) => x.split_share_id === s.split_share_id)
    .sort((a, b) => String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")));
  const idx = sameShare.findIndex((x) => x.id === s.id);
  const cumulative = (idx >= 0 ? sameShare.slice(0, idx + 1) : sameShare)
    .reduce((sum, x) => sum + Number(x.amount ?? 0), 0);
  const remaining = Math.max(0, shareAmount - cumulative);
  return { remaining, fullySettled: shareAmount > 0 && remaining <= 0 };
}

// Viewer-relative direction + the other party's display name.
//   iPaid = the settled share belongs to the viewer (its person is linked to them).
//   otherName: when the viewer paid, the other party is the split creator; otherwise it's the
//   settled share's person_name. Pass `otherNameOverride` on bilateral pages (person detail).
export function settlementDirection(
  s: any, currentUserId: string | undefined, otherNameOverride?: string,
): { iPaid: boolean; otherName: string } {
  const share = s.split_shares as any;
  const iPaid = !!currentUserId && share?.person?.linked_user_id === currentUserId;
  const otherName = otherNameOverride
    ?? (iPaid ? ((s.splits as any)?.creator?.full_name ?? "Someone") : (share?.person_name ?? "Someone"));
  return { iPaid, otherName };
}
