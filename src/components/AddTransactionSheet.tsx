import { useState, useEffect, useMemo, useRef } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { accountsQuery, categoriesQuery, subCategoriesQuery, peopleQuery, groupsQuery } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { notifyToast } from "@/lib/notify";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format";
import { Plus, QrCode, GripVertical, X, ChevronRight, Check } from "lucide-react";
import { AddPersonDialog } from "@/components/AddPersonDialog";
import { AddGroupDialog } from "@/components/AddGroupDialog";
import { QrScannerDialog } from "@/components/QrScannerDialog";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

type Tab = "income" | "expense" | "transfer" | "split";

export function AddTransactionSheet({
  open,
  onOpenChange,
  defaultTab = "expense",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(defaultTab);
  useEffect(() => { if (open) setTab(defaultTab); }, [open, defaultTab]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="bg-card border-border rounded-t-3xl p-0 h-[88dvh] max-h-[88dvh] flex flex-col">
        <SheetTitle className="sr-only">Add transaction</SheetTitle>
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="flex flex-col flex-1 min-h-0">
          <div className="p-4 pb-2">
            <TabsList className="grid grid-cols-4 w-full bg-secondary">
              <TabsTrigger value="income" className="data-[state=active]:bg-[var(--color-income-bg)] data-[state=active]:text-income">Income</TabsTrigger>
              <TabsTrigger value="expense" className="data-[state=active]:bg-[var(--color-expense-bg)] data-[state=active]:text-expense">Expense</TabsTrigger>
              <TabsTrigger value="transfer" className="data-[state=active]:bg-[var(--color-transfer-bg)] data-[state=active]:text-transfer">Transfer</TabsTrigger>
              <TabsTrigger value="split" className="data-[state=active]:bg-[var(--color-split-bg)] data-[state=active]:text-split">Split</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="income" className="flex-1 min-h-0 mt-0"><IncomeForm onClose={() => onOpenChange(false)} /></TabsContent>
          <TabsContent value="expense" className="flex-1 min-h-0 mt-0"><ExpenseForm onClose={() => onOpenChange(false)} /></TabsContent>
          <TabsContent value="transfer" className="flex-1 min-h-0 mt-0"><TransferForm onClose={() => onOpenChange(false)} /></TabsContent>
          <TabsContent value="split" className="flex-1 min-h-0 mt-0"><SplitForm onClose={() => onOpenChange(false)} /></TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function AmountInput({ value, onChange, accent }: { value: string; onChange: (v: string) => void; accent: string }) {
  return (
    <div className="text-center py-4">
      <input
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ""))}
        placeholder="0.00"
        className={cn("w-full bg-transparent text-center text-5xl font-mono font-semibold outline-none", accent)}
      />
      <p className="text-xs text-muted-foreground mt-1 font-mono">LKR</p>
    </div>
  );
}

function DateTime({ date, time, setDate, setTime }: { date: string; time: string; setDate: (s: string) => void; setTime: (s: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      <div className="space-y-1.5"><Label>Time</Label><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
    </div>
  );
}

function FormShell({ children, onSubmit, button, color }: { children: React.ReactNode; onSubmit: (e: React.FormEvent) => void; button: string; color: string }) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-4">{children}</div>
      <div className="p-4 pt-2 border-t border-border bg-card">
        <Button type="submit" className={cn("w-full text-white", color)}>{button}</Button>
      </div>
    </form>
  );
}

// ─── Category Picker Sheet ─────────────────────────────────────────────────
function CategoryPickerSheet({
  open, onOpenChange, onSelect,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSelect: (catId: string, catName: string, catIcon: string, subId?: string, subName?: string) => void;
}) {
  const { data: cats = [] } = useQuery(categoriesQuery("expense"));
  const [activeCatId, setActiveCatId] = useState<string>("");
  const { data: subs = [] } = useQuery(subCategoriesQuery(activeCatId || null));
  const [addOpen, setAddOpen] = useState(false);
  const [addType, setAddType] = useState<"category" | "sub-category">("category");
  const [newCatName, setNewCatName] = useState("");
  const [newCatIcon, setNewCatIcon] = useState("📦");
  const [newSubName, setNewSubName] = useState("");
  const [newSubParentId, setNewSubParentId] = useState("");
  const qc = useQueryClient();

  useEffect(() => {
    if (cats.length > 0 && !activeCatId) setActiveCatId((cats[0] as any).id);
  }, [cats]);

  async function addCategory() {
    if (!newCatName.trim()) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("categories").insert({
      user_id: u.user.id, name: newCatName.trim(), icon: newCatIcon, type: "expense", is_default: false,
    });
    if (error) toast.error(error.message);
    else { toast.success("Category added"); qc.invalidateQueries({ queryKey: ["categories"] }); setNewCatName(""); setNewCatIcon("📦"); setAddOpen(false); }
  }

  async function addSubCategory() {
    if (!newSubName.trim() || !newSubParentId) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("sub_categories").insert({
      user_id: u.user.id, category_id: newSubParentId, name: newSubName.trim(), is_default: false,
    });
    if (error) toast.error(error.message);
    else { toast.success("Sub-category added"); qc.invalidateQueries({ queryKey: ["sub_categories"] }); setNewSubName(""); setNewSubParentId(""); setAddOpen(false); }
  }

  const activeCat = (cats as any[]).find((c) => c.id === activeCatId);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="bg-card border-border rounded-t-3xl p-0 h-[75dvh] flex flex-col">
          <SheetTitle className="sr-only">Select Category</SheetTitle>
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border">
            <span className="text-base font-semibold">Category</span>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setAddOpen(true)} className="text-muted-foreground hover:text-foreground"><Plus className="h-5 w-5" /></button>
              <button type="button" onClick={() => onOpenChange(false)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>
          </div>
          <div className="flex flex-1 min-h-0">
            <div className="w-[45%] border-r border-border overflow-y-auto">
              {(cats as any[]).map((c) => (
                <button key={c.id} type="button" onClick={() => setActiveCatId(c.id)}
                  className={cn("w-full flex items-center justify-between px-4 py-4 text-left text-sm border-b border-border transition-colors",
                    activeCatId === c.id ? "bg-primary/10 text-primary font-medium" : "bg-card text-foreground")}>
                  <span className="truncate">{c.icon} {c.name}</span>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 ml-1 text-muted-foreground" />
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto">
              {activeCat && (
                <button type="button" onClick={() => { onSelect(activeCat.id, activeCat.name, activeCat.icon ?? ""); onOpenChange(false); }}
                  className="w-full px-4 py-4 text-left text-sm border-b border-border text-primary font-medium bg-primary/5">
                  {activeCat.icon} {activeCat.name} only
                </button>
              )}
              {subs.length === 0 && <p className="text-xs text-muted-foreground px-4 py-4">No sub-categories</p>}
              {(subs as any[]).map((s) => (
                <button key={s.id} type="button"
                  onClick={() => { onSelect(activeCat!.id, activeCat!.name, activeCat!.icon ?? "", s.id, s.name); onOpenChange(false); }}
                  className="w-full px-4 py-4 text-left text-sm border-b border-border bg-card hover:bg-secondary/40 text-foreground">
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogTitle>Add Category or Sub-category</DialogTitle>
          <div className="space-y-4">
            <div className="flex gap-2 rounded-lg bg-secondary p-1">
              {(["category", "sub-category"] as const).map((m) => (
                <button key={m} type="button" onClick={() => setAddType(m)}
                  className={cn("flex-1 rounded-md py-1.5 text-sm capitalize", addType === m && "bg-primary text-white")}>{m}</button>
              ))}
            </div>
            {addType === "category" ? (
              <div className="flex gap-2">
                <Input placeholder="😀" value={newCatIcon} onChange={(e) => setNewCatIcon(e.target.value)} className="w-16 text-center text-lg" maxLength={2} />
                <Input placeholder="Category name" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} className="flex-1" />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Parent Category</Label>
                  <Select value={newSubParentId} onValueChange={setNewSubParentId}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>{(cats as any[]).map((c) => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Sub-category name</Label>
                  <Input placeholder="e.g. Breakfast, Lunch" value={newSubName} onChange={(e) => setNewSubName(e.target.value)} />
                </div>
              </div>
            )}
            <Button className="w-full" onClick={addType === "category" ? addCategory : addSubCategory}>Add</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Person Picker Sheet (single select) ──────────────────────────────────
function PersonPickerSheet({
  open, onOpenChange, onSelect,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSelect: (id: string, name: string) => void;
}) {
  const { data: people = [] } = useQuery(peopleQuery());
  const [order, setOrder] = useState<string[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const dragIdx = useRef<number | null>(null);

  useEffect(() => { if (people.length > 0 && order.length === 0) setOrder(people.map((p: any) => p.id)); }, [people]);

  const ordered = useMemo(() => {
    if (order.length === 0) return people;
    return [...people].sort((a: any, b: any) => {
      const ai = order.indexOf(a.id); const bi = order.indexOf(b.id);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
  }, [people, order]);

  function handleDragStart(idx: number) { dragIdx.current = idx; }
  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    if (dragIdx.current === null || dragIdx.current === idx) return;
    const newOrder = [...ordered.map((p: any) => p.id)];
    const [moved] = newOrder.splice(dragIdx.current, 1);
    newOrder.splice(idx, 0, moved);
    dragIdx.current = idx;
    setOrder(newOrder);
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="bg-card border-border rounded-t-3xl p-0 h-[75dvh] flex flex-col">
          <SheetTitle className="sr-only">Select Person</SheetTitle>
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border">
            <span className="text-base font-semibold">Person</span>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setQrOpen(true)} className="text-muted-foreground hover:text-foreground"><QrCode className="h-5 w-5" /></button>
              <button type="button" onClick={() => setAddOpen(true)} className="text-muted-foreground hover:text-foreground"><Plus className="h-5 w-5" /></button>
              <button type="button" onClick={() => onOpenChange(false)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {ordered.length === 0 && <p className="text-sm text-muted-foreground text-center py-10">No people yet. Tap + to add.</p>}
            {ordered.map((p: any, idx: number) => (
              <div key={p.id} draggable onDragStart={() => handleDragStart(idx)} onDragOver={(e) => handleDragOver(e, idx)}
                className="flex items-center gap-3 px-5 py-4 bg-card active:bg-secondary/40 cursor-pointer">
                <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                <div className="flex-1" onClick={() => { onSelect(p.id, p.name); onOpenChange(false); }}>
                  <p className="text-sm font-medium">{p.name}</p>
                  {p.phone_number && <p className="text-xs text-muted-foreground">{p.phone_number}</p>}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
      <AddPersonDialog open={addOpen} onOpenChange={setAddOpen} />
      <QrScannerDialog open={qrOpen} onOpenChange={setQrOpen} onResult={() => {}} />
    </>
  );
}

// ─── Multi Person Picker Sheet (checkbox style) ────────────────────────────
function MultiPersonPickerSheet({
  open, onOpenChange, selected, onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  selected: { id: string; name: string }[];
  onConfirm: (people: { id: string; name: string }[]) => void;
}) {
  const { data: people = [] } = useQuery(peopleQuery());
  const [checked, setChecked] = useState<Set<string>>(new Set(selected.map((p) => p.id)));
  const [addOpen, setAddOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  useEffect(() => { if (open) setChecked(new Set(selected.map((p) => p.id))); }, [open]);

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function confirm() {
    const result = (people as any[]).filter((p) => checked.has(p.id)).map((p) => ({ id: p.id, name: p.name }));
    onConfirm(result);
    onOpenChange(false);
  }

  // Once a person is selected, lock the list to matching type (linked vs local) to prevent mixing.
  const peopleArr = people as any[];
  const checkedPeople = peopleArr.filter((p) => checked.has(p.id));
  const lockMode: "linked" | "local" | null = checkedPeople.length > 0
    ? (checkedPeople[0].linked_user_id ? "linked" : "local")
    : null;
  const visiblePeople = lockMode === null
    ? peopleArr
    : peopleArr.filter((p) => checked.has(p.id) || (lockMode === "linked" ? !!p.linked_user_id : !p.linked_user_id));

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="bg-card border-border rounded-t-3xl p-0 h-[75dvh] flex flex-col">
          <SheetTitle className="sr-only">Select People</SheetTitle>
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border">
            <span className="text-base font-semibold">Select People</span>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setQrOpen(true)} className="text-muted-foreground hover:text-foreground"><QrCode className="h-5 w-5" /></button>
              <button type="button" onClick={() => setAddOpen(true)} className="text-muted-foreground hover:text-foreground"><Plus className="h-5 w-5" /></button>
              <button type="button" onClick={() => onOpenChange(false)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>
          </div>
          {lockMode !== null && (
            <p className="px-5 py-2 text-xs text-muted-foreground bg-secondary/30 border-b border-border">
              {lockMode === "linked" ? "Only linked CashFlow users can be added" : "Only local contacts can be added"}
            </p>
          )}
          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {visiblePeople.length === 0 && <p className="text-sm text-muted-foreground text-center py-10">No people yet. Tap + to add.</p>}
            {visiblePeople.map((p) => (
              <div key={p.id} onClick={() => toggle(p.id)}
                className="flex items-center gap-3 px-5 py-4 bg-card active:bg-secondary/40 cursor-pointer">
                <div className={cn("h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                  checked.has(p.id) ? "bg-primary border-primary" : "border-border")}>
                  {checked.has(p.id) && <Check className="h-3 w-3 text-white" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{p.name}</p>
                  {p.phone_number && <p className="text-xs text-muted-foreground">{p.phone_number}</p>}
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-border">
            <Button className="w-full bg-primary text-white" onClick={confirm} disabled={checked.size === 0}>
              Confirm ({checked.size} selected)
            </Button>
          </div>
        </SheetContent>
      </Sheet>
      <AddPersonDialog open={addOpen} onOpenChange={setAddOpen} />
      <QrScannerDialog open={qrOpen} onOpenChange={setQrOpen} onResult={() => {}} />
    </>
  );
}

// ─── Group Picker Sheet ────────────────────────────────────────────────────
function GroupPickerSheet({
  open, onOpenChange, onSelect,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSelect: (id: string, name: string) => void;
}) {
  const { data: groups = [] } = useQuery(groupsQuery());
  const [addOpen, setAddOpen] = useState(false);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="bg-card border-border rounded-t-3xl p-0 h-[75dvh] flex flex-col">
          <SheetTitle className="sr-only">Select Group</SheetTitle>
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border">
            <span className="text-base font-semibold">Group</span>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setAddOpen(true)} className="text-muted-foreground hover:text-foreground"><Plus className="h-5 w-5" /></button>
              <button type="button" onClick={() => onOpenChange(false)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {groups.length === 0 && <p className="text-sm text-muted-foreground text-center py-10">No groups yet. Tap + to add.</p>}
            {(groups as any[]).map((g) => (
              <div key={g.id} onClick={() => { onSelect(g.id, g.name); onOpenChange(false); }}
                className="flex items-center gap-3 px-5 py-4 bg-card active:bg-secondary/40 cursor-pointer">
                <div className="flex-1">
                  <p className="text-sm font-medium">{g.name}</p>
                  <p className="text-xs text-muted-foreground">{g.group_members?.length ?? 0} members</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
      <AddGroupDialog open={addOpen} onOpenChange={setAddOpen} />
    </>
  );
}

// ─── Custom Split Sheet ────────────────────────────────────────────────────
function CustomSplitSheet({
  open, onOpenChange, participants, total, onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  participants: { id: string; name: string }[];
  total: number;
  onConfirm: (amounts: Record<string, number>) => void;
}) {
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      const init: Record<string, string> = {};
      participants.forEach((p) => { init[p.id] = ""; });
      setAmounts(init);
    }
  }, [open, participants]);

  const assigned = Object.values(amounts).reduce((s, v) => s + (Number(v) || 0), 0);
  const myShare = total - assigned;
  const remaining = myShare;

  function confirm() {
    const result: Record<string, number> = {};
    participants.forEach((p) => { result[p.id] = Number(amounts[p.id]) || 0; });
    onConfirm(result);
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="bg-card border-border rounded-t-3xl p-0 h-[75dvh] flex flex-col">
        <SheetTitle className="sr-only">Custom Split</SheetTitle>
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border">
          <span className="text-base font-semibold">Custom Split</span>
          <button type="button" onClick={() => onOpenChange(false)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        {/* Total summary */}
        <div className="px-5 py-3 bg-secondary/30 border-b border-border">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total</span>
            <span className="font-mono font-semibold">{formatMoney(total)}</span>
          </div>
          <div className="flex justify-between text-sm mt-1">
            <span className="text-muted-foreground">Your share</span>
            <span className={cn("font-mono font-semibold", remaining < 0 ? "text-expense" : "text-income")}>
              {formatMoney(remaining)}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {participants.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-5 py-4">
              <div className="flex-1">
                <p className="text-sm font-medium">{p.name}</p>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground font-mono">LKR</span>
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amounts[p.id] ?? ""}
                  onChange={(e) => setAmounts((prev) => ({ ...prev, [p.id]: e.target.value }))}
                  className="w-28 bg-secondary rounded-md px-2 py-1.5 text-sm text-right font-mono outline-none border border-border focus:border-primary"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-border">
          <Button className="w-full bg-primary text-white" onClick={confirm}>
            Confirm Split
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Source Picker Sheet ───────────────────────────────────────────────────
const DEFAULT_SOURCES = ["Salary", "Freelance", "Business", "Gift", "Bonus", "Rental", "Investment", "Other"];

function SourcePickerSheet({
  open, onOpenChange, onSelect,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSelect: (source: string) => void;
}) {
  const [sources, setSources] = useState<string[]>(DEFAULT_SOURCES);
  const [addOpen, setAddOpen] = useState(false);
  const [newSource, setNewSource] = useState("");
  const dragIdx = useRef<number | null>(null);

  function handleDragStart(idx: number) { dragIdx.current = idx; }
  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    if (dragIdx.current === null || dragIdx.current === idx) return;
    const newArr = [...sources];
    const [moved] = newArr.splice(dragIdx.current, 1);
    newArr.splice(idx, 0, moved);
    dragIdx.current = idx;
    setSources(newArr);
  }

  function addSource() {
    if (!newSource.trim()) return;
    setSources((prev) => [newSource.trim(), ...prev]);
    setNewSource("");
    setAddOpen(false);
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="bg-card border-border rounded-t-3xl p-0 h-[75dvh] flex flex-col">
          <SheetTitle className="sr-only">Select Source</SheetTitle>
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border">
            <span className="text-base font-semibold">Source</span>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setAddOpen(true)} className="text-muted-foreground hover:text-foreground"><Plus className="h-5 w-5" /></button>
              <button type="button" onClick={() => onOpenChange(false)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {sources.map((s, idx) => (
              <div key={s} draggable onDragStart={() => handleDragStart(idx)} onDragOver={(e) => handleDragOver(e, idx)}
                className="flex items-center gap-3 px-5 py-4 bg-card active:bg-secondary/40 cursor-pointer">
                <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                <div className="flex-1" onClick={() => { onSelect(s); onOpenChange(false); }}>
                  <p className="text-sm font-medium">{s}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogTitle>Add Source</DialogTitle>
          <div className="space-y-4">
            <Input placeholder="e.g. Rental, Dividend" value={newSource} onChange={(e) => setNewSource(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSource(); } }} />
            <Button className="w-full" onClick={addSource}>Add</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Income Form ───────────────────────────────────────────────────────────
function IncomeForm({ onClose }: { onClose: () => void }) {
  const { data: accounts = [] } = useQuery(accountsQuery());
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [sourceType, setSourceType] = useState<"person" | "source">("source");
  const [personId, setPersonId] = useState("");
  const [personName, setPersonName] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [accountId, setAccountId] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [time, setTime] = useState(format(new Date(), "HH:mm"));
  const [note, setNote] = useState("");
  const [personPickerOpen, setPersonPickerOpen] = useState(false);
  const [sourcePickerOpen, setSourcePickerOpen] = useState(false);

  useEffect(() => { if (accounts[0]?.id) setAccountId(accounts[0].id); }, [accounts]);

  const mutation = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { error } = await supabase.from("transactions").insert({
        user_id: u.user.id, type: "income", amount: Number(amount), account_id: accountId || null,
        income_source_type: sourceType,
        income_person_id: sourceType === "person" && personId ? personId : null,
        income_source_text: sourceType === "source" ? sourceText : null,
        date, time, note: note || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Income added"); qc.invalidateQueries({ queryKey: ["transactions"] }); qc.invalidateQueries({ queryKey: ["accounts"] }); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <>
      <FormShell color="bg-[oklch(0.40_0.13_145)] hover:bg-[oklch(0.45_0.13_145)]" button="Save income"
        onSubmit={(e) => {
          e.preventDefault();
          const amt = Number(amount);
          if (!amount || isNaN(amt) || amt <= 0) { toast.error("Amount must be greater than 0"); return; }
          if (!accountId) { toast.error("Please select an account"); return; }
          if (sourceType === "person" && !personId) { toast.error("Please select a person"); return; }
          if (sourceType === "source" && !sourceText.trim()) { toast.error("Please enter or select a source"); return; }
          mutation.mutate();
        }}>
        <AmountInput value={amount} onChange={setAmount} accent="text-income" />
        <div className="space-y-1.5">
          <Label>From</Label>
          <div className="flex gap-2 rounded-lg bg-secondary p-1">
            {(["person", "source"] as const).map((m) => (
              <button type="button" key={m} onClick={() => setSourceType(m)}
                className={cn("flex-1 rounded-md py-1.5 text-sm capitalize", sourceType === m && "bg-primary text-white")}>{m}</button>
            ))}
          </div>
          {sourceType === "person" && (
            <button type="button" onClick={() => setPersonPickerOpen(true)}
              className="w-full flex items-center justify-between px-3 py-2.5 bg-secondary rounded-lg text-sm">
              <span className={personName ? "text-foreground" : "text-muted-foreground"}>{personName || "Select person"}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
          {sourceType === "source" && (
            <button type="button" onClick={() => setSourcePickerOpen(true)}
              className="w-full flex items-center justify-between px-3 py-2.5 bg-secondary rounded-lg text-sm">
              <span className={sourceText ? "text-foreground" : "text-muted-foreground"}>{sourceText || "Select source"}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
        <div className="space-y-1.5">
          <Label>To account</Label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
            <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={a.id}>{[a.institution, a.label].filter(Boolean).join(" · ")}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <DateTime date={date} time={time} setDate={setDate} setTime={setTime} />
        <div className="space-y-1.5"><Label>Note</Label><Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} /></div>
      </FormShell>
      <PersonPickerSheet open={personPickerOpen} onOpenChange={setPersonPickerOpen} onSelect={(id, name) => { setPersonId(id); setPersonName(name); }} />
      <SourcePickerSheet open={sourcePickerOpen} onOpenChange={setSourcePickerOpen} onSelect={(s) => setSourceText(s)} />
    </>
  );
}

// ─── Expense Form ──────────────────────────────────────────────────────────
function ExpenseForm({ onClose }: { onClose: () => void }) {
  const { data: accounts = [] } = useQuery(accountsQuery());
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [categoryIcon, setCategoryIcon] = useState("");
  const [subCatId, setSubCatId] = useState("");
  const [subCatName, setSubCatName] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [time, setTime] = useState(format(new Date(), "HH:mm"));
  const [note, setNote] = useState("");
  const [catPickerOpen, setCatPickerOpen] = useState(false);

  useEffect(() => { if (accounts[0]?.id) setAccountId(accounts[0].id); }, [accounts]);

  const mutation = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { error } = await supabase.from("transactions").insert({
        user_id: u.user.id, type: "expense", amount: Number(amount),
        account_id: accountId || null, category_id: categoryId || null,
        sub_category_id: subCatId || null, date, time, note: note || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Expense added"); qc.invalidateQueries({ queryKey: ["transactions"] }); qc.invalidateQueries({ queryKey: ["accounts"] }); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <>
      <FormShell color="bg-[oklch(0.40_0.18_25)] hover:bg-[oklch(0.45_0.18_25)]" button="Save expense"
        onSubmit={(e) => {
          e.preventDefault();
          const amt = Number(amount);
          if (!amount || isNaN(amt) || amt <= 0) { toast.error("Amount must be greater than 0"); return; }
          if (!accountId) { toast.error("Please select an account"); return; }
          if (!categoryId) { toast.error("Please select a category"); return; }
          mutation.mutate();
        }}>
        <AmountInput value={amount} onChange={setAmount} accent="text-expense" />
        <div className="space-y-1.5">
          <Label>From account</Label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
            <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={a.id}>{[a.institution, a.label].filter(Boolean).join(" · ")}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Category</Label>
          <button type="button" onClick={() => setCatPickerOpen(true)}
            className="w-full flex items-center justify-between px-3 py-2.5 bg-secondary rounded-lg text-sm">
            <span className={categoryId ? "text-foreground" : "text-muted-foreground"}>
              {categoryId ? `${categoryIcon} ${categoryName}${subCatName ? " · " + subCatName : ""}` : "Select category"}
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <DateTime date={date} time={time} setDate={setDate} setTime={setTime} />
        <div className="space-y-1.5"><Label>Note</Label><Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} /></div>
      </FormShell>
      <CategoryPickerSheet open={catPickerOpen} onOpenChange={setCatPickerOpen}
        onSelect={(cId, cName, cIcon, sId, sName) => { setCategoryId(cId); setCategoryName(cName); setCategoryIcon(cIcon); setSubCatId(sId ?? ""); setSubCatName(sName ?? ""); }} />
    </>
  );
}

// ─── Transfer Form ─────────────────────────────────────────────────────────
function TransferForm({ onClose }: { onClose: () => void }) {
  const { data: accounts = [] } = useQuery(accountsQuery());
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [time, setTime] = useState(format(new Date(), "HH:mm"));
  const [note, setNote] = useState("");

  useEffect(() => { if (accounts[0]?.id) setFromId(accounts[0].id); if (accounts[1]?.id) setToId(accounts[1].id); }, [accounts]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (fromId === toId) throw new Error("Choose two different accounts");
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { error } = await supabase.from("transactions").insert({
        user_id: u.user.id, type: "transfer", amount: Number(amount),
        account_id: fromId || null, to_account_id: toId || null, date, time, note: note || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Transfer recorded"); qc.invalidateQueries({ queryKey: ["transactions"] }); qc.invalidateQueries({ queryKey: ["accounts"] }); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <FormShell color="bg-[oklch(0.40_0.13_252)] hover:bg-[oklch(0.45_0.13_252)]" button="Save transfer"
      onSubmit={(e) => {
        e.preventDefault();
        const amt = Number(amount);
        if (!amount || isNaN(amt) || amt <= 0) { toast.error("Amount must be greater than 0"); return; }
        if (!fromId) { toast.error("Please select a from account"); return; }
        if (!toId) { toast.error("Please select a to account"); return; }
        if (fromId === toId) { toast.error("From and To accounts must be different"); return; }
        mutation.mutate();
      }}>
      <AmountInput value={amount} onChange={setAmount} accent="text-transfer" />
      <div className="space-y-1.5">
        <Label>From account</Label>
        <Select value={fromId} onValueChange={setFromId}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={a.id}>{[a.institution, a.label].filter(Boolean).join(" · ")}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>To account</Label>
        <Select value={toId} onValueChange={setToId}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={a.id}>{[a.institution, a.label].filter(Boolean).join(" · ")}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <DateTime date={date} time={time} setDate={setDate} setTime={setTime} />
      <div className="space-y-1.5"><Label>Note</Label><Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} /></div>
    </FormShell>
  );
}

// ─── Split Form ────────────────────────────────────────────────────────────
function SplitForm({ onClose }: { onClose: () => void }) {
  const { data: accounts = [] } = useQuery(accountsQuery());
  const { data: groups = [] } = useQuery(groupsQuery());
  const qc = useQueryClient();

  const [amount, setAmount] = useState("");
  const [target, setTarget] = useState<"person" | "multi" | "group">("person");

  // Single person
  const [personId, setPersonId] = useState("");
  const [personName, setPersonName] = useState("");
  const [personPickerOpen, setPersonPickerOpen] = useState(false);

  // Multi person
  const [multiPeople, setMultiPeople] = useState<{ id: string; name: string }[]>([]);
  const [multiPickerOpen, setMultiPickerOpen] = useState(false);

  // Group
  const [groupId, setGroupId] = useState("");
  const [groupName, setGroupName] = useState("");
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);

  // Who paid
  const [whoPaid, setWhoPaid] = useState<"me" | "other">("me");
  const [otherPayerId, setOtherPayerId] = useState<string>("");
  const [accountId, setAccountId] = useState("");

  // Split type
  const [splitType, setSplitType] = useState<"equal" | "custom">("equal");
  const [customAmounts, setCustomAmounts] = useState<Record<string, number>>({});
  const [customSheetOpen, setCustomSheetOpen] = useState(false);

  // Category
  const [categoryId, setCategoryId] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [categoryIcon, setCategoryIcon] = useState("");
  const [subCatId, setSubCatId] = useState("");
  const [subCatName, setSubCatName] = useState("");
  const [catPickerOpen, setCatPickerOpen] = useState(false);

  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [time, setTime] = useState(format(new Date(), "HH:mm"));
  const [note, setNote] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => { if (accounts[0]?.id) setAccountId(accounts[0].id); }, [accounts]);

  // Reset who paid when target changes
  useEffect(() => { setWhoPaid("me"); setOtherPayerId(""); }, [target]);

  // All participants depending on target
  const participants: { id: string; name: string }[] = useMemo(() => {
    if (target === "person" && personId && personName) return [{ id: personId, name: personName }];
    if (target === "multi") return multiPeople;
    if (target === "group") {
      const g = (groups as any[]).find((x) => x.id === groupId);
      return (g?.group_members ?? []).map((m: any) => ({ id: m.person_id, name: m.people?.name ?? "?" }));
    }
    return [];
  }, [target, personId, personName, multiPeople, groupId, groups]);

  const total = Number(amount);
  const equalShare = participants.length > 0 ? total / (participants.length + 1) : 0;

  // Resolve paid_by string and payer person_id for DB
  const paidByValue = useMemo(() => {
    if (whoPaid === "me") return "me";
    if (target === "person") return personName;
    if (target === "multi" || target === "group") {
      const p = participants.find((x) => x.id === otherPayerId);
      return p?.name ?? "other";
    }
    return "other";
  }, [whoPaid, target, personName, participants, otherPayerId]);

  const paidByPersonId = useMemo((): string | null => {
    if (whoPaid === "me") return null;
    if (target === "person") return personId || null;
    return otherPayerId || null;
  }, [whoPaid, target, personId, otherPayerId]);

  const mutation = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      if (!total) throw new Error("Enter an amount");
      if (target !== "group" && participants.length === 0) throw new Error("Select at least one person");
      if (target === "group" && !groupId) throw new Error("Select a group");

      // Account-pending: if someone OTHER than me paid and that payer is a linked CashFlow user,
      // we don't yet know which of THEIR accounts the money came from — they must confirm it later.
      const payerPerson = whoPaid !== "me" && paidByPersonId
        ? (people as any[]).find((p) => p.id === paidByPersonId)
        : null;
      const payerLinkedUserId: string | null = payerPerson?.linked_user_id ?? null;
      const isAccountPending = !!payerLinkedUserId;

      // Cap unconfirmed payments per payer so they don't pile up.
      if (isAccountPending) {
        const { count } = await supabase
          .from("splits")
          .select("*", { count: "exact", head: true })
          .eq("account_pending", true)
          .eq("pending_for_user_id", payerLinkedUserId);
        if (count && count >= 3) {
          throw new Error("This user has 3 unconfirmed payments pending. Ask them to confirm before adding more.");
        }
      }

      const { data: split, error } = await supabase.from("splits").insert({
        type: target === "group" ? "group" : "individual",
        person_id: target === "person" && personId ? personId : null,
        group_id: target === "group" && groupId ? groupId : null,
        description: description.trim() || null,
        total_amount: total,
        paid_by: paidByValue,
        paid_by_person_id: paidByPersonId,
        split_type: splitType,
        category_id: categoryId || null,
        sub_category_id: subCatId || null,
        account_id: whoPaid === "me" && accountId ? accountId : null,
        account_pending: isAccountPending,
        pending_for_user_id: isAccountPending ? payerLinkedUserId : null,
        date, time, created_by: u.user.id,
      }).select("*").single();
      if (error) throw error;

      const shares = participants.map((p) => ({
        split_id: split.id,
        person_name: p.name,
        person_id: p.id || null,
        share_amount: splitType === "custom" ? (customAmounts[p.id] ?? 0) : equalShare,
      }));
      if (shares.length > 0) {
        const { error: e2 } = await supabase.from("split_shares").insert(shares);
        if (e2) throw e2;
      }

      if (whoPaid === "me" && accountId) {
        await supabase.from("transactions").insert({
          user_id: u.user.id, type: "expense", amount: total,
          account_id: accountId || null, category_id: categoryId || null,
          sub_category_id: subCatId || null,
          note: note ? `Split: ${note}` : "Split expense",
          date, time, is_split: true, split_id: split.id,
        });
      }
    },
    onSuccess: () => {
      notifyToast("split_added", "Split added");
      qc.invalidateQueries({ queryKey: ["splits"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <>
      <FormShell color="bg-[oklch(0.40_0.13_70)] hover:bg-[oklch(0.45_0.13_70)]" button="Save split"
        onSubmit={(e) => {
          e.preventDefault();
          const amt = Number(amount);
          if (!amount || isNaN(amt) || amt <= 0) { toast.error("Amount must be greater than 0"); return; }
          if (!description.trim()) { toast.error("Please enter a description"); return; }
          if (target === "person" && !personId) { toast.error("Please select a person"); return; }
          if (target === "multi" && multiPeople.length === 0) { toast.error("Please select at least one person"); return; }
          if (target === "group" && !groupId) { toast.error("Please select a group"); return; }
          if (!categoryId) { toast.error("Please select a category"); return; }
          if (whoPaid === "me" && !accountId) { toast.error("Please select an account"); return; }
          mutation.mutate();
        }}>
        <AmountInput value={amount} onChange={setAmount} accent="text-split" />

        <div className="space-y-1.5">
          <Label>Description</Label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Dinner, Groceries, Trip"
            className="w-full text-sm text-white placeholder:text-muted-foreground outline-none px-3 py-2.5"
            style={{ background: "#0A0A0A", border: "1px solid #2A2A2A", borderRadius: "8px" }}
          />
        </div>

        {/* Split with */}
        <div className="space-y-1.5">
          <Label>Split with</Label>
          <div className="flex gap-2 rounded-lg bg-secondary p-1">
            {(["person", "multi", "group"] as const).map((m) => (
              <button type="button" key={m} onClick={() => setTarget(m)}
                className={cn("flex-1 rounded-md py-1.5 text-xs font-medium capitalize", target === m && "bg-primary text-white")}>
                {m === "multi" ? "People" : m}
              </button>
            ))}
          </div>

          {target === "person" && (
            <button type="button" onClick={() => setPersonPickerOpen(true)}
              className="w-full flex items-center justify-between px-3 py-2.5 bg-secondary rounded-lg text-sm">
              <span className={personName ? "text-foreground" : "text-muted-foreground"}>{personName || "Select person"}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          )}

          {target === "multi" && (
            <button type="button" onClick={() => setMultiPickerOpen(true)}
              className="w-full flex items-center justify-between px-3 py-2.5 bg-secondary rounded-lg text-sm">
              <span className={multiPeople.length > 0 ? "text-foreground" : "text-muted-foreground"}>
                {multiPeople.length > 0 ? multiPeople.map((p) => p.name).join(", ") : "Select people"}
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          )}

          {target === "group" && (
            <button type="button" onClick={() => setGroupPickerOpen(true)}
              className="w-full flex items-center justify-between px-3 py-2.5 bg-secondary rounded-lg text-sm">
              <span className={groupName ? "text-foreground" : "text-muted-foreground"}>{groupName || "Select group"}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Who paid */}
        <div className="space-y-1.5">
          <Label>Who paid?</Label>

          {/* You / Other toggle — same for all targets */}
          <div className="flex gap-2 rounded-lg bg-secondary p-1">
            {(["me", "other"] as const).map((m) => (
              <button type="button" key={m} onClick={() => { setWhoPaid(m); setOtherPayerId(""); }}
                className={cn("flex-1 rounded-md py-1.5 text-sm", whoPaid === m && "bg-primary text-white")}>
                {m === "me" ? "You paid" : "Other paid"}
              </button>
            ))}
          </div>

          {/* Person target + Other paid → no extra UI needed, person name is used automatically */}
          {whoPaid === "other" && target === "person" && personName && (
            <p className="text-xs text-muted-foreground px-1">
              {personName} paid for this expense
            </p>
          )}

          {/* Multi target + Other paid → dropdown to pick who paid */}
          {whoPaid === "other" && target === "multi" && multiPeople.length > 0 && (
            <Select value={otherPayerId} onValueChange={setOtherPayerId}>
              <SelectTrigger><SelectValue placeholder="Select who paid" /></SelectTrigger>
              <SelectContent>
                {multiPeople.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Group target + Other paid → dropdown to pick which member paid */}
          {whoPaid === "other" && target === "group" && participants.length > 0 && (
            <Select value={otherPayerId} onValueChange={setOtherPayerId}>
              <SelectTrigger><SelectValue placeholder="Select who paid" /></SelectTrigger>
              <SelectContent>
                {participants.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Account — only if "me" paid */}
        {whoPaid === "me" && (
          <div className="space-y-1.5">
            <Label>Paid from</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={a.id}>{[a.institution, a.label].filter(Boolean).join(" · ")}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}

        {/* Split type */}
        <div className="space-y-1.5">
          <Label>Split type</Label>
          <div className="flex gap-2 rounded-lg bg-secondary p-1">
            {(["equal", "custom"] as const).map((m) => (
              <button type="button" key={m}
                onClick={() => { setSplitType(m); if (m === "custom" && participants.length > 0) setCustomSheetOpen(true); }}
                className={cn("flex-1 rounded-md py-1.5 text-sm capitalize", splitType === m && "bg-primary text-white")}>{m}</button>
            ))}
          </div>
          {splitType === "equal" && participants.length > 0 && (
            <p className="text-xs text-muted-foreground">Each person pays: {formatMoney(equalShare)}</p>
          )}
          {splitType === "custom" && Object.keys(customAmounts).length > 0 && (
            <div className="space-y-1 mt-1">
              {participants.map((p) => (
                <div key={p.id} className="flex justify-between text-xs text-muted-foreground px-1">
                  <span>{p.name}</span>
                  <span className="font-mono">{formatMoney(customAmounts[p.id] ?? 0)}</span>
                </div>
              ))}
              <button type="button" onClick={() => setCustomSheetOpen(true)} className="text-xs text-primary underline mt-1">Edit amounts</button>
            </div>
          )}
        </div>

        {/* Category */}
        <div className="space-y-1.5">
          <Label>Category</Label>
          <button type="button" onClick={() => setCatPickerOpen(true)}
            className="w-full flex items-center justify-between px-3 py-2.5 bg-secondary rounded-lg text-sm">
            <span className={categoryId ? "text-foreground" : "text-muted-foreground"}>
              {categoryId ? `${categoryIcon} ${categoryName}${subCatName ? " · " + subCatName : ""}` : "Select category"}
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <DateTime date={date} time={time} setDate={setDate} setTime={setTime} />
        <div className="space-y-1.5"><Label>Note</Label><Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} /></div>
      </FormShell>

      <PersonPickerSheet open={personPickerOpen} onOpenChange={setPersonPickerOpen}
        onSelect={(id, name) => { setPersonId(id); setPersonName(name); }} />

      <MultiPersonPickerSheet open={multiPickerOpen} onOpenChange={setMultiPickerOpen}
        selected={multiPeople} onConfirm={setMultiPeople} />

      <GroupPickerSheet open={groupPickerOpen} onOpenChange={setGroupPickerOpen}
        onSelect={(id, name) => { setGroupId(id); setGroupName(name); }} />

      <CustomSplitSheet open={customSheetOpen} onOpenChange={setCustomSheetOpen}
        participants={participants} total={total}
        onConfirm={(amounts) => setCustomAmounts(amounts)} />

      <CategoryPickerSheet open={catPickerOpen} onOpenChange={setCatPickerOpen}
        onSelect={(cId, cName, cIcon, sId, sName) => { setCategoryId(cId); setCategoryName(cName); setCategoryIcon(cIcon); setSubCatId(sId ?? ""); setSubCatName(sName ?? ""); }} />
    </>
  );
}