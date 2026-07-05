import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const accountsQuery = () =>
  queryOptions({
    queryKey: ["accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

export const accountQuery = (id: string) =>
  queryOptions({
    queryKey: ["accounts", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("accounts").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

export const transactionsQuery = (opts?: { dateFrom?: string; dateTo?: string; accountId?: string }) =>
  queryOptions({
    queryKey: ["transactions", opts ?? {}],
    queryFn: async () => {
      let q = supabase
        .from("transactions")
        .select("*, accounts:account_id(label,institution,icon_name,icon_color,icon_url,icon_type), to_account:to_account_id(label,institution), categories:category_id(name,icon), sub_categories:sub_category_id(name), split:split_id(total_amount,paid_by,type,description,split_shares(share_amount,person_name,person_id),people:person_id(name),groups:group_id(name))")
        .order("date", { ascending: false })
        .order("time", { ascending: false })
        .order("created_at", { ascending: false });
      if (opts?.dateFrom) q = q.gte("date", opts.dateFrom);
      if (opts?.dateTo) q = q.lte("date", opts.dateTo);
      if (opts?.accountId) q = q.or(`account_id.eq.${opts.accountId},to_account_id.eq.${opts.accountId}`);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

export const categoriesQuery = (type?: "expense" | "income") =>
  queryOptions({
    queryKey: ["categories", type ?? "all"],
    queryFn: async () => {
      let q = supabase.from("categories").select("*").order("name");
      if (type) q = q.or(`type.eq.${type},type.eq.both`);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

export const subCategoriesQuery = (categoryId?: string | null) =>
  queryOptions({
    queryKey: ["sub_categories", categoryId ?? "none"],
    queryFn: async () => {
      if (!categoryId) return [];
      const { data, error } = await supabase
        .from("sub_categories")
        .select("*")
        .eq("category_id", categoryId)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!categoryId,
  });

export const allSubCategoriesQuery = () =>
  queryOptions({
    queryKey: ["sub_categories_all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sub_categories")
        .select("*, categories:category_id(name,icon,type)")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

export const peopleQuery = () =>
  queryOptions({
    queryKey: ["people"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data, error } = await supabase
        .from("people")
        .select("*")
        .eq("user_id", u.user.id)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

export const personQuery = (id: string) =>
  queryOptions({
    queryKey: ["people", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("people").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

export const groupsQuery = () =>
  queryOptions({
    queryKey: ["groups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("*, group_members(person_id, people(*))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

export const groupQuery = (id: string) =>
  queryOptions({
    queryKey: ["groups", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("*, group_members(person_id, people(*))")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

export const splitsQuery = () =>
  queryOptions({
    queryKey: ["splits"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data, error } = await supabase
        .from("splits")
        .select("*, split_shares(*), settlements(*), groups:group_id(name), people:person_id(name), creator:created_by(full_name), accounts:account_id(label)")
        .eq("created_by", u.user.id)
        .order("date", { ascending: false })
        .order("time", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

// Splits created by current user's friends where current user is involved
// (splits from OTHER users that involve me as a linked person)
export const incomingSplitsQuery = () =>
  queryOptions({
    queryKey: ["splits", "incoming"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];

      // Step 1: people records in OTHER users' lists that represent the current user
      const { data: linkedPeople, error: e1 } = await supabase
        .from("people")
        .select("id, user_id, name")
        .eq("linked_user_id", u.user.id);
      if (e1) throw e1;
      if (!linkedPeople || linkedPeople.length === 0) return [];

      const linkedPersonIds = linkedPeople.map((p: any) => p.id);

      // Step 2: split_shares that reference those person records
      const { data: shares, error: e2 } = await supabase
        .from("split_shares")
        .select("split_id, person_id")
        .in("person_id", linkedPersonIds);
      if (e2) throw e2;
      if (!shares || shares.length === 0) return [];

      const splitIds = [...new Set(shares.map((s: any) => s.split_id))];

      // Step 3: fetch those splits, excluding ones the current user created
      const { data, error: e3 } = await supabase
        .from("splits")
        .select("*, split_shares(*), settlements(*), groups:group_id(name), people:person_id(name), creator:created_by(full_name), accounts:account_id(label)")
        .in("id", splitIds)
        .neq("created_by", u.user.id)
        .order("date", { ascending: false });
      if (e3) throw e3;

      // Step 4: tag each split with incoming flag and current user's person_id
      return (data ?? []).map((s: any) => ({
        ...s,
        _isIncoming: true,
        _myPersonId: linkedPeople.find((p: any) =>
          (s.split_shares ?? []).some((sh: any) => sh.person_id === p.id)
        )?.id ?? null,
        _createdByUserId: s.created_by,
      }));
    },
  });

// Fetches splits where person appears as person_id OR in split_shares
export const personSplitsQuery = (personId: string) =>
  queryOptions({
    queryKey: ["splits", "person", personId],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const currentUserId = u.user.id;

      // Target person record
      const { data: target } = await supabase
        .from("people")
        .select("id, linked_user_id, user_id, name")
        .eq("id", personId)
        .maybeSingle();
      if (!target) return [];

      // Every people record that represents the current user (across all contact lists)
      const { data: myPeople } = await supabase
        .from("people").select("id").eq("linked_user_id", currentUserId);
      const myPersonIds = (myPeople ?? []).map((p: any) => p.id);

      // Current user's own contacts — for resolving participant names to how *I* know them
      const { data: myContacts } = await supabase
        .from("people").select("id, name, linked_user_id").eq("user_id", currentUserId);

      const SEL = "*, split_shares(*, person:people(id, linked_user_id, name)), settlements(*), groups:group_id(name), people:person_id(name), creator:created_by(full_name), accounts:account_id(label)";

      // Category A — own splits (I'm the creator) where the target participates
      const { data: targetShares } = await supabase
        .from("split_shares").select("split_id").eq("person_id", target.id);
      const targetSplitIds = [...new Set((targetShares ?? []).map((s: any) => s.split_id))];
      let ownSplits: any[] = [];
      {
        let qy = supabase.from("splits").select(SEL).eq("created_by", currentUserId);
        qy = targetSplitIds.length > 0
          ? qy.or(`person_id.eq.${target.id},id.in.(${targetSplitIds.join(",")})`)
          : qy.eq("person_id", target.id);
        const { data } = await qy;
        ownSplits = (data ?? []).map((s: any) => ({ ...s, _isIncoming: false }));
      }

      // Category B — incoming splits (created by others) where I participate AND the target is involved.
      // Compare by linked_user_id because share person_ids belong to the CREATOR's contact list.
      let incomingSplits: any[] = [];
      if (myPersonIds.length > 0) {
        const { data: myShares } = await supabase
          .from("split_shares").select("split_id").in("person_id", myPersonIds);
        const incomingIds = [...new Set((myShares ?? []).map((s: any) => s.split_id))];
        if (incomingIds.length > 0) {
          const { data: candidates } = await supabase
            .from("splits").select(SEL).neq("created_by", currentUserId).in("id", incomingIds);
          incomingSplits = (candidates ?? []).filter((split: any) => {
            const creatorIsTarget = !!target.linked_user_id && split.created_by === target.linked_user_id;
            const targetInShares = (split.split_shares ?? []).some((ss: any) =>
              (target.linked_user_id && ss.person?.linked_user_id === target.linked_user_id) ||
              ss.person_id === target.id
            );
            return creatorIsTarget || targetInShares;
          }).map((s: any) => ({ ...s, _isIncoming: true }));
        }
      }

      // Merge (incoming first so _isIncoming survives) + dedupe by id
      const seen = new Set<string>();
      const deduped = [...incomingSplits, ...ownSplits].filter((s) => {
        if (seen.has(s.id)) return false;
        seen.add(s.id);
        return true;
      });

      // Sort: date DESC, time DESC, created_at DESC
      deduped.sort((a, b) => {
        if (a.date !== b.date) return String(b.date).localeCompare(String(a.date));
        const at = String(a.time ?? "").slice(0, 8), bt = String(b.time ?? "").slice(0, 8);
        if (at !== bt) return bt.localeCompare(at);
        return String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""));
      });

      // Resolve participant names to the viewer's contacts + attach balance context
      return deduped.map((s: any) => {
        const shares = (s.split_shares ?? []).map((ss: any) => {
          let person_name = ss.person_name;
          const lui = ss.person?.linked_user_id;
          if (lui) {
            const myContact = (myContacts ?? []).find((c: any) => c.linked_user_id === lui);
            if (myContact) person_name = myContact.name;
          }
          return { ...ss, person_name };
        });
        const myShare = shares.find((ss: any) =>
          myPersonIds.includes(ss.person_id) || ss.person?.linked_user_id === currentUserId
        );
        return {
          ...s,
          split_shares: shares,
          _isIncoming: s._isIncoming,
          _myPersonId: myShare?.person_id ?? null,
          _myPersonIds: myPersonIds,
          _currentUserId: currentUserId,
          _targetLinkedUserId: target.linked_user_id ?? null,
          _targetPersonId: target.id,
        };
      });
    },
  });

// Single fetch of all splits involving the current user (own + incoming) with the people join,
// for computing bilateral balances against every contact on the Split page (avoids N+1 per person).
// Keyed under ["splits", ...] so existing invalidateQueries(["splits"]) calls refresh it.
export const splitBalancesQuery = () =>
  queryOptions({
    queryKey: ["splits", "balances"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return { splits: [] as any[], settlements: [] as any[], myPersonIds: [] as string[], currentUserId: null as string | null };
      const currentUserId = u.user.id;

      const { data: myPeople } = await supabase
        .from("people").select("id").eq("linked_user_id", currentUserId);
      const myPersonIds = (myPeople ?? []).map((p: any) => p.id);

      const SEL = "*, split_shares(*, person:people(id, linked_user_id, name)), settlements(*), creator:created_by(full_name), accounts:account_id(label, institution)";

      // Own splits
      const { data: own } = await supabase.from("splits").select(SEL).eq("created_by", currentUserId);

      // Incoming splits where the current user participates
      let incoming: any[] = [];
      if (myPersonIds.length > 0) {
        const { data: myShares } = await supabase
          .from("split_shares").select("split_id").in("person_id", myPersonIds);
        const ids = [...new Set((myShares ?? []).map((s: any) => s.split_id))];
        if (ids.length > 0) {
          const { data } = await supabase.from("splits").select(SEL).neq("created_by", currentUserId).in("id", ids);
          incoming = data ?? [];
        }
      }

      // Incoming first so _isIncoming survives dedupe
      const seen = new Set<string>();
      const splits = [
        ...incoming.map((s: any) => ({ ...s, _isIncoming: true })),
        ...(own ?? []).map((s: any) => ({ ...s, _isIncoming: false })),
      ].filter((s) => { if (seen.has(s.id)) return false; seen.add(s.id); return true; });

      // Bin model: settlements are person-to-person (not per split), so fetch them flat with the
      // counterparty person joined. RLS returns every settlement the current user is part of.
      const { data: settlements } = await supabase
        .from("settlements")
        .select("*, person:person_id(id, linked_user_id, name)");

      return { splits, settlements: settlements ?? [], myPersonIds, currentUserId };
    },
  });

export const groupSplitsQuery = (groupId: string) =>
  queryOptions({
    queryKey: ["splits", "group", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("splits")
        .select("*, split_shares(*), settlements(*), groups:group_id(name), people:person_id(name)")
        .eq("group_id", groupId)
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

export const notificationsQuery = () =>
  queryOptions({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", u.user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

// Splits awaiting an account selection by the current user (they paid, but haven't said from where).
export const pendingSplitsQuery = () =>
  queryOptions({
    queryKey: ["pending-splits"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data, error } = await supabase
        .from("splits")
        .select("*, split_shares(*, person:people(id, linked_user_id, name)), creator:created_by(id, full_name)")
        .eq("account_pending", true)
        .eq("pending_for_user_id", u.user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

// Settlements awaiting the receiver picking which of THEIR accounts received the money.
export const pendingSettlementsQuery = () =>
  queryOptions({
    queryKey: ["pending-settlements"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data, error } = await supabase
        .from("settlements")
        .select("*, creator:created_by(id, full_name), splits:split_id(description)")
        .eq("receiver_account_pending", true)
        .eq("pending_for_user_id", u.user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

export const profileQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["profile", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });