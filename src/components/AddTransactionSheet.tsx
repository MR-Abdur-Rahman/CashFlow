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
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format";
import { Plus, QrCode, GripVertical, X, ChevronRight, Pencil } from "lucide-react";
import { AddPersonDialog } from "@/components/AddPersonDialog";
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

// ─── Category Picker Sheet (two-column like reference image) ───────────────
function CategoryPickerSheet({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSelect: (catId: string, catName: string, catIcon: string, subId?: string, subName?: string) => void;
}) {
  const { data: cats = [] } = useQuery(categoriesQuery("expense"));
  const [activeCatId, setActiveCatId] = useState<string>("");
  const { data: subs = [] } = useQuery(subCategoriesQuery(activeCatId || null));
  const [addCatOpen, setAddCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatIcon, setNewCatIcon] = useState("📦");
  const qc = useQueryClient();

  useEffect(() => {
    if (cats.length > 0 && !activeCatId) setActiveCatId((cats[0] as any).id);
  }, [cats]);

  async function addCategory() {
    if (!newCatName.trim()) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("categories").insert({
      user_id: u.user.id,
      name: newCatName.trim(),
      icon: newCatIcon,
      type: "expense",
      is_default: false,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Category added");
      qc.invalidateQueries({ queryKey: ["categories"] });
      setNewCatName("");
      setAddCatOpen(false);
    }
  }

  const activeCat = (cats as any[]).find((c) => c.id === activeCatId);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="bg-card border-border rounded-t-3xl p-0 h-[75dvh] flex flex-col">
          <SheetTitle className="sr-only">Select Category</SheetTitle>
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border bg-[#1a1a1a]">
            <span className="text-base font-semibold">Category</span>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setAddCatOpen(true)} className="text-muted-foreground hover:text-foreground">
                <Pencil className="h-5 w-5" />
              </button>
              <button type="button" onClick={() => onOpenChange(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Two-column body */}
          <div className="flex flex-1 min-h-0">
            {/* Left — categories */}
            <div className="w-[45%] border-r border-border overflow-y-auto">
              {(cats as any[]).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveCatId(c.id)}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-4 text-left text-sm border-b border-border transition-colors",
                    activeCatId === c.id ? "bg-primary/10 text-primary font-medium" : "bg-card text-foreground"
                  )}
                >
                  <span className="truncate">{c.icon} {c.name}</span>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 ml-1 text-muted-foreground" />
                </button>
              ))}
            </div>

            {/* Right — sub-categories */}
            <div className="flex-1 overflow-y-auto">
              {/* "Select category only" option at top */}
              {activeCat && (
                <button
                  type="button"
                  onClick={() => {
                    onSelect(activeCat.id, activeCat.name, activeCat.icon ?? "");
                    onOpenChange(false);
                  }}
                  className="w-full px-4 py-4 text-left text-sm border-b border-border text-primary font-medium bg-primary/5"
                >
                  {activeCat.icon} {activeCat.name} only
                </button>
              )}
              {subs.length === 0 && (
                <p className="text-xs text-muted-foreground px-4 py-4">No sub-categories</p>
              )}
              {(subs as any[]).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    onSelect(activeCat!.id, activeCat!.name, activeCat!.icon ?? "", s.id, s.name);
                    onOpenChange(false);
                  }}
                  className="w-full px-4 py-4 text-left text-sm border-b border-border bg-card hover:bg-secondary/40 text-foreground"
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Add Category Dialog */}
      <Dialog open={addCatOpen} onOpenChange={setAddCatOpen}>
        <DialogContent>
          <DialogTitle>Add Category</DialogTitle>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Emoji icon"
                value={newCatIcon}
                onChange={(e) => setNewCatIcon(e.target.value)}
                className="w-20 text-center text-lg"
                maxLength={2}
              />
              <Input
                placeholder="Category name"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                className="flex-1"
              />
            </div>
            <Button className="w-full" onClick={addCategory}>Add</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Person Picker Sheet ───────────────────────────────────────────────────
function PersonPickerSheet({
  open,
  onOpenChange,
  onSelect,
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

  useEffect(() => {
    if (people.length > 0 && order.length === 0) {
      setOrder(people.map((p: any) => p.id));
    }
  }, [people]);

  const ordered = useMemo(() => {
    if (order.length === 0) return people;
    return [...people].sort((a: any, b: any) => {
      const ai = order.indexOf(a.id);
      const bi = order.indexOf(b.id);
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
              <button type="button" onClick={() => setQrOpen(true)} className="text-muted-foreground hover:text-foreground">
                <QrCode className="h-5 w-5" />
              </button>
              <button type="button" onClick={() => setAddOpen(true)} className="text-muted-foreground hover:text-foreground">
                <Plus className="h-5 w-5" />
              </button>
              <button type="button" onClick={() => onOpenChange(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {ordered.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-10">No people yet. Tap + to add.</p>
            )}
            {ordered.map((p: any, idx: number) => (
              <div
                key={p.id}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                className="flex items-center gap-3 px-5 py-4 bg-card active:bg-secondary/40 cursor-pointer"
              >
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

// ─── Source Picker Sheet ───────────────────────────────────────────────────
const DEFAULT_SOURCES = ["Salary", "Freelance", "Business", "Gift", "Bonus", "Rental", "Investment", "Other"];

function SourcePickerSheet({
  open,
  onOpenChange,
  onSelect,
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
              <button type="button" onClick={() => setAddOpen(true)} className="text-muted-foreground hover:text-foreground">
                <Plus className="h-5 w-5" />
              </button>
              <button type="button" onClick={() => onOpenChange(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {sources.map((s, idx) => (
              <div
                key={s}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                className="flex items-center gap-3 px-5 py-4 bg-card active:bg-secondary/40 cursor-pointer"
              >
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
            <Input
              placeholder="e.g. Rental, Dividend"
              value={newSource}
              onChange={(e) => setNewSource(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSource(); } }}
            />
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
        user_id: u.user.id,
        type: "income",
        amount: Number(amount),
        account_id: accountId || null,
        income_source_type: sourceType,
        income_person_id: sourceType === "person" && personId ? personId : null,
        income_source_text: sourceType === "source" ? sourceText : null,
        date,
        time,
        note: note || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Income added");
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <>
      <FormShell color="bg-[oklch(0.40_0.13_145)] hover:bg-[oklch(0.45_0.13_145)]" button="Save income" onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
        <AmountInput value={amount} onChange={setAmount} accent="text-income" />
        <div className="space-y-1.5">
          <Label>From</Label>
          <div className="flex gap-2 rounded-lg bg-secondary p-1">
            {(["person", "source"] as const).map((m) => (
              <button type="button" key={m} onClick={() => setSourceType(m)}
                className={cn("flex-1 rounded-md py-1.5 text-sm capitalize", sourceType === m && "bg-primary text-white")}>
                {m}
              </button>
            ))}
          </div>
          {sourceType === "person" && (
            <button type="button" onClick={() => setPersonPickerOpen(true)}
              className="w-full flex items-center justify-between px-3 py-2.5 bg-secondary rounded-lg text-sm">
              <span className={personName ? "text-foreground" : "text-muted-foreground"}>
                {personName || "Select person"}
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
          {sourceType === "source" && (
            <button type="button" onClick={() => setSourcePickerOpen(true)}
              className="w-full flex items-center justify-between px-3 py-2.5 bg-secondary rounded-lg text-sm">
              <span className={sourceText ? "text-foreground" : "text-muted-foreground"}>
                {sourceText || "Select source"}
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
        <div className="space-y-1.5">
          <Label>To account</Label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
            <SelectContent>
              {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{[a.institution, a.label].filter(Boolean).join(" · ")}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <DateTime date={date} time={time} setDate={setDate} setTime={setTime} />
        <div className="space-y-1.5"><Label>Note</Label><Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} /></div>
      </FormShell>
      <PersonPickerSheet open={personPickerOpen} onOpenChange={setPersonPickerOpen}
        onSelect={(id, name) => { setPersonId(id); setPersonName(name); }} />
      <SourcePickerSheet open={sourcePickerOpen} onOpenChange={setSourcePickerOpen}
        onSelect={(s) => setSourceText(s)} />
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
        user_id: u.user.id,
        type: "expense",
        amount: Number(amount),
        account_id: accountId || null,
        category_id: categoryId || null,
        sub_category_id: subCatId || null,
        date,
        time,
        note: note || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Expense added");
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <>
      <FormShell color="bg-[oklch(0.40_0.18_25)] hover:bg-[oklch(0.45_0.18_25)]" button="Save expense"
        onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
        <AmountInput value={amount} onChange={setAmount} accent="text-expense" />
        <div className="space-y-1.5">
          <Label>From account</Label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
            <SelectContent>
              {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{[a.institution, a.label].filter(Boolean).join(" · ")}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Category picker button */}
        <div className="space-y-1.5">
          <Label>Category</Label>
          <button type="button" onClick={() => setCatPickerOpen(true)}
            className="w-full flex items-center justify-between px-3 py-2.5 bg-secondary rounded-lg text-sm">
            <span className={categoryId ? "text-foreground" : "text-muted-foreground"}>
              {categoryId
                ? `${categoryIcon} ${categoryName}${subCatName ? " · " + subCatName : ""}`
                : "Select category"}
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <DateTime date={date} time={time} setDate={setDate} setTime={setTime} />
        <div className="space-y-1.5"><Label>Note</Label><Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} /></div>
      </FormShell>

      <CategoryPickerSheet
        open={catPickerOpen}
        onOpenChange={setCatPickerOpen}
        onSelect={(cId, cName, cIcon, sId, sName) => {
          setCategoryId(cId);
          setCategoryName(cName);
          setCategoryIcon(cIcon);
          setSubCatId(sId ?? "");
          setSubCatName(sName ?? "");
        }}
      />
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

  useEffect(() => {
    if (accounts[0]?.id) setFromId(accounts[0].id);
    if (accounts[1]?.id) setToId(accounts[1].id);
  }, [accounts]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (fromId === toId) throw new Error("Choose two different accounts");
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { error } = await supabase.from("transactions").insert({
        user_id: u.user.id,
        type: "transfer",
        amount: Number(amount),
        account_id: fromId || null,
        to_account_id: toId || null,
        date,
        time,
        note: note || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Transfer recorded");
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <FormShell color="bg-[oklch(0.40_0.13_252)] hover:bg-[oklch(0.45_0.13_252)]" button="Save transfer"
      onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
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
  const { data: cats = [] } = useQuery(categoriesQuery("expense"));
  const { data: people = [] } = useQuery(peopleQuery());
  const { data: groups = [] } = useQuery(groupsQuery());
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [target, setTarget] = useState<"person" | "group">("person");
  const [personId, setPersonId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [whoPaid, setWhoPaid] = useState<"me" | "other">("me");
  const [accountId, setAccountId] = useState("");
  const [splitType, setSplitType] = useState<"equal" | "custom">("equal");
  const [categoryId, setCategoryId] = useState("");
  const [subCatId, setSubCatId] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [time, setTime] = useState(format(new Date(), "HH:mm"));
  const [note, setNote] = useState("");

  useEffect(() => { if (accounts[0]?.id) setAccountId(accounts[0].id); }, [accounts]);
  const { data: subs = [] } = useQuery(subCategoriesQuery(categoryId || null));

  const participants = useMemo(() => {
    if (target === "person") {
      const p = people.find((x) => x.id === personId);
      return p ? [{ id: p.id, name: p.name, customAmount: 0 }] : [];
    }
    const g = groups.find((x) => x.id === groupId);
    return (g?.group_members ?? []).map((m: any) => ({ id: m.person_id, name: m.people?.name ?? "?", customAmount: 0 }));
  }, [target, personId, groupId, people, groups]);

  const mutation = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const total = Number(amount);
      if (!total || participants.length === 0) throw new Error("Add an amount and pick participants");
      const totalPeople = participants.length + 1;
      const share = total / totalPeople;

      const { data: split, error } = await supabase.from("splits").insert({
        type: target === "person" ? "individual" : "group",
        person_id: target === "person" && personId ? personId : null,
        group_id: target === "group" && groupId ? groupId : null,
        description: desc,
        total_amount: total,
        paid_by: whoPaid === "me" ? "me" : participants[0]?.name ?? "other",
        split_type: splitType,
        category_id: categoryId || null,
        sub_category_id: subCatId || null,
        account_id: whoPaid === "me" && accountId ? accountId : null,
        date,
        time,
        created_by: u.user.id,
      }).select("*").single();
      if (error) throw error;

      const shares = participants.map((p: { id: string; name: string }) => ({
        split_id: split.id,
        person_name: p.name,
        person_id: p.id || null,
        share_amount: share,
      }));
      const { error: e2 } = await supabase.from("split_shares").insert(shares);
      if (e2) throw e2;

      if (whoPaid === "me" && accountId) {
        await supabase.from("transactions").insert({
          user_id: u.user.id,
          type: "expense",
          amount: total,
          account_id: accountId || null,
          category_id: categoryId || null,
          sub_category_id: subCatId || null,
          note: `Split: ${desc}`,
          date,
          time,
          is_split: true,
          split_id: split.id,
        });
      }
    },
    onSuccess: () => {
      toast.success("Split added");
      qc.invalidateQueries({ queryKey: ["splits"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <FormShell color="bg-[oklch(0.40_0.13_70)] hover:bg-[oklch(0.45_0.13_70)]" button="Save split"
      onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
      <AmountInput value={amount} onChange={setAmount} accent="text-split" />
      <div className="space-y-1.5"><Label>Description</Label><Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. Dinner" required /></div>
      <div className="space-y-1.5">
        <Label>Split with</Label>
        <div className="flex gap-2 rounded-lg bg-secondary p-1">
          {(["person", "group"] as const).map((m) => (
            <button type="button" key={m} onClick={() => setTarget(m)}
              className={cn("flex-1 rounded-md py-1.5 text-sm capitalize", target === m && "bg-primary text-white")}>{m}</button>
          ))}
        </div>
        {target === "person" ? (
          <Select value={personId} onValueChange={setPersonId}>
            <SelectTrigger><SelectValue placeholder="Select person" /></SelectTrigger>
            <SelectContent>{people.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
          </Select>
        ) : (
          <Select value={groupId} onValueChange={setGroupId}>
            <SelectTrigger><SelectValue placeholder="Select group" /></SelectTrigger>
            <SelectContent>{groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
          </Select>
        )}
      </div>
      <div className="space-y-1.5">
        <Label>Who paid?</Label>
        <div className="flex gap-2 rounded-lg bg-secondary p-1">
          {(["me", "other"] as const).map((m) => (
            <button type="button" key={m} onClick={() => setWhoPaid(m)}
              className={cn("flex-1 rounded-md py-1.5 text-sm capitalize", whoPaid === m && "bg-primary text-white")}>
              {m === "me" ? "You paid" : "Other paid"}
            </button>
          ))}
        </div>
      </div>
      {whoPaid === "me" && (
        <div className="space-y-1.5">
          <Label>Paid from</Label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={a.id}>{[a.institution, a.label].filter(Boolean).join(" · ")}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}
      <div className="space-y-1.5">
        <Label>Split type</Label>
        <div className="flex gap-2 rounded-lg bg-secondary p-1">
          {(["equal", "custom"] as const).map((m) => (
            <button type="button" key={m} onClick={() => setSplitType(m)}
              className={cn("flex-1 rounded-md py-1.5 text-sm capitalize", splitType === m && "bg-primary text-white")}>{m}</button>
          ))}
        </div>
        {splitType === "equal" && participants.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Each person pays: {formatMoney(Number(amount) / (participants.length + 1))}
          </p>
        )}
        {splitType === "custom" && participants.length > 0 && (
          <div className="space-y-2 mt-2">
            <p className="text-xs text-muted-foreground">Enter each person's share:</p>
            {participants.map((p) => (
              <div key={p.id} className="flex items-center gap-2">
                <span className="text-sm flex-1">{p.name}</span>
                <input type="number" placeholder="0.00"
                  className="w-24 bg-secondary rounded-md px-2 py-1 text-sm text-right font-mono outline-none"
                  onChange={(e) => { p.customAmount = Number(e.target.value); }} />
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="space-y-1.5">
        <Label>Category</Label>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
          <SelectContent>{cats.map((c) => <SelectItem key={c.id} value={c.id}>{(c as any).icon} {c.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {categoryId && subs.length > 0 && (
        <div className="space-y-1.5">
          <Label>Sub-category</Label>
          <Select value={subCatId} onValueChange={setSubCatId}>
            <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
            <SelectContent>{(subs as any[]).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}
      <DateTime date={date} time={time} setDate={setDate} setTime={setTime} />
      <div className="space-y-1.5"><Label>Note</Label><Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} /></div>
    </FormShell>
  );
}