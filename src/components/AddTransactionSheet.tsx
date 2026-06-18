import { useState, useEffect, useMemo } from "react";
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

function IncomeForm({ onClose }: { onClose: () => void }) {
  const { data: accounts = [] } = useQuery(accountsQuery());
  const { data: people = [] } = useQuery(peopleQuery());
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [sourceType, setSourceType] = useState<"person" | "source">("source");
  const [personId, setPersonId] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [accountId, setAccountId] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [time, setTime] = useState(format(new Date(), "HH:mm"));
  const [note, setNote] = useState("");

  useEffect(() => { if (accounts[0]?.id) setAccountId(accounts[0].id); }, [accounts]);

  const mutation = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { error } = await supabase.from("transactions").insert({
        user_id: u.user.id, type: "income", amount: Number(amount),
        account_id: accountId, income_source_type: sourceType,
        income_person_id: sourceType === "person" ? personId : null,
        income_source_text: sourceType === "source" ? sourceText : null,
        date, time, note: note || null,
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
    <FormShell color="bg-[oklch(0.40_0.13_145)] hover:bg-[oklch(0.45_0.13_145)]" button="Save income" onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
      <AmountInput value={amount} onChange={setAmount} accent="text-income" />
      <div className="space-y-1.5">
        <Label>From</Label>
        <div className="flex gap-2 rounded-lg bg-secondary p-1">
          {(["person", "source"] as const).map((m) => (
            <button type="button" key={m} onClick={() => setSourceType(m)} className={cn("flex-1 rounded-md py-1.5 text-sm capitalize", sourceType === m && "bg-primary text-white")}>{m}</button>
          ))}
        </div>
        {sourceType === "person" ? (
          <Select value={personId} onValueChange={setPersonId}>
            <SelectTrigger><SelectValue placeholder="Select person" /></SelectTrigger>
            <SelectContent>
              {people.length === 0 && <div className="p-2 text-sm text-muted-foreground">No people yet</div>}
              {people.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : (
          <Input placeholder="e.g. Salary, Freelance" value={sourceText} onChange={(e) => setSourceText(e.target.value)} />
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
  );
}

function ExpenseForm({ onClose }: { onClose: () => void }) {
  const { data: accounts = [] } = useQuery(accountsQuery());
  const { data: cats = [] } = useQuery(categoriesQuery("expense"));
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [subCatId, setSubCatId] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [time, setTime] = useState(format(new Date(), "HH:mm"));
  const [note, setNote] = useState("");

  useEffect(() => { if (accounts[0]?.id) setAccountId(accounts[0].id); }, [accounts]);
  const { data: subs = [] } = useQuery(subCategoriesQuery(categoryId || null));
  useEffect(() => { setSubCatId(""); }, [categoryId]);

  const mutation = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { error } = await supabase.from("transactions").insert({
        user_id: u.user.id, type: "expense", amount: Number(amount),
        account_id: accountId, category_id: categoryId || null,
        sub_category_id: subCatId || null, date, time, note: note || null,
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
    <FormShell color="bg-[oklch(0.40_0.18_25)] hover:bg-[oklch(0.45_0.18_25)]" button="Save expense" onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
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
      <div className="space-y-1.5">
        <Label>Category</Label>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
          <SelectContent>
            {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {categoryId && subs.length > 0 && (
        <div className="space-y-1.5">
          <Label>Sub-category</Label>
          <Select value={subCatId} onValueChange={setSubCatId}>
            <SelectTrigger><SelectValue placeholder="Select sub-category" /></SelectTrigger>
            <SelectContent>
              {subs.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
      <DateTime date={date} time={time} setDate={setDate} setTime={setTime} />
      <div className="space-y-1.5"><Label>Note</Label><Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} /></div>
    </FormShell>
  );
}

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
        user_id: u.user.id, type: "transfer", amount: Number(amount),
        account_id: fromId, to_account_id: toId, date, time, note: note || null,
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
    <FormShell color="bg-[oklch(0.40_0.13_252)] hover:bg-[oklch(0.45_0.13_252)]" button="Save transfer" onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
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
        type: target === "person" ? "individual" : "group", person_id: target === "person" ? personId : null,
        group_id: target === "group" ? groupId : null,
        description: desc, total_amount: total,
        paid_by: whoPaid === "me" ? "me" : participants[0]?.name ?? "other",
        split_type: splitType, category_id: categoryId || null,
        sub_category_id: subCatId || null,
        account_id: whoPaid === "me" ? accountId : null,
        date, time, created_by: u.user.id,
      }).select("*").single();
      if (error) throw error;
      const shares = participants.map((p: { id: string; name: string }) => ({
        split_id: split.id, person_name: p.name, person_id: p.id, share_amount: share,
      }));
      const { error: e2 } = await supabase.from("split_shares").insert(shares);
      if (e2) throw e2;
      if (whoPaid === "me" && accountId) {
        await supabase.from("transactions").insert({
          user_id: u.user.id, type: "expense", amount: total, account_id: accountId,
          category_id: categoryId || null, sub_category_id: subCatId || null,
          note: `Split: ${desc}`, date, time, is_split: true, split_id: split.id,
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
    <FormShell color="bg-[oklch(0.40_0.13_70)] hover:bg-[oklch(0.45_0.13_70)]" button="Save split" onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
      <AmountInput value={amount} onChange={setAmount} accent="text-split" />
      <div className="space-y-1.5"><Label>Description</Label><Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. Dinner" required /></div>
      <div className="space-y-1.5">
        <Label>Split with</Label>
        <div className="flex gap-2 rounded-lg bg-secondary p-1">
          {(["person", "group"] as const).map((m) => (
            <button type="button" key={m} onClick={() => setTarget(m)} className={cn("flex-1 rounded-md py-1.5 text-sm capitalize", target === m && "bg-primary text-white")}>{m}</button>
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
            <button type="button" key={m} onClick={() => setWhoPaid(m)} className={cn("flex-1 rounded-md py-1.5 text-sm capitalize", whoPaid === m && "bg-primary text-white")}>{m === "me" ? "You paid" : "Other paid"}</button>
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
            <button type="button" key={m} onClick={() => setSplitType(m)} className={cn("flex-1 rounded-md py-1.5 text-sm capitalize", splitType === m && "bg-primary text-white")}>{m}</button>
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
                <input
                  type="number"
                  placeholder="0.00"
                  className="w-24 bg-secondary rounded-md px-2 py-1 text-sm text-right font-mono outline-none"
                  onChange={(e) => {
                    p.customAmount = Number(e.target.value);
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="space-y-1.5">
        <Label>Category</Label>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
          <SelectContent>{cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {categoryId && subs.length > 0 && (
        <div className="space-y-1.5">
          <Label>Sub-category</Label>
          <Select value={subCatId} onValueChange={setSubCatId}>
            <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
            <SelectContent>{subs.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}
      <DateTime date={date} time={time} setDate={setDate} setTime={setTime} />
      <div className="space-y-1.5"><Label>Note</Label><Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} /></div>
    </FormShell>
  );
}