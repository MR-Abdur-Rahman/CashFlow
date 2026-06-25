import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { transactionsQuery, incomingSplitsQuery, splitsQuery } from "@/lib/queries";
import { SplitDirectRow, EditSplitSheet } from "./home";
import { formatMoney } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";
import { ArrowLeft, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Users, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SwipeRow } from "@/components/SwipeRow";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { notifyToast } from "@/lib/notify";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfYear, endOfYear, subMonths, addMonths, subWeeks, addWeeks, subYears, addYears } from "date-fns";

type Period = "weekly" | "monthly" | "annually";
function getPeriodRange(period: Period, anchor: Date) {
  if (period === "weekly") return { from: startOfWeek(anchor, { weekStartsOn: 1 }), to: endOfWeek(anchor, { weekStartsOn: 1 }) };
  if (period === "monthly") return { from: startOfMonth(anchor), to: endOfMonth(anchor) };
  return { from: startOfYear(anchor), to: endOfYear(anchor) };
}
function navigateAnchor(period: Period, anchor: Date, dir: -1 | 1): Date {
  if (period === "weekly") return dir === -1 ? subWeeks(anchor, 1) : addWeeks(anchor, 1);
  if (period === "monthly") return dir === -1 ? subMonths(anchor, 1) : addMonths(anchor, 1);
  return dir === -1 ? subYears(anchor, 1) : addYears(anchor, 1);
}
function formatAnchorLabel(period: Period, anchor: Date) {
  if (period === "weekly") return `${format(startOfWeek(anchor, { weekStartsOn: 1 }), "MMM d")} – ${format(endOfWeek(anchor, { weekStartsOn: 1 }), "MMM d, yyyy")}`;
  if (period === "monthly") return format(anchor, "MMM yyyy");
  return format(anchor, "yyyy");
}

export default function HistoryPage() {
  const [searchParams] = useSearchParams();
  const { data: txns = [] } = useQuery(transactionsQuery());
  const { data: ownSplits = [] } = useQuery(splitsQuery());
  const { data: incomingSplits = [] } = useQuery(incomingSplitsQuery());
  // Settlements involving me (RLS-scoped). Display only — balances already account for them.
  const { data: settlements = [] } = useQuery({
    queryKey: ["history-settlements"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data } = await supabase
        .from("settlements")
        .select("*, split_shares:split_share_id(person_name, person:people(linked_user_id)), splits:split_id(description)")
        .order("created_at", { ascending: false });
      return (data ?? []).map((s: any) => ({ ...s, _uid: u.user!.id }));
    },
  });
  const [q, setQ] = useState("");
  const [type, setType] = useState<string>(searchParams.get("filter") ?? "all");
  const [period, setPeriod] = useState<Period>("monthly");
  const [anchor, setAnchor] = useState(new Date());
  const [editTxn, setEditTxn] = useState<any | null>(null);
  const [deleteTxn, setDeleteTxn] = useState<any | null>(null);
  const [editSplit, setEditSplit] = useState<any | null>(null);
  const [deleteSplit, setDeleteSplit] = useState<any | null>(null);
  const qc = useQueryClient();

  const { from: periodFrom, to: periodTo } = useMemo(
    () => getPeriodRange(period, anchor),
    [period, anchor]
  );
  const fromStr = useMemo(() => format(periodFrom, "yyyy-MM-dd"), [periodFrom]);
  const toStr = useMemo(() => format(periodTo, "yyyy-MM-dd"), [periodTo]);

  // Non-split transactions only — own splits are rendered via SplitDirectRow (same as Home).
  const filteredTxns = useMemo(() => {
    return (txns as any[]).filter((t) => {
      if (t.is_split) return false;
      if (t.date < fromStr || t.date > toStr) return false;
      if (type === "split") return false;
      if (type !== "all" && t.type !== type) return false;
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
  }, [txns, q, type, fromStr, toStr]);

  // Own + incoming splits, deduped (incoming version wins) — same as Home page.
  const allSplits = useMemo(() => {
    const byId = new Map<string, any>();
    for (const s of ownSplits as any[]) byId.set(s.id, { ...s, _isIncoming: false });
    for (const s of incomingSplits as any[]) {
      byId.set(s.id, { ...s, _isIncoming: true, _myPersonId: s._myPersonId ?? null, _createdByUserId: s._createdByUserId ?? null });
    }
    return [...byId.values()];
  }, [ownSplits, incomingSplits]);

  const filteredSplits = useMemo(() => {
    if (type !== "all" && type !== "split") return [];
    return allSplits.filter((s) => {
      if (s.date < fromStr || s.date > toStr) return false;
      if (!q) return true;
      const hay = [
        s.description,
        s.creator?.full_name,
        s.people?.name,
        s.groups?.name,
        s.paid_by,
        ...(s.split_shares ?? []).map((sh: any) => sh.person_name),
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q.toLowerCase());
    });
  }, [allSplits, q, type, fromStr, toStr]);

  const filteredSettlements = useMemo(() => {
    if (type !== "all" && type !== "split") return [];
    return (settlements as any[]).filter((s) => {
      const day = String(s.created_at ?? "").slice(0, 10);
      if (day < fromStr || day > toStr) return false;
      if (!q) return true;
      const hay = [s.splits?.description, s.split_shares?.person_name, s.method]
        .filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q.toLowerCase());
    });
  }, [settlements, q, type, fromStr, toStr]);

  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    const push = (date: string, item: any) => {
      if (!map.has(date)) map.set(date, []);
      map.get(date)!.push(item);
    };
    for (const t of filteredTxns) push(t.date, { ...t, _kind: "txn" });
    for (const s of filteredSplits) push(s.date, { ...s, _kind: "split" });
    for (const s of filteredSettlements) push(String(s.created_at ?? "").slice(0, 10), { ...s, _kind: "settlement" });
    // Sort within each date: time DESC, then created_at DESC (most recently created first).
    for (const arr of map.values()) arr.sort((a, b) => {
      const at = (a.time ?? "00:00").slice(0, 8), bt = (b.time ?? "00:00").slice(0, 8);
      if (at !== bt) return bt.localeCompare(at);
      return String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""));
    });
    return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [filteredTxns, filteredSplits, filteredSettlements]);

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

      {/* Period filter bar */}
      <div className="flex items-center gap-2">
        <button onClick={() => setAnchor((a) => navigateAnchor(period, a, -1))} className="p-1 rounded-md hover:bg-secondary">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold">{formatAnchorLabel(period, anchor)}</span>
        <button onClick={() => setAnchor((a) => navigateAnchor(period, a, 1))} className="p-1 rounded-md hover:bg-secondary">
          <ChevronRight className="h-4 w-4" />
        </button>
        <div className="ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 bg-primary text-white text-sm font-medium px-3 py-1.5 rounded-xl capitalize">
                {period} <ChevronDown className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              {(["weekly", "monthly", "annually"] as Period[]).map((p) => (
                <DropdownMenuItem key={p} onClick={() => { setPeriod(p); setAnchor(new Date()); }}
                  className={`capitalize py-3 text-base ${period === p ? "text-primary font-medium" : ""}`}>
                  {p}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {grouped.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-10">No results</p>
      )}
      {grouped.map(([date, items]) => (
        <div key={date}>
          <p className="text-xs uppercase text-muted-foreground mb-2 px-1 font-mono">{format(new Date(`${date}T00:00`), "MMM dd, yyyy")}</p>
          <div className="rounded-xl overflow-hidden divide-y divide-border border border-border">
            {items.map((item) =>
              item._kind === "split" ? (
                <SwipeRow key={`split-${item.id}`} onEdit={() => setEditSplit(item)} onDelete={() => setDeleteSplit(item)}
                  canEdit={!item._isIncoming} canDelete={!item._isIncoming}
                  editDeniedMessage="Only the creator can edit this split"
                  deleteDeniedMessage="Only the creator can delete this split">
                  <SplitDirectRow s={item} />
                </SwipeRow>
              ) : item._kind === "settlement" ? (
                <HistorySettlementRow key={`set-${item.id}`} s={item} />
              ) : (
                <SwipeRow key={item.id} onEdit={() => setEditTxn(item)} onDelete={() => setDeleteTxn(item)}>
                  <Row t={item} />
                </SwipeRow>
              )
            )}
          </div>
        </div>
      ))}

      {editTxn && (
        <EditTransactionSheet txn={editTxn} open={!!editTxn} onOpenChange={(o) => { if (!o) setEditTxn(null); }} />
      )}

      {editSplit && (
        <EditSplitSheet split={editSplit} open={!!editSplit} onOpenChange={(o) => { if (!o) setEditSplit(null); }} />
      )}

      <AlertDialog open={!!deleteSplit} onOpenChange={(o) => { if (!o) setDeleteSplit(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={async () => {
                if (!deleteSplit) return;
                const { error } = await supabase.from("splits").delete().eq("id", deleteSplit.id);
                if (error) toast.error(error.message);
                else {
                  notifyToast("split_deleted", "Split deleted");
                  qc.invalidateQueries({ queryKey: ["splits"] });
                  qc.invalidateQueries({ queryKey: ["transactions"] });
                  qc.invalidateQueries({ queryKey: ["accounts"] });
                }
                setDeleteSplit(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
                else {
                  toast.success("Transaction deleted");
                  qc.invalidateQueries({ queryKey: ["transactions"] });
                  qc.invalidateQueries({ queryKey: ["accounts"] });
                  qc.invalidateQueries({ queryKey: ["splits"] });
                }
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

// Settlement history row (display only). Direction from the settled share's owner.
function HistorySettlementRow({ s }: { s: any }) {
  const amount = Number(s.amount);
  const other = s.split_shares?.person_name ?? "Someone";
  const iPaid = s.split_shares?.person?.linked_user_id === s._uid;
  const label = iPaid ? `You → ${other}` : `${other} → You`;
  const dateStr = s.created_at ? format(new Date(s.created_at), "MMM dd, yyyy · hh:mm a") : "";
  return (
    <div className="bg-card" style={{ borderLeft: "3px solid #10B981" }}>
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium truncate flex-1">{label}</p>
          <p className="text-sm font-mono text-[#9CA3AF] shrink-0">{formatMoney(amount)}</p>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className="text-[12px] text-[#9CA3AF] truncate flex-1">{s.splits?.description ?? "Settlement"}</p>
          <p className="text-[10px] text-[#9CA3AF] font-mono shrink-0">{dateStr}</p>
        </div>
      </div>
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

  // Split transaction — show person/group context from joined split data
  if (isSplit && t.split) {
    const s = t.split;
    const oppositeLabel = s.type === "group" && s.groups?.name
      ? s.groups.name
      : s.type === "individual" && s.people?.name
      ? s.people.name
      : (s.split_shares ?? []).map((sh: any) => sh.person_name).filter(Boolean).join(", ") || s.description || "Split";
    const totalShares = (s.split_shares ?? []).reduce((sum: number, sh: any) => sum + Number(sh.share_amount), 0);
    const shareAmt = totalShares > 0 ? totalShares : t.amount;
    return (
      <div className="flex items-center gap-3 p-3 bg-card">
        <div className={`h-9 w-9 rounded-full bg-secondary flex items-center justify-center ${color}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm truncate">{oppositeLabel}</p>
          <p className="text-[10px] text-muted-foreground truncate">paid by {s.paid_by}</p>
        </div>
        <div className="text-right">
          <p className={`text-sm font-mono font-semibold ${color}`}>-{formatMoney(shareAmt)}</p>
          <p className="text-[10px] text-muted-foreground font-mono">{formatMoney(Number(s.total_amount))}</p>
        </div>
      </div>
    );
  }

  const sign = isIncome ? "+" : isTransfer ? "" : "-";
  const title = t.categories
    ? `${t.categories.icon ?? ""} ${t.categories.name}${t.sub_categories ? " · " + t.sub_categories.name : ""}`
    : isIncome ? (t.income_source_text ?? "Income")
    : isTransfer ? "Transfer"
    : isSplit ? "Split"
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
  const [accountId, setAccountId] = useState(txn.account_id ?? "");
  const [categoryId, setCategoryId] = useState(txn.category_id ?? "");
  const [subCatId, setSubCatId] = useState(txn.sub_category_id ?? "");
  const [toAccountId, setToAccountId] = useState(txn.to_account_id ?? "");

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
        date, time,
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
          <div className="text-center py-2">
            <input inputMode="decimal" value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
              className="w-full bg-transparent text-center text-5xl font-mono font-semibold outline-none text-foreground" />
            <p className="text-xs text-muted-foreground mt-1 font-mono">LKR</p>
          </div>

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