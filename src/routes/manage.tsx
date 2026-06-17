import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { categoriesQuery, allSubCategoriesQuery, peopleQuery, groupsQuery } from "@/lib/queries";
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
import { Plus, Pencil, Trash2 } from "lucide-react";

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
          <Row key={c.id} icon={c.icon ?? "📦"} label={`${c.name} · ${c.type}`}
            onEdit={() => { setEdit(c); setOpen(true); }}
            onDelete={() => del.mutate(c.id)} />
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
          <Row key={s.id} icon={s.categories?.icon ?? "•"} label={`${s.name} · ${s.categories?.name ?? ""}`} onDelete={() => del.mutate(s.id)} />
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
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any>(null);

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
        {people.map((p) => (
          <Row key={p.id} icon={p.name[0]?.toUpperCase() ?? "?"} label={`${p.name}${p.phone_number ? " · " + p.phone_number : ""}`}
            onEdit={() => { setEdit(p); setOpen(true); }}
            onDelete={() => { if (confirm("Delete person? Their split data stays.")) del.mutate(p.id); }} />
        ))}
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

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("groups").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["groups"] }); toast.success("Deleted"); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-3 mt-4">
      <Button className="w-full" variant="outline" onClick={() => { setEdit(null); setOpen(true); }}>
        <Plus className="h-4 w-4 mr-2" /> Create group
      </Button>
      <div className="surface-card divide-y divide-border">
        {groups.map((g: any) => (
          <Row key={g.id} icon="👥" label={`${g.name} · ${g.group_members?.length ?? 0} members`}
            onEdit={() => { setEdit(g); setOpen(true); }}
            onDelete={() => { if (confirm("Delete group?")) del.mutate(g.id); }} />
        ))}
      </div>
      <AddGroupDialog open={open} onOpenChange={setOpen} edit={edit} />
    </div>
  );
}

function Row({ icon, label, onEdit, onDelete }: { icon: string; label: string; onEdit?: () => void; onDelete?: () => void }) {
  return (
    <div className="flex items-center gap-3 p-3">
      <span className="text-lg w-7 text-center">{icon}</span>
      <span className="flex-1 text-sm truncate">{label}</span>
      {onEdit && <button className="text-muted-foreground p-1" onClick={onEdit}><Pencil className="h-4 w-4" /></button>}
      {onDelete && <button className="text-expense p-1" onClick={onDelete}><Trash2 className="h-4 w-4" /></button>}
    </div>
  );
}