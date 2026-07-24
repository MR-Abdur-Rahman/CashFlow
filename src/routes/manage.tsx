import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  categoriesQuery,
  subCategoriesQuery,
  allSubCategoriesQuery,
  peopleQuery,
  groupsQuery,
  splitBalancesQuery,
  accountsQuery,
} from "@/lib/queries";
import { bilateralBalance } from "@/lib/balance";
import { contactDisplay } from "@/lib/people";
import { useContactVisibility } from "@/hooks/useContactVisibility";
import { UserAvatar } from "@/components/UserAvatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AddPersonDialog } from "@/components/AddPersonDialog";
import { AddCashFlowPersonDialog } from "@/components/AddCashFlowPersonDialog";
import { AddGroupDialog } from "@/components/AddGroupDialog";
import { AddAccountSheet } from "@/components/AddAccountSheet";
import { AccountIcon } from "@/components/AccountIcon";
import { SwipeRow } from "@/components/SwipeRow";
import { ListToolbar } from "@/components/ListToolbar";
import { Plus, Archive, ChevronRight, ArrowLeft, UserPlus, AtSign } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { Link, useSearchParams } from "react-router-dom";
import { useBack } from "@/lib/navBack";

export default function ManagePage() {
  const goBack = useBack();
  const [catDrill, setCatDrill] = useState<{ id: string; name: string; icon: string } | null>(null);
  // Tab lives in the URL (?tab=) so navigating away and pressing Back restores the same tab.
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") ?? "categories";

  // If drilling into a category's sub-categories
  if (catDrill) {
    return <SubCategoryPage cat={catDrill} onBack={() => setCatDrill(null)} />;
  }

  return (
    <div className="px-4 pt-6 pb-24 space-y-5">
      <div className="flex items-center gap-2">
        <button
          onClick={goBack}
          aria-label="Back"
          className="-ml-1 p-1 text-muted-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-semibold">Manage</h1>
      </div>
      <Tabs value={tab} onValueChange={(v) => setSearchParams({ tab: v }, { replace: true })}>
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="people">People</TabsTrigger>
          <TabsTrigger value="groups">Groups</TabsTrigger>
        </TabsList>
        <TabsContent value="categories">
          <Categories onSelectCat={setCatDrill} />
        </TabsContent>
        <TabsContent value="accounts">
          <Accounts />
        </TabsContent>
        <TabsContent value="people">
          <People />
        </TabsContent>
        <TabsContent value="groups">
          <Groups />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Categories List ───────────────────────────────────────────────────────
function Categories({
  onSelectCat,
}: {
  onSelectCat: (cat: { id: string; name: string; icon: string }) => void;
}) {
  const { data: cats = [] } = useQuery(categoriesQuery());
  const { data: allSubs = [] } = useQuery(allSubCategoriesQuery());
  const qc = useQueryClient();
  // Single source of truth for the category dialog: null = closed, otherwise the mode AND its target
  // travel together in one value, so "which mode" and "which category" can never disagree.
  const [action, setAction] = useState<{ mode: "create" } | { mode: "edit"; cat: any } | null>(null);
  const [q, setQ] = useState("");

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  // Group by type, filtered by the search box — matches a category by its own name OR by any of its
  // sub-category names.
  const term = q.trim().toLowerCase();
  const catIdsWithSubMatch = new Set(
    (allSubs as any[])
      .filter((s) => (s.name ?? "").toLowerCase().includes(term))
      .map((s) => s.category_id),
  );
  const match = (c: any) =>
    !term || c.name.toLowerCase().includes(term) || catIdsWithSubMatch.has(c.id);
  const expenseCats = (cats as any[]).filter(
    (c) => (c.type === "expense" || c.type === "both") && match(c),
  );
  const incomeCats = (cats as any[]).filter(
    (c) => (c.type === "income" || c.type === "both") && match(c),
  );

  return (
    <div className="space-y-4 mt-4">
      <ListToolbar
        query={q}
        onQuery={setQ}
        placeholder="Search categories"
        onAdd={() => setAction({ mode: "create" })}
      />

      {/* Expense categories */}
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2 px-1">Expense</p>
        <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden shadow-sm">
          {expenseCats.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">No expense categories</p>
          )}
          {expenseCats.map((c: any) => (
            <SwipeRow
              key={c.id}
              onEdit={() => setAction({ mode: "edit", cat: c })}
              onDelete={() => del.mutate(c.id)}
            >
              <button
                type="button"
                onClick={() => onSelectCat({ id: c.id, name: c.name, icon: c.icon ?? "📦" })}
                className="w-full flex items-center gap-3 p-3 bg-card active:bg-secondary/40 text-left"
              >
                <span className="text-lg w-7 text-center">{c.icon ?? "📦"}</span>
                <span className="flex-1 text-sm truncate">{c.name}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            </SwipeRow>
          ))}
        </div>
      </div>

      {/* Income categories */}
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2 px-1">Income</p>
        <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden shadow-sm">
          {incomeCats.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">No income categories</p>
          )}
          {incomeCats.map((c: any) => (
            <SwipeRow
              key={c.id}
              onEdit={() => setAction({ mode: "edit", cat: c })}
              onDelete={() => del.mutate(c.id)}
            >
              <button
                type="button"
                onClick={() => onSelectCat({ id: c.id, name: c.name, icon: c.icon ?? "📦" })}
                className="w-full flex items-center gap-3 p-3 bg-card active:bg-secondary/40 text-left"
              >
                <span className="text-lg w-7 text-center">{c.icon ?? "📦"}</span>
                <span className="flex-1 text-sm truncate">{c.name}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            </SwipeRow>
          ))}
        </div>
      </div>

      {/* Keyed by the exact target so switching categories, flipping create↔edit, or reopening after
          a close (via "idle") always remounts the dialog fresh — the key change replaces every reset. */}
      <CategoryDialog
        key={action ? (action.mode === "edit" ? `edit-${action.cat.id}` : "create") : "idle"}
        open={!!action}
        onClose={() => setAction(null)}
        edit={action?.mode === "edit" ? action.cat : null}
      />
    </div>
  );
}

// ─── Sub-category Page (drill-down) ───────────────────────────────────────
function SubCategoryPage({
  cat,
  onBack,
}: {
  cat: { id: string; name: string; icon: string };
  onBack: () => void;
}) {
  const { data: subs = [] } = useQuery(subCategoriesQuery(cat.id));
  const qc = useQueryClient();
  // Single source of truth for the sub-category dialog: null = closed, otherwise the mode AND its
  // target travel together in one value, so "which mode" and "which sub-category" can never disagree.
  const [action, setAction] = useState<{ mode: "create" } | { mode: "edit"; sub: any } | null>(null);

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sub_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sub_categories", cat.id] });
      qc.invalidateQueries({ queryKey: ["sub_categories_all"] });
      toast.success("Deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="px-4 pt-4 pb-24 space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center text-sm text-muted-foreground"
      >
        <ArrowLeft className="h-4 w-4 mr-1" /> Categories
      </button>

      <div className="flex items-center gap-3">
        <span className="text-2xl">{cat.icon}</span>
        <h1 className="text-xl font-semibold">{cat.name}</h1>
      </div>

      <Button
        className="w-full"
        variant="outline"
        onClick={() => setAction({ mode: "create" })}
      >
        <Plus className="h-4 w-4 mr-2" /> Add sub-category
      </Button>

      <div className="rounded-xl overflow-hidden border border-border divide-y divide-border">
        {(subs as any[]).length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No sub-categories yet</p>
        )}
        {(subs as any[]).map((s) => (
          <SwipeRow
            key={s.id}
            onEdit={() => setAction({ mode: "edit", sub: s })}
            onDelete={() => del.mutate(s.id)}
          >
            <div className="flex items-center gap-3 p-3 bg-card">
              <span className="text-lg w-7 text-center">{s.icon ?? "📦"}</span>
              <span className="flex-1 text-sm">{s.name}</span>
            </div>
          </SwipeRow>
        ))}
      </div>

      {/* Keyed by the exact target so switching sub-categories, flipping create↔edit, or reopening
          after a close (via "idle") always remounts the dialog with fresh form state — the key change
          replaces every manual reset. */}
      <SubCategoryDialog
        key={action ? (action.mode === "edit" ? `edit-${action.sub.id}` : "create") : "idle"}
        open={!!action}
        onClose={() => setAction(null)}
        categoryId={cat.id}
        edit={action?.mode === "edit" ? action.sub : null}
      />
    </div>
  );
}

// ─── Sub-category Dialog ───────────────────────────────────────────────────
function SubCategoryDialog({
  open,
  onClose,
  categoryId,
  edit,
}: {
  open: boolean;
  onClose: () => void;
  categoryId: string;
  // The sub-category being edited, or null for create mode. This component is remounted (via a key on
  // the parent) whenever this target changes, so name/icon are seeded once from `edit` at mount and
  // never need manual resetting — no stale values, no flash, no mode/target desync.
  edit: { id: string; name: string; icon: string | null } | null;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(edit?.name ?? "");
  const [icon, setIcon] = useState(edit?.icon ?? "📦");

  const m = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      if (edit) {
        const { error } = await supabase
          .from("sub_categories")
          .update({ name, icon } as any)
          .eq("id", edit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("sub_categories")
          .insert({ name, icon, category_id: categoryId, user_id: u.user.id, is_default: false } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sub_categories", categoryId] });
      qc.invalidateQueries({ queryKey: ["sub_categories_all"] });
      toast.success("Saved");
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogTitle>{edit ? "Edit sub-category" : "Add sub-category"}</DialogTitle>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            m.mutate();
          }}
          className="space-y-3"
        >
          <div className="flex gap-2">
            <div className="space-y-1.5 w-20">
              <Label>Icon</Label>
              <Input
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                maxLength={4}
                className="text-center text-lg"
              />
            </div>
            <div className="space-y-1.5 flex-1">
              <Label>Name</Label>
              <Input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Breakfast"
              />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={m.isPending}>
            Save
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Category Dialog ───────────────────────────────────────────────────────
function CategoryDialog({
  open,
  onClose,
  edit,
}: {
  open: boolean;
  onClose: () => void;
  // The category being edited, or null for create mode. Remounted (via a key on the parent) whenever
  // this target changes, so name/icon/type are seeded once from `edit` at mount and never need manual
  // resetting — no stale values, no flash, no mode/target desync.
  edit: { id: string; name: string; icon: string | null; type: string } | null;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(edit?.name ?? "");
  const [icon, setIcon] = useState(edit?.icon ?? "📦");
  const [type, setType] = useState<string>(edit?.type ?? "expense");

  const m = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const payload = { name, icon, type };
      if (edit) {
        const { error } = await supabase.from("categories").update(payload).eq("id", edit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("categories")
          .insert({ ...payload, user_id: u.user.id, is_default: false });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Saved");
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogTitle>{edit ? "Edit category" : "New category"}</DialogTitle>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            m.mutate();
          }}
          className="space-y-3"
        >
          <div className="flex gap-2">
            <div className="space-y-1.5 w-20">
              <Label>Icon</Label>
              <Input
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                maxLength={4}
                className="text-center text-lg"
              />
            </div>
            <div className="space-y-1.5 flex-1">
              <Label>Name</Label>
              <Input required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">Expense</SelectItem>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="both">Both</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full" disabled={m.isPending}>
            Save
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── People ────────────────────────────────────────────────────────────────
// ─── Accounts ────────────────────────────────────────────────────────────────
function Accounts() {
  const { data: accounts = [] } = useQuery(accountsQuery());
  const qc = useQueryClient();
  // Single source of truth: null = closed; else the mode + target travel together so they can't desync.
  const [action, setAction] = useState<{ mode: "create" } | { mode: "edit"; item: any } | null>(null);
  const [q, setQ] = useState("");

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  const filtered = (accounts as any[]).filter(
    (a) =>
      !q.trim() ||
      [a.label, a.institution]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q.trim().toLowerCase()),
  );

  return (
    <div className="space-y-3 mt-4">
      <ListToolbar
        query={q}
        onQuery={setQ}
        placeholder="Search accounts"
        onAdd={() => setAction({ mode: "create" })}
      />
      <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden shadow-sm">
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            {q ? "No accounts found" : "No accounts yet"}
          </p>
        )}
        {filtered.map((a) => (
          <SwipeRow
            key={a.id}
            onEdit={() => setAction({ mode: "edit", item: a })}
            onDelete={() => {
              if (confirm("Delete account?")) del.mutate(a.id);
            }}
          >
            <Link
              to={`/accounts/${a.id}`}
              className="flex items-center gap-3 p-3 bg-card active:bg-secondary/40"
            >
              <AccountIcon
                iconType={a.icon_type}
                iconName={a.icon_name}
                iconColor={a.icon_color}
                iconUrl={a.icon_url}
                size={36}
              />
              <p className="flex-1 min-w-0 text-sm font-medium truncate">
                {[a.institution, a.label].filter(Boolean).join(" · ") || a.label}
              </p>
              <span className="font-mono text-sm font-semibold shrink-0">
                {formatMoney(a.current_balance)}
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </Link>
          </SwipeRow>
        ))}
      </div>
      <AddAccountSheet
        key={action ? (action.mode === "edit" ? `edit-${action.item.id}` : "create") : "idle"}
        open={!!action}
        onOpenChange={(o) => !o && setAction(null)}
        edit={action?.mode === "edit" ? action.item : null}
      />
    </div>
  );
}

function People() {
  const vis = useContactVisibility();
  const { data: people = [] } = useQuery(peopleQuery());
  const { data: balanceData } = useQuery(splitBalancesQuery());
  const allSplits = balanceData?.splits ?? [];
  const allSettlements = balanceData?.settlements ?? [];
  const meId = balanceData?.currentUserId ?? null;
  const myPids = balanceData?.myPersonIds ?? [];
  const qc = useQueryClient();
  // Single source of truth: null = closed; else the mode + target travel together so they can't desync.
  const [action, setAction] = useState<{ mode: "create" } | { mode: "edit"; item: any } | null>(null);
  const [addCf, setAddCf] = useState(false);
  const [q, setQ] = useState("");

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("people").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["people"] });
      toast.success("Deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  // Filter by name / nickname / phone number of the user's OWN saved contacts (a local-list filter —
  // not a cross-user lookup of other people's private numbers).
  const filtered = (people as any[]).filter((p) => {
    if (!q.trim()) return true;
    const hay = [contactDisplay(p).name, p.name, p.nickname, p.phone_number]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });

  return (
    <div className="space-y-3 mt-4">
      <ListToolbar
        query={q}
        onQuery={setQ}
        placeholder="Search people or phone"
        addActions={[
          { label: "Add local person", icon: UserPlus, onClick: () => setAction({ mode: "create" }) },
          { label: "Add CashFlow person", icon: AtSign, onClick: () => setAddCf(true) },
        ]}
      />
      <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden shadow-sm">
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            {q ? "No people found" : "No people yet"}
          </p>
        )}
        {filtered.map((p) => {
          const bal = bilateralBalance(allSplits, allSettlements, p, meId, myPids);
          const { name, avatarUrl } = contactDisplay(p, vis);
          return (
            <SwipeRow
              key={p.id}
              onEdit={() => setAction({ mode: "edit", item: p })}
              onDelete={() => {
                if (confirm("Delete person?")) del.mutate(p.id);
              }}
            >
              <Link
                to={`/manage/person/${p.id}`}
                className="flex items-center gap-3 p-3 bg-card active:bg-secondary/40"
              >
                <UserAvatar url={avatarUrl} name={name} size={36} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {name}
                    {p.linked_user_id && " 🔗"}
                  </p>
                </div>
                {bal !== 0 && (
                  <span
                    className={`text-xs font-mono font-semibold ${bal > 0 ? "text-income" : "text-expense"}`}
                  >
                    {bal > 0 ? "+" : ""}
                    {formatMoney(bal)}
                  </span>
                )}
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </Link>
            </SwipeRow>
          );
        })}
      </div>
      <AddPersonDialog
        key={action ? (action.mode === "edit" ? `edit-${action.item.id}` : "create") : "idle"}
        open={!!action}
        onOpenChange={(o) => !o && setAction(null)}
        edit={action?.mode === "edit" ? action.item : null}
      />
      <AddCashFlowPersonDialog open={addCf} onOpenChange={setAddCf} />
    </div>
  );
}

// ─── Groups ────────────────────────────────────────────────────────────────
function Groups() {
  const [q, setQ] = useState("");
  const { data: groups = [] } = useQuery(groupsQuery());
  const qc = useQueryClient();
  // Single source of truth: null = closed; else the mode + target travel together so they can't desync.
  const [action, setAction] = useState<{ mode: "create" } | { mode: "edit"; item: any } | null>(null);

  const archive = useMutation({
    mutationFn: async (id: string) => {
      const g = groups.find((x: any) => x.id === id) as any;
      const { error } = await supabase
        .from("groups")
        .update({ is_archived: !g?.is_archived })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["groups"] });
      toast.success("Updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("groups").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["groups"] });
      toast.success("Deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  const match = (g: any) =>
    !q.trim() || (g.name ?? "").toLowerCase().includes(q.trim().toLowerCase());
  const activeGroups = (groups as any[]).filter((g) => !g.is_archived && match(g));
  const archivedGroups = (groups as any[]).filter((g) => g.is_archived && match(g));

  return (
    <div className="space-y-3 mt-4">
      <ListToolbar
        query={q}
        onQuery={setQ}
        placeholder="Search groups"
        onAdd={() => setAction({ mode: "create" })}
      />

      <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden shadow-sm">
        {activeGroups.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No groups yet</p>
        )}
        {activeGroups.map((g: any) => (
          <SwipeRow
            key={g.id}
            onEdit={() => setAction({ mode: "edit", item: g })}
            onDelete={() => archive.mutate(g.id)}
          >
            <Link
              to={`/split/group/${g.id}`}
              className="flex items-center gap-3 p-3 bg-card active:bg-secondary/40"
            >
              <span className="text-lg w-7 text-center">👥</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{g.name}</p>
                <p className="text-xs text-muted-foreground">
                  {g.group_members?.length ?? 0} members
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </Link>
          </SwipeRow>
        ))}
      </div>

      {archivedGroups.length > 0 && (
        <>
          <p className="text-xs uppercase tracking-wider text-muted-foreground px-1 flex items-center gap-1 mt-4">
            <Archive className="h-3 w-3" /> Archived
          </p>
          <div className="surface-card divide-y divide-border overflow-hidden rounded-xl opacity-60">
            {archivedGroups.map((g: any) => (
              <SwipeRow
                key={g.id}
                onEdit={() => archive.mutate(g.id)}
                onDelete={() => {
                  if (confirm("Delete group?")) del.mutate(g.id);
                }}
              >
                <div className="flex items-center gap-3 p-3 bg-card">
                  <span className="text-lg w-7 text-center">👥</span>
                  <p className="text-sm truncate flex-1">{g.name}</p>
                </div>
              </SwipeRow>
            ))}
          </div>
        </>
      )}

      <AddGroupDialog
        key={action ? (action.mode === "edit" ? `edit-${action.item.id}` : "create") : "idle"}
        open={!!action}
        onOpenChange={(o) => !o && setAction(null)}
        edit={action?.mode === "edit" ? action.item : null}
      />
    </div>
  );
}
