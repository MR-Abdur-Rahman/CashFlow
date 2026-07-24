// Visibility context: which linked users hide their profile from the viewer, + the viewer's local
// name for each. Passed to the resolvers below so a hidden contact falls back to that local name and
// a blank avatar wherever they appear. See useContactVisibility.
export type ContactVis = {
  hidden: Set<string>;
  localName?: Map<string, string>;
};

// How a contact (a `people` row) should appear to the current user.
//   NAME  — your nickname wins; else a LINKED contact shows their synced profile name, a LOCAL
//           contact shows the name you saved.
//   AVATAR — a LINKED contact uses their own profile picture (synced); a LOCAL contact uses the
//           picture you uploaded for them.
// Requires the row to carry the join `linked:linked_user_id(full_name, avatar_url)`. If `vis` marks
// the linked user as hidden, the synced name/photo are ignored (falls back to the local ones).
export function contactDisplay(p: any, vis?: ContactVis): { name: string; avatarUrl: string | null } {
  if (!p) return { name: "?", avatarUrl: null };
  const linked = p.linked ?? null;
  // The linked user's id, needed to honour profile visibility (vis.hidden). CRITICAL: several
  // split/settlement-row queries embed `linked:linked_user_id(id, ...)` WITHOUT also selecting the
  // linked_user_id scalar, so we must derive the id from the embedded profile's `id` too — otherwise
  // the hidden check silently no-ops and the synced name/photo leak through despite "Show my profile"
  // being off. (The embedded profile's id === linked_user_id.)
  const linkedUid = p.linked_user_id ?? linked?.id ?? null;
  const isHidden = !!linkedUid && !!vis?.hidden.has(linkedUid);
  // A contact is "linked" if it carries either the linked user id OR the embedded `linked` join. When
  // hidden, we deliberately treat it as non-linked so the local name/photo are used.
  const isLinked = (linkedUid != null || linked != null) && !isHidden;
  const name = p.nickname || (isLinked ? (linked?.full_name ?? p.name) : p.name) || "?";
  const avatarUrl = isLinked ? (linked?.avatar_url ?? null) : (p.avatar_url ?? null);
  return { name, avatarUrl };
}

// A hidden creator's display name: the viewer's saved name for them, else a neutral label.
export function creatorDisplayName(s: any, vis?: ContactVis): string {
  if (s?.created_by && vis?.hidden.has(s.created_by)) {
    return vis.localName?.get(s.created_by) ?? "CashFlow user";
  }
  return s?.creator?.full_name ?? "";
}

// The avatar shown on a split row: group split → group photo; person split → the OTHER party's
// photo (the creator for an incoming split, else the contact); people (multi) split → a Users icon
// (kind "people", no url). Requires the split's people/creator/groups joins to carry avatar fields.
export function splitRowAvatar(
  s: any,
  vis?: ContactVis,
): {
  kind: "person" | "group" | "people";
  name: string;
  url: string | null;
} {
  const shares = (s?.split_shares ?? []) as any[];
  if (s?.type === "group") {
    return { kind: "group", name: s.groups?.name ?? "Group", url: s.groups?.avatar_url ?? null };
  }
  if (shares.length > 1) return { kind: "people", name: "People", url: null };
  if (s?._isIncoming) {
    const hidden = !!s.created_by && !!vis?.hidden.has(s.created_by);
    return {
      kind: "person",
      name: hidden ? creatorDisplayName(s, vis) : (s.creator?.full_name ?? "?"),
      url: hidden ? null : (s.creator?.avatar_url ?? null),
    };
  }
  const d = contactDisplay(s?.people ?? shares[0]?.person, vis);
  return { kind: "person", name: d.name, url: d.avatarUrl };
}
