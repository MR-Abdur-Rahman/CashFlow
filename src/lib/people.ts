// How a contact (a `people` row) should appear to the current user.
//   NAME  — your nickname wins; else a LINKED contact shows their synced profile name, a LOCAL
//           contact shows the name you saved.
//   AVATAR — a LINKED contact uses their own profile picture (synced); a LOCAL contact uses the
//           picture you uploaded for them.
// Requires the row to carry the join `linked:linked_user_id(full_name, avatar_url)`.
export function contactDisplay(p: any): { name: string; avatarUrl: string | null } {
  if (!p) return { name: "?", avatarUrl: null };
  const linked = p.linked ?? null;
  // A contact is "linked" if it carries either the linked_user_id scalar OR the embedded `linked`
  // profile join. Several split-row queries embed `linked:linked_user_id(...)` WITHOUT also
  // selecting the linked_user_id column, so keying off the scalar alone would misread a linked
  // contact as local and drop the synced profile photo.
  const isLinked = p.linked_user_id != null || linked != null;
  const name = p.nickname || (isLinked ? (linked?.full_name ?? p.name) : p.name) || "?";
  const avatarUrl = isLinked ? (linked?.avatar_url ?? null) : (p.avatar_url ?? null);
  return { name, avatarUrl };
}

// The avatar shown on a split row: group split → group photo; person split → the OTHER party's
// photo (the creator for an incoming split, else the contact); people (multi) split → a Users icon
// (kind "people", no url). Requires the split's people/creator/groups joins to carry avatar fields.
export function splitRowAvatar(s: any): {
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
    return {
      kind: "person",
      name: s.creator?.full_name ?? "?",
      url: s.creator?.avatar_url ?? null,
    };
  }
  const d = contactDisplay(s?.people ?? shares[0]?.person);
  return { kind: "person", name: d.name, url: d.avatarUrl };
}
