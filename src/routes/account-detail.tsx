import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { accountQuery, transactionsQuery, splitBalancesQuery } from "@/lib/queries";
import { settlementNetAfter } from "@/lib/balance";
import { AccountIcon } from "@/components/AccountIcon";
import { formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { canModifySplit, deleteSplit as runSplitDelete } from "@/lib/deleteSplit";
import {
  canDeleteSettlement,
  deleteSettlement as deleteSettlementRpc,
} from "@/lib/deleteSettlement";
import { useState, useMemo, useEffect } from "react";
import { AddAccountSheet } from "@/components/AddAccountSheet";
import { SwipeRow } from "@/components/SwipeRow";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Link, useNavigate, useParams } from "react-router-dom";
import { EditSplitSheet, EditTxSheet } from "@/routes/home";
import { SettlementEditSheet } from "@/components/SettlementEditSheet";
import { SettlementRow } from "@/components/SettlementRow";
import { settlementDirection, shareRemaining } from "@/lib/settlement";
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subDays,
  addDays,
  subWeeks,
  addWeeks,
  subMonths,
  addMonths,
  subYears,
  addYears,
} from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
  if (period === "weekly")
    return {
      dateFrom: format(startOfWeek(anchor, { weekStartsOn: 1 }), "yyyy-MM-dd"),
      dateTo: format(endOfWeek(anchor, { weekStartsOn: 1 }), "yyyy-MM-dd"),
    };
  if (period === "monthly")
    return {
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
  const [userId, setUserId] = useState<string | undefined>();
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id));
  }, []);

  const { dateFrom, dateTo } = useMemo(() => getPeriodRange(period, anchor), [period, anchor]);

  const { data: txns = [] } = useQuery(transactionsQuery({ accountId, dateFrom, dateTo }));
  // Full split set (shared cache) for each settlement row's running net.
  const { data: balanceData } = useQuery(splitBalancesQuery());
  const netSplits = balanceData?.splits ?? [];
  const netSettlements = balanceData?.settlements ?? [];
  const netMeId = balanceData?.currentUserId ?? null;
  const netMyPids = balanceData?.myPersonIds ?? [];

  const { data: splits = [] } = useQuery({
    queryKey: ["splits", "account", accountId, dateFrom, dateTo],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from("splits")
        .select("*, split_shares(*), groups:group_id(name), people:person_id(name)")
        // Any split that used THIS account — whether the current user paid ("me") or they confirmed
        // it as the payer on a pending split someone else created. RLS already limits to splits the
        // user participates in, so no extra paid_by filter is needed (that wrongly hid confirmed ones).
        .eq("account_id", accountId)
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
        .select(
          "*, person:person_id(name), creator:created_by(full_name), split_shares:split_share_id(person_name, share_amount, person:people(linked_user_id)), splits:split_id(paid_by, created_by, creator:created_by(full_name), paid_by_person:paid_by_person_id(linked_user_id, name)), accounts:account_id(label, institution)",
        )
        .or(`account_id.eq.${accountId},receiver_account_id.eq.${accountId}`)
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
        _sortKey: s.created_at ?? `${s.date}T${s.time ?? "00:00"}`,
      })),
      ...(settlements as any[]).map((s) => {
        const { iPaid, otherName } = settlementDirection(s, userId);
        const { remaining, fullySettled } = shareRemaining(s, settlements as any[]);
        return {
          ...s,
          _itemType: "settlement" as const,
          _sortKey: (s.created_at ?? "") as string,
          _iPaid: iPaid,
          _otherName: otherName,
          _remaining: remaining,
          _fullySettled: fullySettled,
          _netAfter:
            settlementNetAfter(netSplits, netSettlements, s, netMeId, netMyPids) ?? undefined,
        };
      }),
    ];
    return items.sort((a, b) => b._sortKey.localeCompare(a._sortKey));
  }, [splits, settlements, userId, netSplits, netSettlements, netMeId, netMyPids]);

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
          iconType={account.icon_type}
          iconName={account.icon_name}
          iconColor={account.icon_color}
          iconUrl={account.icon_url}
          size={56}
        />
        <div className="flex-1">
          <p className="text-xs uppercase text-muted-foreground">
            {account.type}
            {account.institution && ` · ${account.institution}`}
          </p>
          <h1 className="text-lg font-semibold">{account.label}</h1>
        </div>
      </div>

      {/* Balance card */}
      <div className="rounded-2xl bg-card border border-border p-4">
        <p className="text-xs text-muted-foreground">Current balance</p>
        <p className="text-3xl font-mono font-bold mt-1">{formatMoney(account.current_balance)}</p>
        <p className="text-xs text-muted-foreground mt-1">
          Opening: {formatMoney(account.opening_balance)}
        </p>
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
                  onClick={() => {
                    setPeriod(p.key);
                    setAnchor(new Date());
                  }}
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
      <div className="flex rounded-xl bg-secondary p-1 gap-1">
        {(["transactions", "splits"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 rounded-lg py-2 text-sm font-medium transition-colors",
              tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
            )}
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
                <TxRow t={t} />
              </SwipeRow>
            ))
          )}
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden border border-border divide-y divide-border">
          {splitsTabItems.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No splits or settlements
            </p>
          ) : (
            splitsTabItems.map((item: any) =>
              item._itemType === "settlement" ? (
                <SwipeRow
                  key={`set-${item.id}`}
                  onEdit={() => setEditSettlement(item)}
                  onDelete={() => setDeleteSettlement(item)}
                  canEdit={item.created_by === userId}
                  canDelete={canDeleteSettlement(item, userId)}
                  editDeniedMessage="Only the creator can edit this settlement"
                  deleteDeniedMessage="Only the creator or payer can delete this settlement"
                >
                  <SettlementRow
                    description={item.description}
                    iPaid={item._iPaid}
                    otherName={item._otherName}
                    amount={Number(item.amount)}
                    remaining={item._remaining}
                    fullySettled={item._fullySettled}
                    netAfter={item._netAfter}
                    createdAt={item.created_at}
                  />
                </SwipeRow>
              ) : (
                <SwipeRow
                  key={`sp-${item.id}`}
                  onEdit={() => setEditSplit(item)}
                  onDelete={() => setDeleteSplitItem(item)}
                  canEdit={canModifySplit(item)}
                  canDelete={canModifySplit(item)}
                  editDeniedMessage="Only the creator or payer can edit this split"
                  deleteDeniedMessage="Only the creator or payer can delete this split"
                >
                  <SplitRow s={item} />
                </SwipeRow>
              ),
            )
          )}
        </div>
      )}

      <AddAccountSheet open={edit} onOpenChange={setEdit} edit={account} />

      {editSplit && (
        <EditSplitSheet
          split={editSplit}
          open={!!editSplit}
          onOpenChange={(o) => {
            if (!o) setEditSplit(null);
          }}
        />
      )}

      {editSettlement && (
        <SettlementEditSheet
          settlement={editSettlement}
          open={!!editSettlement}
          onOpenChange={(o) => {
            if (!o) setEditSettlement(null);
          }}
        />
      )}

      <AlertDialog
        open={!!deleteSplitItem}
        onOpenChange={(o) => {
          if (!o) setDeleteSplitItem(null);
        }}
      >
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
                if (!deleteSplitItem) return;
                await runSplitDelete(deleteSplitItem.id, qc);
                setDeleteSplitItem(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!deleteSettlement}
        onOpenChange={(o) => {
          if (!o) setDeleteSettlement(null);
        }}
      >
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
                if (!deleteSettlement) return;
                await deleteSettlementRpc(deleteSettlement.id, qc);
                setDeleteSettlement(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {editTxn && (
        <EditTxSheet
          txn={editTxn}
          open={!!editTxn}
          onOpenChange={(o) => {
            if (!o) setEditTxn(null);
          }}
        />
      )}

      <AlertDialog
        open={!!deleteTxn}
        onOpenChange={(o) => {
          if (!o) setDeleteTxn(null);
        }}
      >
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
                if (!deleteTxn) return;
                const txn = deleteTxn;
                const { error } = await supabase.from("transactions").delete().eq("id", txn.id);
                if (error) {
                  toast.error(error.message);
                  setDeleteTxn(null);
                  return;
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
function TxRow({ t }: { t: any }) {
  const isIncome = t.type === "income";
  const isTransfer = t.type === "transfer";

  const colorClass = isIncome ? "text-[#22C55E]" : isTransfer ? "text-[#3B82F6]" : "text-[#EF4444]";

  const bgClass = isIncome
    ? "bg-[var(--color-income-bg)]"
    : isTransfer
      ? "bg-[var(--color-transfer-bg)]"
      : "bg-[var(--color-expense-bg)]";

  const Icon = isIncome ? ArrowDownLeft : isTransfer ? ArrowLeftRight : ArrowUpRight;
  const sign = isIncome ? "+" : isTransfer ? "" : "-";

  const title = t.categories
    ? `${t.categories.icon ?? ""} ${t.categories.name}${t.sub_categories ? " · " + t.sub_categories.name : ""}`
    : isIncome
      ? (t.income_source_text ?? "Income")
      : isTransfer
        ? "Transfer"
        : "Expense";

  const sub = isTransfer
    ? `${t.accounts?.label ?? ""} → ${t.to_account?.label ?? ""}`
    : t.accounts
      ? [t.accounts.institution, t.accounts.label].filter(Boolean).join(" · ")
      : "";

  return (
    <div className="flex items-center gap-3 p-4 bg-card">
      <div
        className={cn(
          "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
          bgClass,
          colorClass,
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{title}</p>
        <p className="text-xs text-muted-foreground truncate">{sub}</p>
      </div>
      <div className="text-right shrink-0">
        <p className={cn("text-sm font-mono font-semibold", colorClass)}>
          {sign}
          {formatMoney(t.amount)}
        </p>
        <p className="text-[10px] text-muted-foreground font-mono">
          {formatDateTime(t.date, t.time)}
        </p>
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

  const description =
    s.description ||
    (isGroup
      ? (s.groups?.name ?? "Group split")
      : isPerson
        ? `Split w/ ${shares[0]?.person_name ?? s.people?.name ?? ""}`
        : "Split");

  const personName = s.people?.name ?? shares[0]?.person_name ?? "";
  const peopleName =
    shares.length > 2
      ? `${shares[0]?.person_name}, ${shares[1]?.person_name} +${shares.length - 2} more`
      : shares
          .map((sh: any) => sh.person_name)
          .filter(Boolean)
          .join(", ");
  const groupName = s.groups?.name ?? "Group";
  const shareCount = shares.length + 1;
  const perShare = shareCount > 0 ? total / shareCount : 0;

  return (
    <div className="bg-card" style={{ borderLeft: "3px solid #F59E0B" }}>
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium truncate flex-1">{description}</p>
          <p className="text-sm font-mono font-semibold text-[#F59E0B] shrink-0">
            {formatMoney(total)}
          </p>
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
              <p className="text-[12px] text-[#9CA3AF] truncate flex-1">
                {isGroup ? groupName : peopleName}
              </p>
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
        <p className="text-[10px] text-muted-foreground font-mono mt-0.5 text-right">
          {formatDateTime(s.date, s.time)}
        </p>
      </div>
    </div>
  );
}
