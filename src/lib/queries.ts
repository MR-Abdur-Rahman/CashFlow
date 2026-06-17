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
      const { data, error } = await supabase.from("people").select("*").order("name");
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
        .select("*, split_shares(*), settlements(*)")
        .order("date", { ascending: false })
        .order("time", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

export const personSplitsQuery = (personId: string) =>
  queryOptions({
    queryKey: ["splits", "person", personId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("splits")
        .select("*, split_shares(*), settlements(*)")
        .eq("person_id", personId)
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

export const groupSplitsQuery = (groupId: string) =>
  queryOptions({
    queryKey: ["splits", "group", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("splits")
        .select("*, split_shares(*), settlements(*)")
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
