import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { accountsQuery, transactionsQuery, profileQuery, notificationsQuery, peopleQuery, splitsQuery, incomingSplitsQuery, groupsQuery, categoriesQuery, subCategoriesQuery } from "@/lib/queries";
import { formatMoney, greeting } from "@/lib/format";
import { AccountIcon } from "@/components/AccountIcon";
import { AddTransactionSheet } from "@/components/AddTransactionSheet";
import { Fab } from "@/components/Fab";
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Users, ChevronDown, ChevronRight, Check, Bell, History, X } from "lucide-react";
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
import { SettlementEditSheet } from "@/components/SettlementEditSheet";

type FilterPeriod = "today" | "week" | "month";

function getDateRange(period: FilterPeriod): { dateFrom: string; dateTo: string } {
  const today = format(new Date(), "yyyy-MM-dd");
  if (period === "today") return { dateFrom: today, dateTo: today };
  if (period === "week") return { dateFrom: format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"), dateTo: today };
  return { dateFrom: format(startOfMonth(new Date()), "yyyy-MM-dd"), dateTo: today };
}

function formatDateTime(date?: string, time?: string): string {
  if (!date) return "";
  const t = time?.slice(0, 5) ?? "00:00";
  return format(new Date(`${date}T${t}`), "MMM dd, yyyy · hh:mm a");
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
  const [editSplit, setEditSplit] = useState<any>(null);
  const [deleteSplit, setDeleteSplit] = useState<any>(null);
  const [editSettlement, setEditSettlement] = useState<any>(null);
  const [deleteHomeSettlement, setDeleteHomeSettlement] = useState<any>(null);
  const [period, setPeriod] = useState<FilterPeriod>("today");
  const [notifOpen, setNotifOpen] = useState(false);
  const [txnTab, setTxnTab] = useState<"transactions" | "splits">("transactions");
  const qc = useQueryClient();

  const { dateFrom, dateTo } = getDateRange(period);
  const { data: accounts = [] } = useQuery(accountsQuery());
  const { data: txns = [] } = useQuery(transactionsQuery({ dateFrom, dateTo }));
  const { data: ownSplits = [] } = useQuery(splitsQuery());
  const { data: incomingSplits = [] } = useQuery(incomingSplitsQuery());

  const { data: homeSettlements = [] } = useQuery({
    queryKey: ["settlements", "home", dateFrom, dateTo],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data, error } = await supabase
        .from("settlements")
        .select("*, split_shares:split_share_id(person_name, share_amount)")
        .eq("created_by", u.user.id)
        .gte("created_at", dateFrom)
        .lte("created_at", dateTo + "T23:59:59.999");
      if (error) throw error;
      return data ?? [];
    },
  });

  const allSplitsForTab = useMemo(() => {
    // Build a map keyed by split ID. Incoming version always wins over own version
    // (with the explicit splitsQuery created_by filter, overlap should never occur).
    const byId = new Map<string, any>();
    for (const s of ownSplits as any[]) {
      byId.set(s.id, { ...s, _isIncoming: false });
    }
    for (const s of incomingSplits as any[]) {
      // Incoming always overwrites — a split cannot be both own and incoming
      byId.set(s.id, {
        ...s,
        _isIncoming: true,
        _myPersonId: s._myPersonId ?? null,
        _createdByUserId: s._createdByUserId ?? null,
      });
    }
    return Array.from(byId.values())
      .filter(s => s.date >= dateFrom && s.date <= dateTo)
      .sort((a, b) =>
        a.date !== b.date
          ? b.date.localeCompare(a.date)
          : (b.time || "").localeCompare(a.time || "")
      );
  }, [ownSplits, incomingSplits, dateFrom, dateTo]);

  const splitsTabItems = useMemo(() => {
    // Build all-time person maps from every split owned by the user
    const personTotalOwed = new Map<string, number>();
    const personAllSettlements = new Map<string, { id: string; amount: number; created_at: string }[]>();
    for (const split of ownSplits as any[]) {
      const shares = (split.split_shares ?? []) as any[];
      const shareIdToName = new Map<string, string>(
        shares.map((sh: any) => [sh.id as string, (sh.person_name ?? "Unknown") as string])
      );
      for (const sh of shares) {
        const nm = (sh.person_name ?? "Unknown") as string;
        personTotalOwed.set(nm, (personTotalOwed.get(nm) ?? 0) + Number(sh.share_amount ?? 0));
      }
      for (const sett of (split.settlements ?? []) as any[]) {
        const nm = shareIdToName.get(sett.split_share_id as string);
        if (!nm) continue;
        const arr = personAllSettlements.get(nm) ?? [];
        arr.push({ id: sett.id as string, amount: Number(sett.amount ?? 0), created_at: (sett.created_at ?? "") as string });
        personAllSettlements.set(nm, arr);
      }
    }
    for (const arr of personAllSettlements.values()) {
      arr.sort((a, b) => a.created_at.localeCompare(b.created_at));
    }

    const splitItems = allSplitsForTab.map((s: any) => ({
      ...s,
      _itemType: "split" as const,
      _sortKey: s.created_at ?? `${s.date}T${s.time ?? "00:00"}`,
    }));

    const settlementItems = (homeSettlements as any[]).map((s) => {
      const personName = ((s.split_shares as any)?.person_name ?? "Unknown") as string;
      const totalOwed = personTotalOwed.get(personName) ?? 0;
      const sorted = personAllSettlements.get(personName) ?? [];
      const idx = sorted.findIndex((x) => x.id === (s.id as string));
      const cumulative = idx >= 0
        ? sorted.slice(0, idx + 1).reduce((sum, x) => sum + x.amount, 0)
        : Number(s.amount ?? 0);
      const remaining = Math.max(0, totalOwed - cumulative);
      return {
        ...s,
        _itemType: "settlement" as const,
        _sortKey: (s.created_at ?? "") as string,
        _remaining: remaining,
        _isFullySettled: totalOwed > 0 && remaining <= 0,
      };
    });

    return [...splitItems, ...settlementItems].sort((a, b) => b._sortKey.localeCompare(a._sortKey));
  }, [allSplitsForTab, homeSettlements, ownSplits]);

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
        <div className="flex rounded-xl bg-secondary p-1 gap-1 mb-3">
          {(["transactions", "splits"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setTxnTab(tab)}
              className={cn("flex-1 rounded-lg py-2 text-sm font-medium transition-colors",
                txnTab === tab ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}
            >
              {tab === "transactions" ? "Transactions" : "Splits"}
            </button>
          ))}
        </div>

        {(() => {
          if (txnTab === "splits") {
            return (
              <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
                {splitsTabItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-10 px-4">{emptyMessages[period]}</p>
                ) : (
                  <div className="divide-y divide-border">
                    {splitsTabItems.map((item: any) =>
                      item._itemType === "settlement" ? (
                        <SwipeRow key={`set-${item.id}`} onEdit={() => setEditSettlement(item)} onDelete={() => setDeleteHomeSettlement(item)}>
                          <HomeSettlementRow s={item} />
                        </SwipeRow>
                      ) : (
                        <SwipeRow key={item.id} onEdit={() => setEditSplit(item)} onDelete={() => setDeleteSplit(item)}>
                          <SplitDirectRow s={item} />
                        </SwipeRow>
                      )
                    )}
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
                      <TxRowInner t={t} />
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
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
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
            <AlertDialogAction className="bg-destructive text-white" onClick={async () => {
              if (!deleteSplit) return;
              const { error } = await supabase.from("splits").delete().eq("id", deleteSplit.id);
              if (error) toast.error(error.message);
              else {
                toast.success("Split deleted");
                qc.invalidateQueries({ queryKey: ["splits"] });
                qc.invalidateQueries({ queryKey: ["transactions"] });
                qc.invalidateQueries({ queryKey: ["accounts"] });
              }
              setDeleteSplit(null);
            }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {editSettlement && (
        <SettlementEditSheet
          settlement={editSettlement}
          open={!!editSettlement}
          onOpenChange={(o) => { if (!o) setEditSettlement(null); }}
        />
      )}

      <AlertDialog open={!!deleteHomeSettlement} onOpenChange={(o) => { if (!o) setDeleteHomeSettlement(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white" onClick={async () => {
              if (!deleteHomeSettlement) return;
              const { error } = await supabase.from("settlements").delete().eq("id", deleteHomeSettlement.id);
              if (error) toast.error(error.message);
              else {
                toast.success("Settlement deleted");
                qc.invalidateQueries({ queryKey: ["settlements"] });
                qc.invalidateQueries({ queryKey: ["accounts"] });
                qc.invalidateQueries({ queryKey: ["splits"] });
                qc.invalidateQueries({ queryKey: ["split_shares"] });
              }
              setDeleteHomeSettlement(null);
            }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TxRowInner({ t }: { t: any }) {
  if (t.is_split) return <SplitRowContent t={t} />;

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
    <div className="flex items-center gap-3 p-4 bg-card">
      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${bgClass} ${colorClass}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{title}</p>
        <p className="text-xs text-muted-foreground truncate">{sub}</p>
      </div>
      <div className="text-right">
        <p className={`text-sm font-mono font-semibold ${colorClass}`}>{sign}{formatMoney(t.amount)}</p>
        <p className="text-[10px] text-muted-foreground font-mono">{formatDateTime(t.date, t.time)}</p>
      </div>
    </div>
  );
}

function SplitRowContent({ t }: { t: any }) {
  const s = t.split;

  // Fallback if split data not joined
  if (!s) {
    return (
      <div className="flex items-center gap-3 p-4 bg-card"
        style={{ borderLeft: "3px solid #F59E0B" }}>
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
    <div className="bg-card" style={{ borderLeft: "3px solid #F59E0B" }}>
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
        <p className="text-[10px] text-muted-foreground font-mono mt-0.5 text-right">{formatDateTime(t.date, t.time)}</p>
      </div>
    </div>
  );
}

function SplitDirectRow({ s }: { s: any }) {
  const shares = (s.split_shares ?? []) as any[];
  const total = Number(s.total_amount);
  const totalShares = shares.reduce((sum: number, sh: any) => sum + Number(sh.share_amount), 0);
  const isGroup = s.type === "group";
  const isMulti = !isGroup && shares.length > 1;
  const isPerson = !isGroup && shares.length <= 1;
  const isIncoming = s._isIncoming === true; // must be explicitly true, not just truthy

  // Did the CURRENT VIEWER pay? For incoming, paid_by="me" means the CREATOR paid (not the viewer).
  const isMePaid = (() => {
    if (!isIncoming) return s.paid_by === "me";
    if (s.paid_by_person_id != null && s._myPersonId != null) {
      return s.paid_by_person_id === s._myPersonId;
    }
    return s.paid_by !== "me"; // fallback for old splits without paid_by_person_id
  })();

  // Counterpart label on line 2
  const groupName = s.groups?.name ?? "Unknown Group";
  const personLabel = isIncoming
    ? (s.creator?.full_name ?? "")
    : (s.people?.name ?? shares[0]?.person_name ?? "");
  // People split — always show participant names from split_shares (never the creator), max 2 then "+N more"
  const shareNames = shares.map((sh: any) => sh.person_name).filter(Boolean) as string[];
  const nameList = shareNames.slice(0, 2).join(", ") + (shares.length > 2 ? ` +${shares.length - 2} more` : "");
  // Group → group name; People → participant names; Person → other party (creator for incoming)
  const line2Name = isGroup ? groupName : isPerson ? personLabel : nameList;

  console.log("RAW SPLIT:", JSON.stringify({
    id: s.id,
    type: s.type,
    description: s.description,
    group_id: s.group_id,
    groups: s.groups,
    isIncoming: s._isIncoming,
    shares: (s.split_shares ?? []).map((sh: any) => ({
      name: sh.person_name,
      id: sh.person_id,
      amount: sh.share_amount,
    })),
    creator: s.creator,
    created_by: s.created_by,
  }));

  const description = s.description || (
    isGroup ? (s.groups?.name ?? "Group split")
    : isPerson ? `Split w/ ${shares[0]?.person_name ?? s.people?.name ?? ""}`
    : "Split"
  );

  // Amounts
  const myShareAmt = isIncoming
    ? Number(shares.find((sh: any) => sh.person_id === s._myPersonId)?.share_amount ?? 0)
    : 0;
  const creatorImplicit = total - totalShares; // creator's own (unrecorded) portion
  const youLent = isIncoming ? total - myShareAmt : totalShares; // what others owe the viewer
  const youOwe = isIncoming ? myShareAmt : creatorImplicit;       // what the viewer owes
  // Per-share = the actual recorded amount per participant (avoids guessing creator inclusion).
  // For a LKR 3,000 split among 3 (creator + 2 members), shares hold 2 × 1,000 → perShare = 1,000.
  const perShare = shares.length > 0 ? totalShares / shares.length : total;
  const owersCount = shares.length; // people who owe the viewer when the viewer paid

  // Account line — shown only when the viewer paid. Own split → account label; incoming → not recorded.
  const accountLabel = isMePaid
    ? (isIncoming ? "No account selected" : (s.accounts?.label ?? "No account selected"))
    : null;

  const dateNode = (
    <p className="text-[10px] text-[#9CA3AF] font-mono mt-0.5 text-right">{formatDateTime(s.date, s.time)}</p>
  );

  return (
    <div className="bg-card" style={{ borderLeft: "3px solid #F59E0B" }}>
      <div className="px-4 py-3">
        {/* Line 1: description + total */}
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-foreground truncate flex-1">{description}</p>
          <p className="text-sm font-mono font-semibold text-[#F59E0B] shrink-0">{formatMoney(total)}</p>
        </div>

        {/* Person split */}
        {isPerson && (
          <>
            <div className="flex items-center justify-between gap-2 mt-0.5">
              <p className="text-[12px] text-[#9CA3AF] truncate flex-1">{line2Name}</p>
              {isMePaid ? (
                <p className="text-[12px] font-mono font-semibold text-[#10B981] shrink-0">You lent {formatMoney(youLent)}</p>
              ) : (
                <p className="text-[12px] font-mono font-semibold text-[#F59E0B] shrink-0">You owe {formatMoney(youOwe)}</p>
              )}
            </div>
            {isMePaid ? (
              <div className="flex items-center justify-between gap-2 mt-0.5">
                <p className="text-[12px] text-[#9CA3AF] truncate flex-1">{accountLabel}</p>
                {dateNode}
              </div>
            ) : dateNode}
          </>
        )}

        {/* People / Group split */}
        {(isMulti || isGroup) && (
          <>
            <div className="flex items-center justify-between gap-2 mt-0.5">
              <p className="text-[12px] text-[#9CA3AF] truncate flex-1">{line2Name}</p>
              <p className="text-[12px] font-mono text-[#9CA3AF] shrink-0">
                {isMePaid ? `${owersCount} × ${formatMoney(perShare)}` : `${formatMoney(perShare)} per share`}
              </p>
            </div>
            {isMePaid ? (
              <div className="flex items-center justify-between gap-2 mt-0.5">
                <p className="text-[12px] text-[#9CA3AF] truncate flex-1">{accountLabel}</p>
                <p className="text-[12px] font-mono font-semibold text-[#10B981] shrink-0">You lent {formatMoney(youLent)}</p>
              </div>
            ) : (
              <div className="flex items-center justify-end gap-2 mt-0.5">
                <p className="text-[12px] font-mono font-semibold text-[#F59E0B] shrink-0">You owe {formatMoney(youOwe)}</p>
              </div>
            )}
            {dateNode}
          </>
        )}
      </div>
    </div>
  );
}

function HomeSettlementRow({ s }: { s: any }) {
  const share = s.split_shares as any;
  const settled = Number(s.amount);
  const remaining: number = s._remaining !== undefined
    ? s._remaining
    : Math.max(0, Number(share?.share_amount ?? 0) - settled);
  const isFullySettled: boolean = s._isFullySettled !== undefined
    ? s._isFullySettled
    : Number(share?.share_amount ?? 0) > 0 && remaining === 0;
  const payerName = share?.person_name ?? "Unknown";
  const dateStr = s.created_at
    ? format(new Date(s.created_at), "MMM dd, yyyy · hh:mm a")
    : "";

  return (
    <div className="bg-card" style={{ borderLeft: "3px solid #10B981" }}>
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium truncate flex-1">{payerName} → You</p>
          <p className="text-sm font-mono text-[#9CA3AF] shrink-0">{formatMoney(settled)}</p>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          {isFullySettled ? (
            <p className="text-[12px] font-medium text-[#10B981]">Fully settled</p>
          ) : (
            <>
              <p className="text-[12px] text-[#9CA3AF]">Still owes</p>
              <p className="text-[12px] font-mono text-[#9CA3AF] shrink-0">{formatMoney(remaining)} remaining</p>
            </>
          )}
        </div>
        <p className="text-[10px] text-[#9CA3AF] font-mono mt-0.5 text-right">{dateStr}</p>
      </div>
    </div>
  );
}

function EditMultiPickerSheet({
  open, onOpenChange, selected, onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  selected: { id: string; name: string }[];
  onConfirm: (people: { id: string; name: string }[]) => void;
}) {
  const { data: people = [] } = useQuery(peopleQuery());
  const [checked, setChecked] = useState<Set<string>>(new Set(selected.map((p) => p.id)));

  useEffect(() => { if (open) setChecked(new Set(selected.map((p) => p.id))); }, [open]);

  function toggle(id: string) {
    setChecked((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }

  function confirm() {
    const result = (people as any[]).filter((p) => checked.has(p.id)).map((p) => ({ id: p.id, name: p.name }));
    onConfirm(result);
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="bg-card border-border rounded-t-3xl p-0 h-[75dvh] flex flex-col">
        <SheetTitle className="sr-only">Select People</SheetTitle>
        <div className="px-5 pt-5 pb-3 border-b border-border shrink-0">
          <span className="text-base font-semibold">Select People</span>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {(people as any[]).length === 0 && <p className="text-sm text-muted-foreground text-center py-10">No people yet.</p>}
          {(people as any[]).map((p) => (
            <div key={p.id} onClick={() => toggle(p.id)}
              className="flex items-center gap-3 px-5 py-4 bg-card active:bg-secondary/40 cursor-pointer">
              <div className={cn("h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                checked.has(p.id) ? "bg-primary border-primary" : "border-border")}>
                {checked.has(p.id) && <Check className="h-3 w-3 text-white" />}
              </div>
              <p className="text-sm font-medium flex-1">{p.name}</p>
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-border shrink-0">
          <Button className="w-full bg-primary text-white" onClick={confirm} disabled={checked.size === 0}>
            Confirm ({checked.size} selected)
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function EditSplitSheet({ split, open, onOpenChange }: { split: any; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();

  const { data: accounts = [] } = useQuery(accountsQuery());
  const { data: people = [] } = useQuery(peopleQuery());
  const { data: groups = [] } = useQuery(groupsQuery());
  const { data: cats = [] } = useQuery(categoriesQuery("expense"));

  const [amount, setAmount] = useState(String(split.total_amount));
  const [description, setDescription] = useState(split.description ?? "");

  const [target, setTarget] = useState<"person" | "multi" | "group">(() => {
    if (split.type === "group") return "group";
    if (split.person_id) return "person";
    return "multi";
  });
  const [personId, setPersonId] = useState<string>(split.person_id ?? "");
  const [multiPeople, setMultiPeople] = useState<{ id: string; name: string }[]>(() => {
    if (split.type === "individual" && !split.person_id) {
      return (split.split_shares ?? [])
        .filter((sh: any) => sh.person_id)
        .map((sh: any) => ({ id: sh.person_id as string, name: sh.person_name as string }));
    }
    return [];
  });
  const [multiPickerOpen, setMultiPickerOpen] = useState(false);
  const [groupId, setGroupId] = useState<string>(split.group_id ?? "");

  const [whoPaid, setWhoPaid] = useState<"me" | "other">(split.paid_by === "me" ? "me" : "other");
  const [otherPayerId, setOtherPayerId] = useState<string>(() => {
    if (split.paid_by === "me") return "";
    const matched = (split.split_shares ?? []).find((sh: any) => sh.person_name === split.paid_by);
    return (matched?.person_id as string) ?? "";
  });
  const [accountId, setAccountId] = useState<string>(split.account_id ?? "");

  const [splitType, setSplitType] = useState<"equal" | "custom">(
    split.split_type === "custom" ? "custom" : "equal"
  );
  const [customAmounts, setCustomAmounts] = useState<Record<string, number>>(() => {
    const amounts: Record<string, number> = {};
    (split.split_shares ?? []).forEach((sh: any) => {
      if (sh.person_id) amounts[sh.person_id as string] = Number(sh.share_amount);
    });
    return amounts;
  });

  const [categoryId, setCategoryId] = useState<string>(split.category_id ?? "");
  const [subCatId, setSubCatId] = useState<string>(split.sub_category_id ?? "");
  const [date, setDate] = useState(split.date ?? format(new Date(), "yyyy-MM-dd"));
  const [time, setTime] = useState(split.time?.slice(0, 5) ?? format(new Date(), "HH:mm"));
  const [note, setNote] = useState("");

  const { data: subs = [] } = useQuery(subCategoriesQuery(categoryId || null));

  // Load note from linked transaction
  useEffect(() => {
    supabase.from("transactions").select("note").eq("split_id", split.id).maybeSingle()
      .then(({ data }) => { if (data?.note) setNote(String(data.note).replace(/^Split: /, "")); });
  }, [split.id]);

  // Default to first account if me paid and no account saved
  useEffect(() => {
    if (!accountId && whoPaid === "me" && (accounts as any[]).length > 0) {
      setAccountId((accounts as any[])[0].id as string);
    }
  }, [accounts, whoPaid]);

  const catDisplay = useMemo(() => {
    const c = (cats as any[]).find((x) => x.id === categoryId);
    return c ? `${c.icon ?? ""} ${c.name}` : null;
  }, [cats, categoryId]);

  const subDisplay = useMemo(() => {
    const s = (subs as any[]).find((x) => x.id === subCatId);
    return s?.name ?? null;
  }, [subs, subCatId]);

  const participants = useMemo<{ id: string; name: string }[]>(() => {
    if (target === "person" && personId) {
      const p = (people as any[]).find((x) => x.id === personId);
      return p ? [{ id: p.id as string, name: p.name as string }] : [];
    }
    if (target === "multi") return multiPeople;
    if (target === "group") {
      const g = (groups as any[]).find((x) => x.id === groupId);
      return (g?.group_members ?? []).map((m: any) => ({ id: m.person_id as string, name: (m.people?.name ?? "?") as string }));
    }
    return [];
  }, [target, personId, people, multiPeople, groupId, groups]);

  const total = Number(amount);
  const equalShare = participants.length > 0 ? total / (participants.length + 1) : 0;

  const paidByValue = useMemo(() => {
    if (whoPaid === "me") return "me";
    if (target === "person") {
      const p = (people as any[]).find((x) => x.id === personId);
      return (p?.name as string) ?? split.paid_by ?? "other";
    }
    if (otherPayerId) {
      const p = participants.find((x) => x.id === otherPayerId);
      return p?.name ?? "other";
    }
    return "other";
  }, [whoPaid, target, personId, people, otherPayerId, participants, split.paid_by]);

  const paidByPersonId = useMemo((): string | null => {
    if (whoPaid === "me") return null;
    if (target === "person") return personId || null;
    return otherPayerId || null;
  }, [whoPaid, target, personId, otherPayerId]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!total || total <= 0) throw new Error("Enter a valid amount");
      if (!description.trim()) throw new Error("Please enter a description");
      if (target === "group" && !groupId) throw new Error("Select a group");
      if (target !== "group" && participants.length === 0) throw new Error("Select at least one person");

      const { error: e1 } = await supabase.from("splits").update({
        type: target === "group" ? "group" : "individual",
        person_id: target === "person" ? personId || null : null,
        group_id: target === "group" ? groupId || null : null,
        description: description.trim(),
        total_amount: total,
        paid_by: paidByValue,
        paid_by_person_id: paidByPersonId,
        split_type: splitType,
        category_id: categoryId || null,
        sub_category_id: subCatId || null,
        account_id: whoPaid === "me" ? accountId || null : null,
        date, time,
      }).eq("id", split.id);
      if (e1) throw e1;

      await supabase.from("split_shares").delete().eq("split_id", split.id);
      if (participants.length > 0) {
        const shares = participants.map((p) => ({
          split_id: split.id,
          person_name: p.name,
          person_id: p.id || null,
          share_amount: splitType === "custom" ? (customAmounts[p.id] ?? 0) : equalShare,
        }));
        const { error: e2 } = await supabase.from("split_shares").insert(shares);
        if (e2) throw e2;
      }

      // Update linked transaction note (best-effort, no-op if no transaction exists)
      await supabase.from("transactions")
        .update({ note: note.trim() ? `Split: ${note.trim()}` : null, amount: total, category_id: categoryId || null, sub_category_id: subCatId || null, account_id: whoPaid === "me" ? accountId || null : null })
        .eq("split_id", split.id);
    },
    onSuccess: () => {
      toast.success("Split updated");
      qc.invalidateQueries({ queryKey: ["splits"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="bg-card border-border rounded-t-3xl p-0 h-[88dvh] flex flex-col">
          <SheetTitle className="sr-only">Edit split</SheetTitle>
          <div className="px-5 pt-5 pb-3 border-b border-border shrink-0">
            <span className="text-base font-semibold">Edit Split</span>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {/* Amount */}
            <div className="text-center py-2">
              <input inputMode="decimal" value={amount} placeholder="0.00"
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                className="w-full bg-transparent text-center text-5xl font-mono font-semibold outline-none text-[#F59E0B]" />
              <p className="text-xs text-muted-foreground mt-1 font-mono">LKR</p>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label>Description</Label>
              <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Dinner, Groceries, Trip"
                className="w-full text-sm text-white placeholder:text-muted-foreground outline-none px-3 py-2.5"
                style={{ background: "#0A0A0A", border: "1px solid #2A2A2A", borderRadius: "8px" }} />
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
                <Select value={personId} onValueChange={setPersonId}>
                  <SelectTrigger><SelectValue placeholder="Select person" /></SelectTrigger>
                  <SelectContent>
                    {(people as any[]).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
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
                <Select value={groupId} onValueChange={setGroupId}>
                  <SelectTrigger><SelectValue placeholder="Select group" /></SelectTrigger>
                  <SelectContent>
                    {(groups as any[]).map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Who paid */}
            <div className="space-y-1.5">
              <Label>Who paid?</Label>
              <div className="flex gap-2 rounded-lg bg-secondary p-1">
                {(["me", "other"] as const).map((m) => (
                  <button type="button" key={m} onClick={() => { setWhoPaid(m); setOtherPayerId(""); }}
                    className={cn("flex-1 rounded-md py-1.5 text-sm", whoPaid === m && "bg-primary text-white")}>
                    {m === "me" ? "You paid" : "Other paid"}
                  </button>
                ))}
              </div>
              {whoPaid === "other" && target === "person" && personId && (
                <p className="text-xs text-muted-foreground px-1">
                  {(people as any[]).find((p) => p.id === personId)?.name ?? "Other person"} paid for this expense
                </p>
              )}
              {whoPaid === "other" && (target === "multi" || target === "group") && participants.length > 0 && (
                <Select value={otherPayerId} onValueChange={setOtherPayerId}>
                  <SelectTrigger><SelectValue placeholder="Select who paid" /></SelectTrigger>
                  <SelectContent>
                    {participants.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Account — only when you paid */}
            {whoPaid === "me" && (
              <div className="space-y-1.5">
                <Label>Paid from</Label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                  <SelectContent>
                    {(accounts as any[]).map((a) => <SelectItem key={a.id} value={a.id}>{[a.institution, a.label].filter(Boolean).join(" · ")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Split type */}
            <div className="space-y-1.5">
              <Label>Split type</Label>
              <div className="flex gap-2 rounded-lg bg-secondary p-1">
                {(["equal", "custom"] as const).map((m) => (
                  <button type="button" key={m} onClick={() => setSplitType(m)}
                    className={cn("flex-1 rounded-md py-1.5 text-sm capitalize", splitType === m && "bg-primary text-white")}>{m}</button>
                ))}
              </div>
              {splitType === "equal" && participants.length > 0 && (
                <p className="text-xs text-muted-foreground">Each person pays: {formatMoney(equalShare)}</p>
              )}
              {splitType === "custom" && participants.length > 0 && (
                <div className="space-y-2 mt-1">
                  {participants.map((p) => (
                    <div key={p.id} className="flex items-center gap-3">
                      <span className="text-sm flex-1 truncate">{p.name}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-xs text-muted-foreground font-mono">LKR</span>
                        <input type="number" inputMode="decimal" placeholder="0.00"
                          value={customAmounts[p.id] ?? ""}
                          onChange={(e) => setCustomAmounts((prev) => ({ ...prev, [p.id]: Number(e.target.value) || 0 }))}
                          className="w-28 bg-secondary rounded-md px-2 py-1.5 text-sm text-right font-mono outline-none border border-border focus:border-primary" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={categoryId || "none"} onValueChange={(v) => { setCategoryId(v === "none" ? "" : v); setSubCatId(""); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category (optional)">
                    {categoryId ? (catDisplay ?? "Category") : "Select category (optional)"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {(cats as any[]).map((c) => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {categoryId && (subs as any[]).length > 0 && (
                <Select value={subCatId || "none"} onValueChange={(v) => setSubCatId(v === "none" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sub-category (optional)">
                      {subCatId ? (subDisplay ?? "Sub-category") : "Sub-category (optional)"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {(subs as any[]).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Date & Time */}
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
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Optional note" />
            </div>
          </div>

          <div className="p-4 pt-2 border-t border-border bg-card shrink-0">
            <Button className="w-full text-white font-medium" style={{ background: "#78350F" }}
              onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <EditMultiPickerSheet open={multiPickerOpen} onOpenChange={setMultiPickerOpen}
        selected={multiPeople} onConfirm={setMultiPeople} />
    </>
  );
}

export function EditTxSheet({ txn, open, onOpenChange }: { txn: any; open: boolean; onOpenChange: (o: boolean) => void }) {
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