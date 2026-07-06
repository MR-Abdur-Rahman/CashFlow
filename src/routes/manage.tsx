import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  categoriesQuery,
  subCategoriesQuery,
  peopleQuery,
  groupsQuery,
  splitBalancesQuery,
  accountsQuery,
} from "@/lib/queries";
import { bilateralBalance } from "@/lib/balance";
import { contactDisplay } from "@/lib/people";
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
import { AddGroupDialog } from "@/components/AddGroupDialog";
import { AddAccountSheet } from "@/components/AddAccountSheet";
import { AccountIcon } from "@/components/AccountIcon";
import { SwipeRow } from "@/components/SwipeRow";
import { ListToolbar } from "@/components/ListToolbar";
import { Plus, Archive, ChevronRight, ArrowLeft } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { Link, useSearchParams, useNavigate } from "react-router-dom";

export default function ManagePage() {
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
      <h1 className="text-xl font-semibold">Manage</h1>
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
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any>(null);

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

  // Group by type
  const expenseCats = (cats as any[]).filter((c) => c.type === "expense" || c.type === "both");
  const incomeCats = (cats as any[]).filter((c) => c.type === "income" || c.type === "both");

  return (
    <div className="space-y-4 mt-4">
      <Button
        className="w-full"
        variant="outline"
        onClick={() => {
          setEdit(null);
          setOpen(true);
        }}
      >
        <Plus className="h-4 w-4 mr-2" /> New category
      </Button>

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
              onEdit={() => {
                setEdit(c);
                setOpen(true);
              }}
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
              onEdit={() => {
                setEdit(c);
                setOpen(true);
              }}
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

      <CategoryDialog open={open} onOpenChange={setOpen} edit={edit} />
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
  const [addOpen, setAddOpen] = useState(false);
  const [editSub, setEditSub] = useState<any>(null);

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
        onClick={() => {
          setEditSub(null);
          setAddOpen(true);
        }}
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
            onEdit={() => {
              setEditSub(s);
              setAddOpen(true);
            }}
            onDelete={() => del.mutate(s.id)}
          >
            <div className="flex items-center gap-3 p-3 bg-card">
              <span className="flex-1 text-sm">{s.name}</span>
            </div>
          </SwipeRow>
        ))}
      </div>

      <SubCategoryDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        categoryId={cat.id}
        edit={editSub}
      />
    </div>
  );
}

// ─── Sub-category Dialog ───────────────────────────────────────────────────
function SubCategoryDialog({
  open,
  onOpenChange,
  categoryId,
  edit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  categoryId: string;
  edit?: any;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(edit?.name ?? "");

  const m = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      if (edit?.id) {
        const { error } = await supabase.from("sub_categories").update({ name }).eq("id", edit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("sub_categories")
          .insert({ name, category_id: categoryId, user_id: u.user.id, is_default: false });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sub_categories", categoryId] });
      qc.invalidateQueries({ queryKey: ["sub_categories_all"] });
      toast.success("Saved");
      setName("");
      onOpenChange(false);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setName(edit?.name ?? "");
        onOpenChange(o);
      }}
      key={edit?.id ?? "new"}
    >
      <DialogContent>
        <DialogTitle>{edit ? "Edit sub-category" : "Add sub-category"}</DialogTitle>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            m.mutate();
          }}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Breakfast"
            />
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
  onOpenChange,
  edit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  edit?: any;
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
      if (edit?.id) {
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
      onOpenChange(false);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange} key={edit?.id ?? "new"}>
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
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any>(null);
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
        onAdd={() => {
          setEdit(null);
          setOpen(true);
        }}
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
            onEdit={() => {
              setEdit(a);
              setOpen(true);
            }}
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
      <AddAccountSheet open={open} onOpenChange={setOpen} edit={edit} />
    </div>
  );
}

function People() {
  const { data: people = [] } = useQuery(peopleQuery());
  const { data: balanceData } = useQuery(splitBalancesQuery());
  const allSplits = balanceData?.splits ?? [];
  const allSettlements = balanceData?.settlements ?? [];
  const meId = balanceData?.currentUserId ?? null;
  const myPids = balanceData?.myPersonIds ?? [];
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any>(null);
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

  // Filter by name / nickname (others hidden).
  const filtered = (people as any[]).filter((p) => {
    if (!q.trim()) return true;
    const hay = [contactDisplay(p).name, p.name, p.nickname]
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
        placeholder="Search people"
        onAdd={() => {
          setEdit(null);
          setOpen(true);
        }}
        onScan={() => navigate("/settings/qr")}
      />
      <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden shadow-sm">
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            {q ? "No people found" : "No people yet"}
          </p>
        )}
        {filtered.map((p) => {
          const bal = bilateralBalance(allSplits, allSettlements, p, meId, myPids);
          const { name, avatarUrl } = contactDisplay(p);
          return (
            <SwipeRow
              key={p.id}
              onEdit={() => {
                setEdit(p);
                setOpen(true);
              }}
              onDelete={() => {
                if (confirm("Delete person?")) del.mutate(p.id);
              }}
            >
              <Link
                to={`/split/person/${p.id}`}
                className="flex items-center gap-3 p-3 bg-card active:bg-secondary/40"
              >
                <UserAvatar url={avatarUrl} name={name} size={36} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {name}
                    {p.linked_user_id && " 🔗"}
                  </p>
                  <p className="text-xs text-muted-foreground">{p.phone_number ?? "no phone"}</p>
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
      <AddPersonDialog open={open} onOpenChange={setOpen} edit={edit} />
    </div>
  );
}

// ─── Groups ────────────────────────────────────────────────────────────────
function Groups() {
  const [q, setQ] = useState("");
  const { data: groups = [] } = useQuery(groupsQuery());
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any>(null);

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
        onAdd={() => {
          setEdit(null);
          setOpen(true);
        }}
      />

      <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden shadow-sm">
        {activeGroups.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No groups yet</p>
        )}
        {activeGroups.map((g: any) => (
          <SwipeRow
            key={g.id}
            onEdit={() => {
              setEdit(g);
              setOpen(true);
            }}
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

      <AddGroupDialog open={open} onOpenChange={setOpen} edit={edit} />
    </div>
  );
}
