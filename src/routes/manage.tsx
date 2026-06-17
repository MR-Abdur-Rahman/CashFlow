import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { categoriesQuery, allSubCategoriesQuery, peopleQuery, groupsQuery, splitsQuery } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AddPersonDialog } from "@/components/AddPersonDialog";
import { AddGroupDialog } from "@/components/AddGroupDialog";
import { SwipeRow } from "@/components/SwipeRow";
import { Plus, Pencil, Trash2, Archive } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { Link } from "react-router-dom";

export default function ManagePage() {
  return (
    <div className="px-4 pt-6 pb-24 space-y-5">
      <h1 className="text-xl font-semibold">Manage</h1>
      <Tabs defaultValue="categories">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="subs">Sub</TabsTrigger>
          <TabsTrigger value="people">People</TabsTrigger>
          <TabsTrigger value="groups">Groups</TabsTrigger>
        </TabsList>
        <TabsContent value="categories"><Categories /></TabsContent>
        <TabsContent value="subs"><SubCategories /></TabsContent>
        <TabsContent value="people"><People /></TabsContent>
        <TabsContent value="groups"><Groups /></TabsContent>
      </Tabs>
    </div>
  );
}

function Categories() {
  const { data: cats = [] } = useQuery(categoriesQuery());
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any>(null);

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["categories"] }); toast.success("Deleted"); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-3 mt-4">
      <Button className="w-full" variant="outline" onClick={() => { setEdit(null); setOpen(true); }}>
        <Plus className="h-4 w-4 mr-2" /> New category
      </Button>
      <div className="surface-card divide-y divide-border">
        {cats.map((c) => (
          <SwipeRow key={c.id} onEdit={() => { setEdit(c); setOpen(true); }} onDelete={() => del.mutate(c.id)}>
            <div className="flex items-center gap-3 p-3">
              <span className="text-lg w-7 text-center">{c.icon ?? "📦"}</span>
              <span className="flex-1 text-sm truncate">{c.name} · {c.type}</span>
            </div>
          </SwipeRow>
        ))}
      </div>
      <CategoryDialog open={open} onOpenChange={setOpen} edit={edit} />
    </div>
  );
}

function CategoryDialog({ open, onOpenChange, edit }: { open: boolean; onOpenChange: (o: boolean) => void; edit?: any }) {
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
        const { error } = await supabase.from("categories").insert({ ...payload, user_id: u.user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["categories"] }); toast.success("Saved"); onOpenChange(false); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange} key={edit?.id ?? "new"}>
      <DialogContent>
        <DialogTitle>{edit ? "Edit category" : "New category"}</DialogTitle>
        <form onSubmit={(e) => { e.preventDefault(); m.mutate(); }} className="space-y-3">
          <div className="space-y-1.5"><Label>Icon (emoji)</Label><Input value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={4} /></div>
          <div className="space-y-1.5"><Label>Name</Label><Input required value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">Expense</SelectItem>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="both">Both</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full">Save</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SubCategories() {
  const { data: subs = [] } = useQuery(allSubCategoriesQuery());
  const { data: cats = [] } = useQuery(categoriesQuery());
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [catId, setCatId] = useState("");

  const add = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { error } = await supabase.from("sub_categories").insert({ name, category_id: catId, user_id: u.user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sub_categories_all"] });
      qc.invalidateQueries({ queryKey: ["sub_categories"] });
      setOpen(false); setName(""); toast.success("Added");
    },
    onError: (e) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sub_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sub_categories_all"] }); toast.success("Deleted"); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-3 mt-4">
      <Button className="w-full" variant="outline" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-2" /> New sub-category
      </Button>
      <div className="surface-card divide-y divide-border">
        {subs.map((s: any) => (
          <SwipeRow key={s.id} onDelete={() => del.mutate(s.id)}>
            <div className="flex items-center gap-3 p-3">
              <span className="text-lg w-7 text-center">{s.categories?.icon ?? "•"}</span>
              <span className="flex-1 text-sm truncate">{s.name} · {s.categories?.name ?? ""}</span>
            </div>
          </SwipeRow>
        ))}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>New sub-category</DialogTitle>
          <form onSubmit={(e) => { e.preventDefault(); add.mutate(); }} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Parent category</Label>
              <Select value={catId} onValueChange={setCatId}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Name</Label><Input required value={name} onChange={(e) => setName(e.target.value)} /></div>
            <Button type="submit" className="w-full" disabled={!catId}>Save</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function People() {
  const { data: people = [] } = useQuery(peopleQuery());
  const { data: splits = [] } = useQuery(splitsQuery());
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any>(null);

  function personBalance(personId: string) {
    let owed = 0;
    for (const s of splits as any[]) {
      const shares = s.split_shares ?? [];
      const settled = (s as any).settlements ?? [];
      for (const sh of shares) {
        if (sh.person_id === personId) {
          const settledAmt = settled.filter((x: any) => x.split_share_id === sh.id).reduce((a: number, x: any) => a + Number(x.amount), 0);
          owed += Number(sh.share_amount) - settledAmt;
        }
      }
    }
    return owed;
  }

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("people").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["people"] }); toast.success("Deleted"); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-3 mt-4">
      <Button className="w-full" variant="outline" onClick={() => { setEdit(null); setOpen(true); }}>
        <Plus className="h-4 w-4 mr-2" /> Add person
      </Button>
      <div className="surface-card divide-y divide-border">
        {people.map((p) => {
          const bal = personBalance(p.id);
          return (
            <SwipeRow
              key={p.id}
              onEdit={() => { setEdit(p); setOpen(true); }}
              onDelete={() => { if (confirm("Delete person?")) del.mutate(p.id); }}
            >
              <Link to={`/split/person/${p.id}`} className="flex items-center gap-3 p-3 active:bg-secondary/40">
                <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm">
                  {p.name[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}{p.linked_user_id && " 🔗"}</p>
                  <p className="text-xs text-muted-foreground">{p.phone_number ?? "no phone"}</p>
                </div>
                {bal !== 0 && (
                  <span className={`text-xs font-mono font-semibold ${bal > 0 ? "text-income" : "text-expense"}`}>
                    {bal > 0 ? "+" : ""}{formatMoney(bal)}
                  </span>
                )}
              </Link>
            </SwipeRow>
          );
        })}
      </div>
      <AddPersonDialog open={open} onOpenChange={setOpen} edit={edit} />
    </div>
  );
}

function Groups() {
  const { data: groups = [] } = useQuery(groupsQuery());
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any>(null);

  const archive = useMutation({
    mutationFn: async (id: string) => {
      const g = groups.find((x: any) => x.id === id) as any;
      const { error } = await supabase.from("groups").update({ is_archived: !g?.is_archived }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["groups"] }); toast.success("Updated"); },
    onError: (e) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("groups").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["groups"] }); toast.success("Deleted"); },
    onError: (e) => toast.error(e.message),
  });

  const activeGroups = groups.filter((g: any) => !g.is_archived);
  const archivedGroups = groups.filter((g: any) => g.is_archived);

  return (
    <div className="space-y-3 mt-4">
      <Button className="w-full" variant="outline" onClick={() => { setEdit(null); setOpen(true); }}>
        <Plus className="h-4 w-4 mr-2" /> Create group
      </Button>

      <div className="surface-card divide-y divide-border">
        {activeGroups.map((g: any) => (
          <SwipeRow
            key={g.id}
            onEdit={() => { setEdit(g); setOpen(true); }}
            onDelete={() => archive.mutate(g.id)}
          >
            <Link to={`/split/group/${g.id}`} className="flex items-center gap-3 p-3 active:bg-secondary/40">
              <span className="text-lg w-7 text-center">👥</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{g.name}</p>
                <p className="text-xs text-muted-foreground">{g.group_members?.length ?? 0} members</p>
              </div>
            </Link>
          </SwipeRow>
        ))}
      </div>

      {archivedGroups.length > 0 && (
        <>
          <p className="text-xs uppercase tracking-wider text-muted-foreground px-1 flex items-center gap-1">
            <Archive className="h-3 w-3" /> Archived
          </p>
          <div className="surface-card divide-y divide-border opacity-60">
            {archivedGroups.map((g: any) => (
              <SwipeRow
                key={g.id}
                onEdit={() => archive.mutate(g.id)}
                onDelete={() => { if (confirm("Delete group?")) del.mutate(g.id); }}
              >
                <div className="flex items-center gap-3 p-3">
                  <span className="text-lg w-7 text-center">👥</span>
                  <p className="text-sm truncate">{g.name}</p>
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