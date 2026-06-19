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
        .select("*, accounts:account_id(label,institution,icon_name,icon_color,icon_url,icon_type), to_account:to_account_id(label,institution), categories:category_id(name,icon), sub_categories:sub_category_id(name)")
        .order("date", { ascending: false })
        .order("time", { ascending: false });
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
      const { data, error } = await supabase
        .from("splits")
        .select("*, split_shares(*), settlements(*), groups:group_id(name), people:person_id(name)")
        .order("date", { ascending: false })
        .order("time", { ascending: false });
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

      // Step 1: Find people records that link to current user
      const { data: linkedPeople, error: e1 } = await supabase
        .from("people")
        .select("id, user_id, name")
        .eq("linked_user_id", u.user.id);
      if (e1) throw e1;
      if (!linkedPeople || linkedPeople.length === 0) return [];

      const linkedPersonIds = linkedPeople.map((p: any) => p.id);

      // Step 2: Find split_shares that reference these person records
      const { data: shares, error: e2 } = await supabase
        .from("split_shares")
        .select("split_id")
        .in("person_id", linkedPersonIds);
      if (e2) throw e2;
      if (!shares || shares.length === 0) return [];

      const splitIds = [...new Set(shares.map((s: any) => s.split_id))];

      // Step 3: Fetch those splits (excluding ones I created)
      const { data, error: e3 } = await supabase
        .from("splits")
        .select("*, split_shares(*), settlements(*), groups:group_id(name), people:person_id(name)")
        .in("id", splitIds)
        .neq("created_by", u.user.id)
        .order("date", { ascending: false });
      if (e3) throw e3;

      // Step 4: Tag each split with who created it and my share info
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

      console.log("personSplitsQuery called with personId:", personId);
      console.log("current user:", u.user.id);

      const { data: personData } = await supabase
        .from("people")
        .select("id, linked_user_id, user_id")
        .eq("id", personId)
        .maybeSingle();

      console.log("personData:", personData);

      const personIds = new Set<string>([personId]);

      if (personData?.linked_user_id) {
        const { data: mirrorPeople } = await supabase
          .from("people")
          .select("id")
          .eq("user_id", personData.linked_user_id)
          .eq("linked_user_id", u.user.id);
        
        console.log("mirrorPeople:", mirrorPeople);
        if (mirrorPeople) mirrorPeople.forEach((p: any) => personIds.add(p.id));
      }

      const uniquePersonIds = [...personIds];
      console.log("uniquePersonIds:", uniquePersonIds);

      const { data: shareData, error: shareError } = await supabase
        .from("split_shares")
        .select("split_id")
        .in("person_id", uniquePersonIds);
      
      console.log("shareData:", shareData, "shareError:", shareError);

      const splitIds = [...new Set((shareData ?? []).map((s: any) => s.split_id))];
      console.log("splitIds:", splitIds);

      if (splitIds.length === 0) return [];

      const { data, error } = await supabase
        .from("splits")
        .select("*, split_shares(*), settlements(*), groups:group_id(name), people:person_id(name)")
        .in("id", splitIds)
        .order("date", { ascending: false });
      
      console.log("splits data:", data, "error:", error);

      if (error) throw error;

      return (data ?? []).map((s: any) => ({
        ...s,
        _isIncoming: s.created_by !== u.user!.id,
        _myPersonId: uniquePersonIds.find(pid =>
          (s.split_shares ?? []).some((sh: any) => sh.person_id === pid)
        ) ?? null,
      }));
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