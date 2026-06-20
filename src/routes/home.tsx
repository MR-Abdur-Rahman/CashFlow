import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { accountsQuery, transactionsQuery, profileQuery, notificationsQuery, peopleQuery, splitsQuery, incomingSplitsQuery } from "@/lib/queries";
import { formatMoney, greeting } from "@/lib/format";
import { AccountIcon } from "@/components/AccountIcon";
import { AddTransactionSheet } from "@/components/AddTransactionSheet";
import { Fab } from "@/components/Fab";
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Users, ChevronDown, Bell, History, X } from "lucide-react";
import { format, startOfWeek, startOfMonth } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { UserAvatar } from "@/components/UserAvatar";
import { SwipeRow } from "@/components/SwipeRow";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type FilterPeriod = "today" | "week" | "month";

function getDateRange(period: FilterPeriod): { dateFrom: string; dateTo: string } {
  const today = format(new Date(), "yyyy-MM-dd");
  if (period === "today") return { dateFrom: today, dateTo: today };
  if (period === "week") return { dateFrom: format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"), dateTo: today };
  return { dateFrom: format(startOfMonth(new Date()), "yyyy-MM-dd"), dateTo: today };
}

const PERIOD_LABELS: { key: FilterPeriod; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "Weekly" },
  { key: "month", label: "Monthly" },
];

export default function Home() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [editTxn, setEditTxn] = useState<any>(null);
  const [deleteTxn, setDeleteTxn] = useState<any>(null);
  const [period, setPeriod] = useState<FilterPeriod>("today");
  const [notifOpen, setNotifOpen] = useState(false);
  const [txnTab, setTxnTab] = useState<"transactions" | "splits">("transactions");
  const qc = useQueryClient();

  const { dateFrom, dateTo } = getDateRange(period);
  const { data: accounts = [] } = useQuery(accountsQuery());
  const { data: txns = [] } = useQuery(transactionsQuery({ dateFrom, dateTo }));
  const { data: ownSplits = [] } = useQuery(splitsQuery());
  const { data: incomingSplits = [] } = useQuery(incomingSplitsQuery());

  const allSplitsForTab = useMemo(() => {
    const seen = new Set<string>();
    return [...(ownSplits as any[]), ...(incomingSplits as any[])]
      .filter((s) => {
        if (seen.has(s.id)) return false;
        seen.add(s.id);
        return s.date >= dateFrom && s.date <= dateTo;
      })
      .sort((a, b) =>
        a.date !== b.date
          ? b.date.localeCompare(a.date)
          : (b.time || "").localeCompare(a.time || "")
      );
  }, [ownSplits, incomingSplits, dateFrom, dateTo]);

  const [userId, setUserId] = useState<string | undefined>();
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id));
  }, []);
  const { data: profile } = useQuery(profileQuery(userId));
  const { data: notifications = [] } = useQuery(notificationsQuery());
  const unreadCount = (notifications as any[]).filter((n: any) => !n.is_read).length;

  // Auto-mark non-settlement notifications as read when bell opens
  useEffect(() => {
    if (!notifOpen) return;
    const ids = (notifications as any[])
      .filter((n: any) => !n.is_read && n.type !== "settlement_account_needed")
      .map((n: any) => n.id);
    if (ids.length === 0) return;
    supabase.from("notifications").update({ is_read: true }).in("id", ids)
      .then(() => qc.invalidateQueries({ queryKey: ["notifications"] }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifOpen]);

  const total = accounts.reduce((s, a) => s + Number(a.current_balance), 0);
  const displayName = profile?.full_name
    ? profile.full_name.split(/\s+/).slice(0, 2).join(" ")
    : "there";

  const emptyMessages: Record<FilterPeriod, string> = {
    today: "No transactions today. Tap + to add one.",
    week: "No transactions this week. Tap + to add one.",
    month: "No transactions this month. Tap + to add one.",
  };

  const currentLabel = PERIOD_LABELS.find((p) => p.key === period)?.label ?? "Today";

  return (
    <div className="px-4 pt-6 space-y-5 pb-24">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{greeting()},</p>
          <h1 className="text-xl font-semibold">{displayName}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setNotifOpen(true)}
            className="relative h-10 w-10 flex items-center justify-center rounded-full bg-secondary"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute top-0.5 right-0.5 h-4 min-w-4 rounded-full bg-destructive text-white text-[10px] font-bold flex items-center justify-center px-0.5 leading-none">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
          <Link to="/settings" aria-label="Profile">
            <UserAvatar url={profile?.avatar_url} name={profile?.full_name} size={40} />
          </Link>
        </div>
      </div>

      {/* Balance Card */}
      <div className="balance-gradient rounded-2xl p-5 relative overflow-hidden">
        <p className="text-xs font-mono text-white/70 uppercase tracking-wider">Total Balance</p>
        <p className="text-xs font-mono text-white mt-1">LKR</p>
        <p className="text-4xl font-mono font-bold text-white tracking-tight">
          {total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      </div>

      {/* Accounts */}
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2 px-1">Accounts</p>
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x">
          {accounts.map((a) => (
            <Link to={`/accounts/${a.id}`} key={a.id}
              className="surface-card min-w-[180px] p-3 snap-start block active:opacity-80">
              <AccountIcon iconType={a.icon_type} iconName={a.icon_name} iconColor={a.icon_color} iconUrl={a.icon_url} size={36} />
              <p className="text-xs text-muted-foreground mt-2 truncate">
                {[a.institution, a.label].filter(Boolean).join(" · ") || a.label}
              </p>
              <p className="font-mono text-base font-semibold mt-0.5">{formatMoney(a.current_balance)}</p>
            </Link>
          ))}
          {accounts.length === 0 && <p className="text-sm text-muted-foreground py-4">No accounts yet</p>}
        </div>
      </div>

      {/* Transactions Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground px-1">Transactions</p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 bg-primary text-white text-sm font-medium px-4 py-1.5 rounded-xl">
                {currentLabel} <ChevronDown className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {PERIOD_LABELS.map(({ key, label }) => (
                <DropdownMenuItem key={key} onClick={() => setPeriod(key)}
                  className={cn("text-base py-3", period === key && "text-primary font-medium")}>
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Transactions | Splits tab switcher */}
        <div className="flex gap-2 mb-3">
          {(["transactions", "splits"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setTxnTab(tab)}
              className="flex-1 py-2 text-sm font-medium rounded-lg capitalize transition-colors"
              style={
                txnTab === tab
                  ? { background: "#1A1A1A", color: "white", border: "1px solid #7C3AED" }
                  : { background: "#2A2A2A", color: "#9CA3AF", border: "1px solid transparent" }
              }
            >
              {tab === "transactions" ? "Transactions" : "Splits"}
            </button>
          ))}
        </div>

        {(() => {
          if (txnTab === "splits") {
            return (
              <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
                {allSplitsForTab.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-10 px-4">{emptyMessages[period]}</p>
                ) : (
                  <div className="divide-y divide-border">
                    {allSplitsForTab.map((s) => (
                      <SplitDirectRow key={s.id} s={s} />
                    ))}
                  </div>
                )}
              </div>
            );
          }
          const visibleTxns = (txns as any[]).filter((t) => !t.is_split);
          return (
            <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
              {visibleTxns.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10 px-4">{emptyMessages[period]}</p>
              ) : (
                <div className="divide-y divide-border">
                  {visibleTxns.map((t) => (
                    <SwipeRow key={t.id} onEdit={() => setEditTxn(t)} onDelete={() => setDeleteTxn(t)}>
                      <TxRowInner t={t} onClick={() => setEditTxn(t)} />
                    </SwipeRow>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      <Fab onClick={() => setOpen(true)} />
      <AddTransactionSheet open={open} onOpenChange={setOpen} />

      <NotificationSheet
        open={notifOpen}
        onOpenChange={setNotifOpen}
        notifications={notifications as any[]}
        onNavigate={(path) => { setNotifOpen(false); navigate(path); }}
      />

      {editTxn && (
        <EditTxSheet txn={editTxn} open={!!editTxn} onOpenChange={(o) => { if (!o) setEditTxn(null); }} />
      )}

      <AlertDialog open={!!deleteTxn} onOpenChange={(o) => { if (!o) setDeleteTxn(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete transaction?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this transaction and update your balance. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white" onClick={async () => {
              if (!deleteTxn) return;
              const { error } = await supabase.from("transactions").delete().eq("id", deleteTxn.id);
              if (error) toast.error(error.message);
              else {
                toast.success("Deleted");
                qc.invalidateQueries({ queryKey: ["transactions"] });
                qc.invalidateQueries({ queryKey: ["accounts"] });
                qc.invalidateQueries({ queryKey: ["splits"] });
              }
              setDeleteTxn(null);
            }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TxRowInner({ t, onClick }: { t: any; onClick: () => void }) {
  if (t.is_split) return <SplitRowContent t={t} onClick={onClick} />;

  const isIncome = t.type === "income";
  const isExpense = t.type === "expense";
  const isTransfer = t.type === "transfer";

  const colorClass = isIncome ? "text-income" : isExpense ? "text-expense" : "text-transfer";
  const bgClass = isIncome ? "bg-[var(--color-income-bg)]" : isExpense ? "bg-[var(--color-expense-bg)]" : "bg-[var(--color-transfer-bg)]";
  const Icon = isIncome ? ArrowDownLeft : isExpense ? ArrowUpRight : ArrowLeftRight;
  const sign = isIncome ? "+" : isTransfer ? "" : "-";

  const title = t.categories
    ? `${t.categories.icon ?? ""} ${t.categories.name}${t.sub_categories ? " · " + t.sub_categories.name : ""}`
    : isIncome ? (t.income_source_text ?? "Income")
    : isTransfer ? "Transfer"
    : "Expense";

  const sub = isTransfer
    ? `${t.accounts?.label ?? ""} → ${t.to_account?.label ?? ""}`
    : (t.accounts ? [t.accounts.institution, t.accounts.label].filter(Boolean).join(" · ") : "");

  return (
    <div className="flex items-center gap-3 p-4 bg-card cursor-pointer active:bg-secondary/40" onClick={onClick}>
      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${bgClass} ${colorClass}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{title}</p>
        <p className="text-xs text-muted-foreground truncate">{sub}</p>
      </div>
      <div className="text-right">
        <p className={`text-sm font-mono font-semibold ${colorClass}`}>{sign}{formatMoney(t.amount)}</p>
        <p className="text-[10px] text-muted-foreground font-mono">{t.time?.slice(0, 5)}</p>
      </div>
    </div>
  );
}

function SplitRowContent({ t, onClick }: { t: any; onClick: () => void }) {
  const s = t.split;

  // Fallback if split data not joined
  if (!s) {
    return (
      <div className="flex items-center gap-3 p-4 bg-card cursor-pointer active:bg-secondary/40"
        style={{ borderLeft: "3px solid #F59E0B" }} onClick={onClick}>
        <div className="h-10 w-10 rounded-full flex items-center justify-center bg-[var(--color-split-bg)] text-split shrink-0">
          <Users className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Split expense</p>
        </div>
        <p className="text-sm font-mono font-semibold text-[#F59E0B]">-{formatMoney(t.amount)}</p>
      </div>
    );
  }

  const shares = (s.split_shares ?? []) as any[];
  const total = Number(s.total_amount ?? t.amount);
  const totalShares = shares.reduce((sum: number, sh: any) => sum + Number(sh.share_amount), 0);
  const myShare = total - totalShares;
  const isMePaid = s.paid_by === "me";
  const isGroup = s.type === "group";
  const isMulti = !isGroup && shares.length > 1;
  const isPerson = !isGroup && shares.length <= 1;

  const description = s.description
    || (isGroup ? (s.groups?.name ?? "Group split")
      : isPerson ? `Split w/ ${shares[0]?.person_name ?? s.people?.name ?? ""}`
      : "Split");

  const personName = s.people?.name ?? shares[0]?.person_name ?? "";
  const peopleName = shares.length > 2
    ? `${shares[0]?.person_name}, ${shares[1]?.person_name} +${shares.length - 2} more`
    : shares.map((sh: any) => sh.person_name).filter(Boolean).join(", ");
  const groupName = s.groups?.name ?? "Group";
  const shareCount = shares.length + 1;
  const perShare = shareCount > 0 ? total / shareCount : 0;

  return (
    <div className="bg-card cursor-pointer active:bg-secondary/40" style={{ borderLeft: "3px solid #F59E0B" }} onClick={onClick}>
      <div className="px-4 py-3">
        {/* Line 1: description + total */}
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium truncate flex-1">{description}</p>
          <p className="text-sm font-mono font-semibold text-[#F59E0B] shrink-0">{formatMoney(total)}</p>
        </div>

        {/* Person split: 2 lines */}
        {isPerson && (
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <p className="text-[12px] text-[#9CA3AF] truncate flex-1">{personName}</p>
            <div className="text-right shrink-0">
              {isMePaid ? (
                <p className="text-[12px] font-mono font-semibold text-[#10B981]">You lent {formatMoney(totalShares)}</p>
              ) : (
                <p className="text-[12px] font-mono font-semibold text-[#F59E0B]">You owe {formatMoney(myShare)}</p>
              )}
            </div>
          </div>
        )}

        {/* People / Group split: 3 lines */}
        {(isMulti || isGroup) && (
          <>
            <div className="flex items-center justify-between gap-2 mt-0.5">
              <p className="text-[12px] text-[#9CA3AF] truncate flex-1">{isGroup ? groupName : peopleName}</p>
              <p className="text-[12px] font-mono text-[#9CA3AF] shrink-0">
                {isMePaid
                  ? `${shares.length} × ${formatMoney(perShare)}`
                  : formatMoney(perShare)}
              </p>
            </div>
            <div className="flex items-center justify-between gap-2 mt-0.5">
              <p className="text-[12px] text-[#9CA3AF]">
                {isMePaid ? "Paid by You" : `Paid by ${s.paid_by}`}
              </p>
              <p className={`text-[12px] font-mono font-semibold shrink-0 ${isMePaid ? "text-[#10B981]" : "text-[#F59E0B]"}`}>
                {isMePaid ? `You lent ${formatMoney(totalShares)}` : `You owe ${formatMoney(myShare > 0 ? myShare : perShare)}`}
              </p>
            </div>
          </>
        )}

        {/* Time */}
        <p className="text-[10px] text-muted-foreground font-mono mt-0.5 text-right">{t.time?.slice(0, 5)}</p>
      </div>
    </div>
  );
}

function SplitDirectRow({ s }: { s: any }) {
  const shares = (s.split_shares ?? []) as any[];
  const total = Number(s.total_amount);
  const totalShares = shares.reduce((sum: number, sh: any) => sum + Number(sh.share_amount), 0);
  const myShare = total - totalShares;
  const isMePaid = s.paid_by === "me";
  const isGroup = s.type === "group";
  const isMulti = !isGroup && shares.length > 1;
  const isPerson = !isGroup && shares.length <= 1;
  const isIncoming = !!s._isIncoming;
  const isOtherPaid = !isMePaid || isIncoming;

  const description = s.description || (
    isGroup ? (s.groups?.name ?? "Group split")
    : isPerson ? `Split w/ ${shares[0]?.person_name ?? s.people?.name ?? ""}`
    : "Split"
  );

  if (isOtherPaid) {
    // Resolve payer name:
    // - Incoming split: creator paid ("me" from their perspective) → use their profile full_name
    // - Own split with explicit name: paid_by is the person's name string
    // - Own split with fallback "other": look at split_shares for the first other person's name
    let paidByName: string;
    if (isIncoming) {
      paidByName = s.creator?.full_name ?? (s.paid_by !== "me" ? s.paid_by : "Other");
    } else if (s.paid_by === "other" || !s.paid_by) {
      paidByName = shares.find((sh: any) => sh.person_name)?.person_name ?? "Other";
    } else {
      paidByName = s.paid_by;
    }

    let youOwe: number;
    if (isIncoming && s._myPersonId) {
      const myShareRecord = shares.find((sh: any) => sh.person_id === s._myPersonId);
      youOwe = myShareRecord ? Number(myShareRecord.share_amount) : myShare;
    } else {
      youOwe = myShare;
    }
    return (
      <div className="bg-card" style={{ borderLeft: "3px solid #F59E0B" }}>
        <div className="px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium truncate flex-1">{description}</p>
            <p className="text-sm font-mono font-semibold text-[#F59E0B] shrink-0">{formatMoney(total)}</p>
          </div>
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <p className="text-[12px] text-[#9CA3AF] truncate flex-1">{paidByName}</p>
            <p className="text-[12px] font-mono font-semibold text-[#F59E0B] shrink-0">
              You owe {formatMoney(youOwe)}
            </p>
          </div>
          <p className="text-[10px] text-muted-foreground font-mono mt-0.5 text-right">{s.time?.slice(0, 5)}</p>
        </div>
      </div>
    );
  }

  // Me paid
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
        <p className="text-[10px] text-muted-foreground font-mono mt-0.5 text-right">{s.time?.slice(0, 5)}</p>
      </div>
    </div>
  );
}

function EditTxSheet({ txn, open, onOpenChange }: { txn: any; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState(String(txn.amount));
  const [note, setNote] = useState(txn.note ?? "");
  const [date, setDate] = useState(txn.date ?? format(new Date(), "yyyy-MM-dd"));
  const [time, setTime] = useState(txn.time?.slice(0, 5) ?? format(new Date(), "HH:mm"));
  const [accountId, setAccountId] = useState(txn.account_id ?? "");
  const [toAccountId, setToAccountId] = useState(txn.to_account_id ?? "");
  const [categoryId, setCategoryId] = useState(txn.category_id ?? "");
  const [subCatId, setSubCatId] = useState(txn.sub_category_id ?? "");

  // Income source fields
  const [sourceType, setSourceType] = useState<"person" | "source">(txn.income_source_type ?? "source");
  const [personId, setPersonId] = useState(txn.income_person_id ?? "");
  const [sourceText, setSourceText] = useState(txn.income_source_text ?? "");

  const { data: accounts = [] } = useQuery(accountsQuery());
  const { data: people = [] } = useQuery(peopleQuery());
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
        ...(txn.type === "income" ? {
          income_source_type: sourceType,
          income_person_id: sourceType === "person" && personId ? personId : null,
          income_source_text: sourceType === "source" ? sourceText : null,
        } : {}),
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
        <div className="px-5 pt-5 pb-3 border-b border-border">
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

          {txn.type === "income" && (
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
                <Select value={personId} onValueChange={setPersonId}>
                  <SelectTrigger><SelectValue placeholder="Select person" /></SelectTrigger>
                  <SelectContent>
                    {(people as any[]).map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {sourceType === "source" && (
                <Input
                  value={sourceText}
                  onChange={(e) => setSourceText(e.target.value)}
                  placeholder="e.g. Salary, Freelance, Gift"
                />
              )}
            </div>
          )}

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

function NotificationSheet({ open, onOpenChange, notifications, onNavigate }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  notifications: any[];
  onNavigate: (path: string) => void;
}) {
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");

  const visible = notifications.filter((n: any) => {
    if (filter === "unread") return !n.is_read;
    if (filter === "read") return n.is_read;
    return true;
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="bg-card border-border rounded-t-3xl p-0 h-[75dvh] flex flex-col">
        <SheetTitle className="sr-only">Notifications</SheetTitle>
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => onNavigate("/settings/notifications")}
              className="h-8 w-8 flex items-center justify-center rounded-full bg-secondary">
              <History className="h-4 w-4" />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="flex items-center gap-1 text-sm font-medium bg-secondary px-3 py-1.5 rounded-xl capitalize">
                  {filter === "all" ? "All" : filter === "unread" ? "Unread" : "Read"}
                  <ChevronDown className="h-3.5 w-3.5 ml-0.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-28">
                {(["all", "unread", "read"] as const).map((f) => (
                  <DropdownMenuItem key={f} onClick={() => setFilter(f)}
                    className={cn("capitalize", filter === f && "text-primary font-medium")}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <button type="button" onClick={() => onOpenChange(false)}
            className="h-8 w-8 flex items-center justify-center rounded-full bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {visible.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              {filter === "all" ? "All caught up!" : `No ${filter} notifications`}
            </p>
          ) : (
            visible.slice(0, 20).map((n: any) => (
              <div
                key={n.id}
                className={`flex items-start gap-3 px-5 py-4 ${!n.is_read ? "bg-primary/5" : "bg-card"} ${n.type === "settlement_account_needed" ? "cursor-pointer active:bg-secondary/40" : ""}`}
                onClick={n.type === "settlement_account_needed" ? () => onNavigate("/accounts") : undefined}
              >
                <div className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${!n.is_read ? "bg-primary" : "bg-transparent border border-border"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{n.message}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {format(new Date(n.created_at), "MMM d · h:mm a")}
                  </p>
                  {n.type === "settlement_account_needed" && (
                    <p className="text-xs text-primary mt-1">Tap to go to Accounts →</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}