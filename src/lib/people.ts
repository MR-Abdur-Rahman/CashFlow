// How a contact (a `people` row) should appear to the current user.
//   NAME  — your nickname wins; else a LINKED contact shows their synced profile name, a LOCAL
//           contact shows the name you saved.
//   AVATAR — a LINKED contact uses their own profile picture (synced); a LOCAL contact uses the
//           picture you uploaded for them.
// Requires the row to carry the join `linked:linked_user_id(full_name, avatar_url)`.
export function contactDisplay(p: any): { name: string; avatarUrl: string | null } {
  if (!p) return { name: "?", avatarUrl: null };
  const linked = p.linked ?? null;
  const name = p.nickname || (p.linked_user_id ? (linked?.full_name ?? p.name) : p.name) || "?";
  const avatarUrl = p.linked_user_id ? (linked?.avatar_url ?? null) : (p.avatar_url ?? null);
  return { name, avatarUrl };
}
