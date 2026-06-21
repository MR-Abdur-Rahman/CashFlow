import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { accountQuery, transactionsQuery } from "@/lib/queries";
import { AccountIcon } from "@/components/AccountIcon";
import { formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import { AddAccountSheet } from "@/components/AddAccountSheet";
import { SwipeRow } from "@/components/SwipeRow";
import {
  ArrowLeft, Pencil, Trash2, ArrowDownLeft, ArrowUpRight, ArrowLeftRight,
  ChevronLeft, ChevronRight, ChevronDown,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Link, useNavigate, useParams } from "react-router-dom";
import { EditSplitSheet } from "@/routes/home";
import { SettlementEditSheet } from "@/components/SettlementEditSheet";
import {
  format, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  startOfYear, endOfYear, subDays, addDays, subWeeks, addWeeks,
  subMonths, addMonths, subYears, addYears,
} from "date-fns";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type Period = "today" | "weekly" | "monthly" | "annually";

const PERIOD_OPTIONS: { key: Period; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "annually", label: "This Year" },
];

function getPeriodRange(period: Period, anchor: Date): { dateFrom: string; dateTo: string } {
  if (period === "today") {
    const d = format(anchor, "yyyy-MM-dd");
    return { dateFrom: d, dateTo: d };
  }
  if (period === "weekly") return {
    dateFrom: format(startOfWeek(anchor, { weekStartsOn: 1 }), "yyyy-MM-dd"),
    dateTo: format(endOfWeek(anchor, { weekStartsOn: 1 }), "yyyy-MM-dd"),
  };
  if (period === "monthly") return {
    dateFrom: format(startOfMonth(anchor), "yyyy-MM-dd"),
    dateTo: format(endOfMonth(anchor), "yyyy-MM-dd"),
  };
  return {
    dateFrom: format(startOfYear(anchor), "yyyy-MM-dd"),
    dateTo: format(endOfYear(anchor), "yyyy-MM-dd"),
  };
}

function navigateAnchor(period: Period, anchor: Date, dir: -1 | 1): Date {
  if (period === "today") return dir === -1 ? subDays(anchor, 1) : addDays(anchor, 1);
  if (period === "weekly") return dir === -1 ? subWeeks(anchor, 1) : addWeeks(anchor, 1);
  if (period === "monthly") return dir === -1 ? subMonths(anchor, 1) : addMonths(anchor, 1);
  return dir === -1 ? subYears(anchor, 1) : addYears(anchor, 1);
}

function formatAnchorLabel(period: Period, anchor: Date): string {
  if (period === "today") return format(anchor, "MMM d, yyyy");
  if (period === "weekly") {
    const s = startOfWeek(anchor, { weekStartsOn: 1 });
    const e = endOfWeek(anchor, { weekStartsOn: 1 });
    return `${format(s, "MMM d")} – ${format(e, "MMM d, yyyy")}`;
  }
  if (period === "monthly") return format(anchor, "MMM yyyy");
  return format(anchor, "yyyy");
}

function formatDateTime(date?: string, time?: string): string {
  if (!date) return "";
  const t = time?.slice(0, 5) ?? "00:00";
  return format(new Date(`${date}T${t}`), "MMM dd, yyyy · hh:mm a");
}

// ─── Main Page ─────────────────────────────────────────────────────────────
export default function AccountDetail() {
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: account } = useQuery(accountQuery(accountId!));
  const [period, setPeriod] = useState<Period>("monthly");
  const [anchor, setAnchor] = useState(new Date());
  const [tab, setTab] = useState<"transactions" | "splits">("transactions");
  const [edit, setEdit] = useState(false);
  const [editTxn, setEditTxn] = useState<any | null>(null);
  const [deleteTxn, setDeleteTxn] = useState<any | null>(null);
  const [editSplit, setEditSplit] = useState<any | null>(null);
  const [deleteSplitItem, setDeleteSplitItem] = useState<any | null>(null);
  const [deleteSettlement, setDeleteSettlement] = useState<any | null>(null);
  const [editSettlement, setEditSettlement] = useState<any | null>(null);

  const { dateFrom, dateTo } = useMemo(() => getPeriodRange(period, anchor), [period, anchor]);

  const { data: txns = [] } = useQuery(transactionsQuery({ accountId, dateFrom, dateTo }));

  const { data: splits = [] } = useQuery({
    queryKey: ["splits", "account", accountId, dateFrom, dateTo],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from("splits")
        .select("*, split_shares(*), groups:group_id(name), people:person_id(name)")
        .eq("account_id", accountId)
        .eq("paid_by", "me")
        .gte("date", dateFrom)
        .lte("date", dateTo)
        .order("date", { ascending: false })
        .order("time", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!accountId,
  });

  const { data: settlements = [] } = useQuery({
    queryKey: ["settlements", "account", accountId, dateFrom, dateTo],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from("settlements")
        .select("*, split_shares:split_share_id(person_name, share_amount)")
        .eq("account_id", accountId)
        .gte("created_at", dateFrom)
        .lte("created_at", dateTo + "T23:59:59.999")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!accountId,
  });

  const splitsTabItems = useMemo(() => {
    const items = [
      ...(splits as any[]).map((s) => ({
        ...s,
        _itemType: "split" as const,
        _sortKey: `${s.date}T${s.time ?? "00:00"}`,
      })),
      ...(settlements as any[]).map((s) => ({
        ...s,
        _itemType: "settlement" as const,
        _sortKey: s.created_at ?? "",
      })),
    ];
    return items.sort((a, b) => b._sortKey.localeCompare(a._sortKey));
  }, [splits, settlements]);

  const delAccount = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("accounts").delete().eq("id", accountId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Account deleted");
      qc.invalidateQueries({ queryKey: ["accounts"] });
      navigate("/accounts");
    },
    onError: (e) => toast.error(e.message),
  });

  if (!account) return <div className="p-6">Account not found.</div>;

  const visibleTxns = (txns as any[]).filter((t) => !t.is_split);

  return (
    <div className="px-4 pt-4 pb-24 space-y-4">
      {/* Back */}
      <Link to="/accounts" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Accounts
      </Link>

      {/* Account info */}
      <div className="flex items-center gap-4">
        <AccountIcon
          iconType={account.icon_type} iconName={account.icon_name}
          iconColor={account.icon_color} iconUrl={account.icon_url} size={56}
        />
        <div className="flex-1">
          <p className="text-xs uppercase text-muted-foreground">
            {account.type}{account.institution && ` · ${account.institution}`}
          </p>
          <h1 className="text-lg font-semibold">{account.label}</h1>
        </div>
      </div>

      {/* Balance card */}
      <div className="rounded-2xl bg-card border border-border p-4">
        <p className="text-xs text-muted-foreground">Current balance</p>
        <p className="text-3xl font-mono font-bold mt-1">{formatMoney(account.current_balance)}</p>
        <p className="text-xs text-muted-foreground mt-1">Opening: {formatMoney(account.opening_balance)}</p>
      </div>

      {/* Edit / Delete */}
      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" onClick={() => setEdit(true)}>
          <Pencil className="h-4 w-4 mr-2" /> Edit
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="text-expense">
              <Trash2 className="h-4 w-4 mr-2" /> Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete account?</AlertDialogTitle>
              <AlertDialogDescription>
                {txns.length > 0
                  ? `This account has ${txns.length} transactions and cannot be deleted.`
                  : "This cannot be undone."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction disabled={txns.length > 0} onClick={() => delAccount.mutate()}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Date navigation */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setAnchor((a) => navigateAnchor(period, a, -1))}
          className="p-1 rounded-md hover:bg-secondary"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold">{formatAnchorLabel(period, anchor)}</span>
        <button
          onClick={() => setAnchor((a) => navigateAnchor(period, a, 1))}
          className="p-1 rounded-md hover:bg-secondary"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <div className="ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 bg-primary text-white text-sm font-medium px-3 py-1.5 rounded-xl">
                {PERIOD_OPTIONS.find((p) => p.key === period)?.label ?? "Monthly"}
                <ChevronDown className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              {PERIOD_OPTIONS.map((p) => (
                <DropdownMenuItem
                  key={p.key}
                  onClick={() => { setPeriod(p.key); setAnchor(new Date()); }}
                  className={`py-3 text-base ${period === p.key ? "text-primary font-medium" : ""}`}
                >
                  {p.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(["transactions", "splits"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className="flex-1 py-2 text-sm font-medium rounded-lg capitalize transition-colors"
            style={
              tab === t
                ? { background: "#1A1A1A", color: "white", border: "1px solid #7C3AED" }
                : { background: "#2A2A2A", color: "#9CA3AF", border: "1px solid transparent" }
            }
          >
            {t === "transactions" ? "Transactions" : "Splits"}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "transactions" ? (
        <div className="rounded-xl overflow-hidden border border-border divide-y divide-border">
          {visibleTxns.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No transactions</p>
          ) : (
            visibleTxns.map((t: any) => (
              <SwipeRow key={t.id} onEdit={() => setEditTxn(t)} onDelete={() => setDeleteTxn(t)}>
                <TxRow t={t} accountId={accountId!} />
              </SwipeRow>
            ))
          )}
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden border border-border divide-y divide-border">
          {splitsTabItems.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No splits or settlements</p>
          ) : (
            splitsTabItems.map((item: any) =>
              item._itemType === "settlement" ? (
                <SwipeRow key={`set-${item.id}`} onEdit={() => setEditSettlement(item)} onDelete={() => setDeleteSettlement(item)}>
                  <SettlementRow s={item} />
                </SwipeRow>
              ) : (
                <SwipeRow key={`sp-${item.id}`} onEdit={() => setEditSplit(item)} onDelete={() => setDeleteSplitItem(item)}>
                  <SplitRow s={item} />
                </SwipeRow>
              )
            )
          )}
        </div>
      )}

      <AddAccountSheet open={edit} onOpenChange={setEdit} edit={account} />

      {editSplit && (
        <EditSplitSheet split={editSplit} open={!!editSplit} onOpenChange={(o) => { if (!o) setEditSplit(null); }} />
      )}

      {editSettlement && (
        <SettlementEditSheet
          settlement={editSettlement}
          open={!!editSettlement}
          onOpenChange={(o) => { if (!o) setEditSettlement(null); }}
        />
      )}

      <AlertDialog open={!!deleteSplitItem} onOpenChange={(o) => { if (!o) setDeleteSplitItem(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete split?</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete this split?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={async () => {
                if (!deleteSplitItem) return;
                await supabase.from("split_shares").delete().eq("split_id", deleteSplitItem.id);
                const { error } = await supabase.from("splits").delete().eq("id", deleteSplitItem.id);
                if (error) toast.error(error.message);
                else {
                  toast.success("Split deleted");
                  qc.invalidateQueries({ queryKey: ["splits"] });
                  qc.invalidateQueries({ queryKey: ["accounts"] });
                }
                setDeleteSplitItem(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteSettlement} onOpenChange={(o) => { if (!o) setDeleteSettlement(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete settlement?</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete this settlement?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={async () => {
                if (!deleteSettlement) return;
                const s = deleteSettlement;
                const { error } = await supabase.from("settlements").delete().eq("id", s.id);
                if (error) { toast.error(error.message); setDeleteSettlement(null); return; }
                // Reverse the balance credit on the split's account
                const { data: acct } = await supabase
                  .from("accounts").select("current_balance").eq("id", accountId!).single();
                if (acct) {
                  await supabase.from("accounts")
                    .update({ current_balance: Number(acct.current_balance) - Number(s.amount) })
                    .eq("id", accountId!);
                }
                toast.success("Settlement deleted");
                qc.invalidateQueries({ queryKey: ["settlements"] });
                qc.invalidateQueries({ queryKey: ["accounts"] });
                setDeleteSettlement(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {editTxn && (
        <EditTxSheet txn={editTxn} open={!!editTxn} onOpenChange={(o) => { if (!o) setEditTxn(null); }} />
      )}

      <AlertDialog open={!!deleteTxn} onOpenChange={(o) => { if (!o) setDeleteTxn(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this transaction and update your balance. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={async () => {
                if (!deleteTxn) return;
                const txn = deleteTxn;
                const { error } = await supabase.from("transactions").delete().eq("id", txn.id);
                if (error) { toast.error(error.message); setDeleteTxn(null); return; }

                // FIX 7: update account balance on delete
                const isIncome = txn.type === "income";
                const isTransferTo = txn.type === "transfer" && txn.to_account_id === accountId;
                const { data: acct } = await supabase
                  .from("accounts").select("current_balance").eq("id", accountId!).single();
                if (acct) {
                  const delta = (isIncome || isTransferTo) ? -Number(txn.amount) : Number(txn.amount);
                  await supabase.from("accounts")
                    .update({ current_balance: Number(acct.current_balance) + delta })
                    .eq("id", accountId!);
                }

                toast.success("Transaction deleted");
                qc.invalidateQueries({ queryKey: ["transactions"] });
                qc.invalidateQueries({ queryKey: ["accounts"] });
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

// ─── Transaction Row ────────────────────────────────────────────────────────
function TxRow({ t, accountId }: { t: any; accountId: string }) {
  const isIncome = t.type === "income";
  const isTransfer = t.type === "transfer";

  const colorClass = isIncome ? "text-[#22C55E]"
    : isTransfer ? "text-[#3B82F6]"
    : "text-[#EF4444]";

  const bgClass = isIncome ? "bg-[var(--color-income-bg)]"
    : isTransfer ? "bg-[var(--color-transfer-bg)]"
    : "bg-[var(--color-expense-bg)]";

  const Icon = isIncome ? ArrowDownLeft : isTransfer ? ArrowLeftRight : ArrowUpRight;
  const sign = isIncome ? "+" : isTransfer ? "" : "-";

  const title = t.categories
    ? `${t.categories.icon ?? ""} ${t.categories.name}${t.sub_categories ? " · " + t.sub_categories.name : ""}`
    : isIncome ? (t.income_source_text ?? "Income")
    : isTransfer ? "Transfer"
    : "Expense";

  const sub = isTransfer
    ? `${t.accounts?.label ?? ""} → ${t.to_account?.label ?? ""}`
    : t.accounts
    ? [t.accounts.institution, t.accounts.label].filter(Boolean).join(" · ")
    : "";

  return (
    <div className="flex items-center gap-3 p-4 bg-card">
      <div className={cn("h-10 w-10 rounded-full flex items-center justify-center shrink-0", bgClass, colorClass)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{title}</p>
        <p className="text-xs text-muted-foreground truncate">{sub}</p>
      </div>
      <div className="text-right shrink-0">
        <p className={cn("text-sm font-mono font-semibold", colorClass)}>{sign}{formatMoney(t.amount)}</p>
        <p className="text-[10px] text-muted-foreground font-mono">{formatDateTime(t.date, t.time)}</p>
      </div>
    </div>
  );
}

// ─── Split Row ──────────────────────────────────────────────────────────────
function SplitRow({ s }: { s: any }) {
  const shares = (s.split_shares ?? []) as any[];
  const total = Number(s.total_amount);
  const totalShares = shares.reduce((sum: number, sh: any) => sum + Number(sh.share_amount), 0);
  const isGroup = s.type === "group";
  const isMulti = !isGroup && shares.length > 1;
  const isPerson = !isGroup && shares.length <= 1;

  const description = s.description || (
    isGroup ? (s.groups?.name ?? "Group split")
    : isPerson ? `Split w/ ${shares[0]?.person_name ?? s.people?.name ?? ""}`
    : "Split"
  );

  const personName = s.people?.name ?? shares[0]?.person_name ?? "";
  const peopleName = shares.length > 2
    ? `${shares[0]?.person_name}, ${shares[1]?.person_name} +${shares.length - 2} more`
    : shares.map((sh: any) => sh.person_name).filter(Boolean).join(", ");
  const groupName = s.groups?.name ?? "Group";
  const shareCount = shares.length + 1;
  const perShare = shareCount > 0 ? total / shareCount : 0;

  return (
    <div className="bg-card" style={{ borderLeft: "3px solid #F59E0B" }}>
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium truncate flex-1">{description}</p>
          <p className="text-sm font-mono font-semibold text-[#F59E0B] shrink-0">{formatMoney(total)}</p>
        </div>
        {isPerson && (
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <p className="text-[12px] text-[#9CA3AF] truncate flex-1">{personName}</p>
            <p className="text-[12px] font-mono font-semibold text-[#10B981] shrink-0">
              You lent {formatMoney(totalShares)}
            </p>
          </div>
        )}
        {(isMulti || isGroup) && (
          <>
            <div className="flex items-center justify-between gap-2 mt-0.5">
              <p className="text-[12px] text-[#9CA3AF] truncate flex-1">{isGroup ? groupName : peopleName}</p>
              <p className="text-[12px] font-mono text-[#9CA3AF] shrink-0">
                {shares.length} × {formatMoney(perShare)}
              </p>
            </div>
            <div className="flex items-center justify-between gap-2 mt-0.5">
              <p className="text-[12px] text-[#9CA3AF]">Paid by You</p>
              <p className="text-[12px] font-mono font-semibold text-[#10B981] shrink-0">
                You lent {formatMoney(totalShares)}
              </p>
            </div>
          </>
        )}
        <p className="text-[10px] text-muted-foreground font-mono mt-0.5 text-right">{formatDateTime(s.date, s.time)}</p>
      </div>
    </div>
  );
}

// ─── Settlement Row ─────────────────────────────────────────────────────────
function SettlementRow({ s }: { s: any }) {
  const share = s.split_shares as any;
  const shareAmount = Number(share?.share_amount ?? 0);
  const settled = Number(s.amount);
  const remaining = Math.max(0, shareAmount - settled);
  const isFullySettled = shareAmount > 0 && remaining === 0;
  const payerName = share?.person_name ?? "Unknown";
  const dateStr = s.created_at
    ? format(new Date(s.created_at), "MMM dd, yyyy · hh:mm a")
    : "";

  return (
    <div className="bg-card" style={{ borderLeft: "3px solid #10B981" }}>
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium truncate flex-1">{payerName} → You</p>
          <p className="text-sm font-mono text-[#10B981] shrink-0">{formatMoney(settled)}</p>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          {isFullySettled ? (
            <p className="text-[12px] font-medium text-[#10B981]">Fully settled</p>
          ) : (
            <>
              <p className="text-[12px] text-[#F59E0B]">Still owes</p>
              <p className="text-[12px] font-mono text-[#F59E0B] shrink-0">{formatMoney(remaining)} remaining</p>
            </>
          )}
        </div>
        <p className="text-[10px] text-[#9CA3AF] font-mono mt-0.5 text-right">{dateStr}</p>
      </div>
    </div>
  );
}

// ─── Edit Transaction Sheet ────────────────────────────────────────────────
function EditTxSheet({ txn, open, onOpenChange }: { txn: any; open: boolean; onOpenChange: (o: boolean) => void }) {
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
  const [toAccountId, setToAccountId] = useState(txn.to_account_id ?? "");
  const [categoryId, setCategoryId] = useState(txn.category_id ?? "");
  const [subCatId, setSubCatId] = useState(txn.sub_category_id ?? "");

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

      // FIX 7: update account balance for the amount diff
      const oldAmt = Number(txn.amount);
      const newAmt = Number(amount);
      const diff = newAmt - oldAmt;
      if (diff !== 0 && accountId) {
        const isIncome = txn.type === "income";
        const { data: acct } = await supabase
          .from("accounts").select("current_balance").eq("id", accountId).single();
        if (acct) {
          const delta = isIncome ? diff : -diff;
          await supabase.from("accounts")
            .update({ current_balance: Number(acct.current_balance) + delta })
            .eq("id", accountId);
        }
      }
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
                {(accounts as any[]).map((a) => (
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
                  {(accounts as any[]).map((a) => (
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
                    {(cats as any[]).map((c) => (
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
                      {(subs as any[]).map((s) => (
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
