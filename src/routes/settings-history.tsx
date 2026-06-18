import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { transactionsQuery } from "@/lib/queries";
import { formatMoney } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";
import { ArrowLeft, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { SwipeRow } from "@/components/SwipeRow";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";

export default function HistoryPage() {
  const { data: txns = [] } = useQuery(transactionsQuery());
  const [q, setQ] = useState("");
  const [type, setType] = useState<string>("all");
  const [editTxn, setEditTxn] = useState<any | null>(null);
  const [deleteTxn, setDeleteTxn] = useState<any | null>(null);

  const filtered = useMemo(() => {
    return (txns as any[]).filter((t) => {
      if (type !== "all" && t.type !== type) return false;
      if (type === "split" && !t.is_split) return false;
      if (!q) return true;
      const hay = [
        t.note,
        t.categories?.name,
        t.sub_categories?.name,
        t.accounts?.label,
        t.accounts?.institution,
        t.income_source_text,
        t.to_account?.label,
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q.toLowerCase());
    });
  }, [txns, q, type]);

  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const t of filtered) {
      if (!map.has(t.date)) map.set(t.date, []);
      map.get(t.date)!.push(t);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <div className="px-4 pt-4 pb-24 space-y-4">
      <Link to="/settings" className="inline-flex items-center text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4 mr-1" /> Settings
      </Link>
      <h1 className="text-xl font-semibold">History</h1>
      <Input placeholder="Search by category, account, note..." value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="flex gap-2 text-xs flex-wrap">
        {["all", "income", "expense", "transfer", "split"].map((t) => (
          <button key={t} onClick={() => setType(t)}
            className={`px-3 py-1.5 rounded-full capitalize ${type === t ? "bg-primary text-white" : "bg-secondary"}`}>
            {t}
          </button>
        ))}
      </div>
      {grouped.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-10">No results</p>
      )}
      {grouped.map(([date, items]) => (
        <div key={date}>
          <p className="text-xs uppercase text-muted-foreground mb-2 px-1 font-mono">{date}</p>
          <div className="rounded-xl overflow-hidden divide-y divide-border border border-border">
            {items.map((t) => (
              <SwipeRow
                key={t.id}
                onEdit={() => setEditTxn(t)}
                onDelete={() => setDeleteTxn(t)}
              >
                <Row t={t} />
              </SwipeRow>
            ))}
          </div>
        </div>
      ))}

      {/* Edit Sheet */}
      {editTxn && (
        <EditTransactionSheet
          txn={editTxn}
          open={!!editTxn}
          onOpenChange={(o) => { if (!o) setEditTxn(null); }}
        />
      )}

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTxn} onOpenChange={(o) => { if (!o) setDeleteTxn(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this transaction and update your account balance. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={async () => {
                if (!deleteTxn) return;
                const { error } = await supabase.from("transactions").delete().eq("id", deleteTxn.id);
                if (error) toast.error(error.message);
                else toast.success("Transaction deleted");
                setDeleteTxn(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Row({ t }: { t: any }) {
  const isIncome = t.type === "income";
  const isExpense = t.type === "expense";
  const isTransfer = t.type === "transfer";
  const isSplit = t.is_split;

  const color = isSplit ? "text-split" : isIncome ? "text-income" : isExpense ? "text-expense" : "text-transfer";
  const Icon = isSplit ? Users : isIncome ? ArrowDownLeft : isExpense ? ArrowUpRight : ArrowLeftRight;
  const sign = isIncome ? "+" : isTransfer ? "" : "-";

  const title = t.categories
    ? `${t.categories.icon ?? ""} ${t.categories.name}${t.sub_categories ? " · " + t.sub_categories.name : ""}`
    : isIncome
    ? (t.income_source_text ?? "Income")
    : isTransfer
    ? "Transfer"
    : isSplit
    ? "Split"
    : "Expense";

  const sub = isTransfer
    ? `${t.accounts?.label ?? ""} → ${t.to_account?.label ?? ""}`
    : isIncome
    ? (t.accounts ? [t.accounts.institution, t.accounts.label].filter(Boolean).join(" · ") : "")
    : t.accounts
    ? [t.accounts.institution, t.accounts.label].filter(Boolean).join(" · ")
    : "";

  return (
    <div className="flex items-center gap-3 p-3 bg-card">
      <div className={`h-9 w-9 rounded-full bg-secondary flex items-center justify-center ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate">{title}</p>
        <p className="text-[10px] text-muted-foreground truncate">{sub}{t.note ? ` · ${t.note}` : ""}</p>
      </div>
      <div className="text-right">
        <p className={`text-sm font-mono font-semibold ${color}`}>{sign}{formatMoney(t.amount)}</p>
        <p className="text-[10px] text-muted-foreground font-mono">{t.time?.slice(0, 5)}</p>
      </div>
    </div>
  );
}

function EditTransactionSheet({ txn, open, onOpenChange }: { txn: any; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState(String(txn.amount));
  const [note, setNote] = useState(txn.note ?? "");
  const [date, setDate] = useState(txn.date ?? format(new Date(), "yyyy-MM-dd"));
  const [time, setTime] = useState(txn.time?.slice(0, 5) ?? format(new Date(), "HH:mm"));

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("accounts").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const { data: cats = [] } = useQuery({
    queryKey: ["categories", "expense"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const [accountId, setAccountId] = useState(txn.account_id ?? "");
  const [categoryId, setCategoryId] = useState(txn.category_id ?? "");
  const [subCatId, setSubCatId] = useState(txn.sub_category_id ?? "");
  const [toAccountId, setToAccountId] = useState(txn.to_account_id ?? "");

  const { data: subs = [] } = useQuery({
    queryKey: ["sub_categories", categoryId || "none"],
    queryFn: async () => {
      if (!categoryId) return [];
      const { data, error } = await supabase.from("sub_categories").select("*").eq("category_id", categoryId).order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!categoryId,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("transactions").update({
        amount: Number(amount),
        account_id: accountId || null,
        to_account_id: txn.type === "transfer" && toAccountId ? toAccountId : undefined,
        category_id: categoryId || null,
        sub_category_id: subCatId || null,
        note: note || null,
        date,
        time,
      }).eq("id", txn.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Transaction updated");
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="bg-card border-border rounded-t-3xl p-0 h-[80dvh] flex flex-col">
        <SheetTitle className="sr-only">Edit transaction</SheetTitle>
        <div className="flex items-center gap-3 px-5 pt-5 pb-3 border-b border-border">
          <span className="capitalize text-base font-semibold">{txn.is_split ? "Split" : txn.type} — Edit</span>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Amount */}
          <div className="text-center py-2">
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
              className="w-full bg-transparent text-center text-5xl font-mono font-semibold outline-none text-foreground"
            />
            <p className="text-xs text-muted-foreground mt-1 font-mono">LKR</p>
          </div>

          {/* Account */}
          <div className="space-y-1.5">
            <Label>{txn.type === "transfer" ? "From account" : "Account"}</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
              <SelectContent>
                {accounts.map((a: any) => (
                  <SelectItem key={a.id} value={a.id}>{[a.institution, a.label].filter(Boolean).join(" · ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* To Account (transfer only) */}
          {txn.type === "transfer" && (
            <div className="space-y-1.5">
              <Label>To account</Label>
              <Select value={toAccountId} onValueChange={setToAccountId}>
                <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a: any) => (
                    <SelectItem key={a.id} value={a.id}>{[a.institution, a.label].filter(Boolean).join(" · ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Category (expense only) */}
          {(txn.type === "expense" || txn.is_split) && (
            <>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={categoryId} onValueChange={(v) => { setCategoryId(v); setSubCatId(""); }}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {cats.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {categoryId && subs.length > 0 && (
                <div className="space-y-1.5">
                  <Label>Sub-category</Label>
                  <Select value={subCatId} onValueChange={setSubCatId}>
                    <SelectTrigger><SelectValue placeholder="Select sub-category" /></SelectTrigger>
                    <SelectContent>
                      {subs.map((s: any) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}

          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground outline-none" />
            </div>
            <div className="space-y-1.5">
              <Label>Time</Label>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
                className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground outline-none" />
            </div>
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <Label>Note</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>
        </div>

        <div className="p-4 pt-2 border-t border-border bg-card">
          <Button className="w-full bg-primary text-white" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
