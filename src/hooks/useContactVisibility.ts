import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { peopleQuery, contactProfilesQuery } from "@/lib/queries";

export type ContactVisibility = {
  // Linked user ids that are hiding their profile from the current viewer.
  hidden: Set<string>;
  // Viewer's locally-saved name for a linked user (nickname or saved name) — the fallback label.
  localName: Map<string, string>;
};

// Computes, for the viewer's linked contacts, who is hiding their profile (name + photo). Shared via
// React Query cache, so calling it from multiple components is cheap. Until the check resolves,
// nobody is treated as hidden (avoids a flash of local names over synced ones).
export function useContactVisibility(): ContactVisibility {
  const { data: people = [] } = useQuery(peopleQuery());
  const linkedUids = useMemo(
    () => [...new Set((people as any[]).map((p) => p.linked_user_id).filter(Boolean) as string[])],
    [people],
  );
  const { data: allowed } = useQuery(contactProfilesQuery(linkedUids));

  return useMemo(() => {
    const hidden = new Set<string>();
    if (allowed) for (const uid of linkedUids) if (!allowed.has(uid)) hidden.add(uid);
    const localName = new Map<string, string>();
    for (const p of people as any[]) {
      if (p.linked_user_id) localName.set(p.linked_user_id, p.nickname || p.name || "CashFlow user");
    }
    return { hidden, localName };
  }, [linkedUids, allowed, people]);
}
