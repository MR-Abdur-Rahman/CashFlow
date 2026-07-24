import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { accountQuery, transactionsQuery, splitBalancesQuery } from "@/lib/queries";
import { settlementNetAfter } from "@/lib/balance";
import { AccountIcon } from "@/components/AccountIcon";
import { UserAvatar } from "@/components/UserAvatar";
import { splitRowAvatar } from "@/lib/people";
import { formatMoney, formatDateTime } from "@/lib/format";
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
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Users,
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
} from "@/components/ui/alert-dialog";
import { useNavigate, useParams } from "react-router-dom";
import { useBack } from "@/lib/navBack";
import { EditSplitSheet, EditTxSheet } from "@/routes/home";
import { SettlementEditSheet } from "@/components/SettlementEditSheet";
import { SettlementRow } from "@/components/SettlementRow";
import { settlementDirection, shareRemaining } from "@/lib/settlement";
import { useContactVisibility } from "@/hooks/useContactVisibility";
import { format } from "date-fns";
import {
  type Period,
  PERIODS,
  periodLabel,
  getPeriodRange,
  navigateAnchor,
  formatAnchorLabel,
} from "@/lib/period";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// ─── Main Page ─────────────────────────────────────────────────────────────
export default function AccountDetail() {
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();
  const goBack = useBack();
  const qc = useQueryClient();
  const { data: account } = useQuery(accountQuery(accountId!));
  const [period, setPeriod] = useState<Period>("monthly");
  const [anchor, setAnchor] = useState(new Date());
  const [edit, setEdit] = useState(false);
  const [editTxn, setEditTxn] = useState<any | null>(null);
  const [deleteTxn, setDeleteTxn] = useState<any | null>(null);
  const [editSplit, setEditSplit] = useState<any | null>(null);
  const [deleteSplitItem, setDeleteSplitItem] = useState<any | null>(null);
  const [deleteSettlement, setDeleteSettlement] = useState<any | null>(null);
  const [editSettlement, setEditSettlement] = useState<any | null>(null);
  const [userId, setUserId] = useState<string | undefined>();
  const vis = useContactVisibility();
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id));
  }, []);

  const { dateFrom, dateTo } = useMemo(() => {
    const { from, to } = getPeriodRange(period, anchor);
    return { dateFrom: format(from, "yyyy-MM-dd"), dateTo: format(to, "yyyy-MM-dd") };
  }, [period, anchor]);

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
        .select(
          "*, split_shares(*, person:people(id, name, nickname, avatar_url, linked:linked_user_id(id, full_name, avatar_url))), groups:group_id(name, avatar_url), people:person_id(name, nickname, avatar_url, linked:linked_user_id(id, full_name, avatar_url))",
        )
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
          "*, person:person_id(name, nickname, avatar_url, linked:linked_user_id(id, full_name, avatar_url)), creator:created_by(full_name, avatar_url), split_shares:split_share_id(person_name, share_amount, person:people(linked_user_id)), splits:split_id(paid_by, created_by, creator:created_by(full_name), paid_by_person:paid_by_person_id(linked_user_id, name)), accounts:account_id(label, institution)",
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

  // Unified activity feed for this account (transactions + splits + settlements), narrowed by the
  // History-style type chip.
  const feedItems = useMemo(() => {
    const txnItems = (txns as any[])
      .filter((t) => !t.is_split)
      .map((t) => ({
        ...t,
        _itemType: "txn" as const,
        _sortKey: (t.created_at ?? `${t.date}T${t.time ?? "00:00"}`) as string,
      }));
    const splitItems = (splits as any[]).map((s) => ({
      ...s,
      _itemType: "split" as const,
      _sortKey: s.created_at ?? `${s.date}T${s.time ?? "00:00"}`,
    }));
    const settlementItems = (settlements as any[]).map((s) => {
      const { iPaid, otherName, otherAvatar } = settlementDirection(s, userId, undefined, vis);
      const { remaining, fullySettled } = shareRemaining(s, settlements as any[]);
      return {
        ...s,
        _itemType: "settlement" as const,
        _sortKey: (s.created_at ?? "") as string,
        _iPaid: iPaid,
        _otherName: otherName,
        _otherAvatar: otherAvatar,
        _remaining: remaining,
        _fullySettled: fullySettled,
        _netAfter:
          settlementNetAfter(netSplits, netSettlements, s, netMeId, netMyPids) ?? undefined,
      };
    });
    return [...txnItems, ...splitItems, ...settlementItems].sort((a, b) =>
      b._sortKey.localeCompare(a._sortKey),
    );
  }, [txns, splits, settlements, userId, netSplits, netSettlements, netMeId, netMyPids, vis]);

  // Delete handler kept for future re-wiring; its trigger button was removed from the UI.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  return (
    <div className="px-4 pt-4 pb-24 space-y-4">
      {/* Back */}
      <button
        onClick={goBack}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

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
              <button className="flex items-center gap-1.5 bg-primary text-white text-sm font-medium px-3 py-1.5 rounded-xl capitalize">
                {periodLabel(period)}
                <ChevronDown className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              {PERIODS.map((p) => (
                <DropdownMenuItem
                  key={p}
                  onClick={() => {
                    setPeriod(p);
                    setAnchor(new Date());
                  }}
                  className={cn(
                    "capitalize py-3 text-base",
                    period === p && "text-primary font-medium",
                  )}
                >
                  {periodLabel(p)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden border border-border divide-y divide-border">
        {feedItems.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nothing this period</p>
        ) : (
          feedItems.map((item: any) =>
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
                  avatarUrl={item._otherAvatar}
                  amount={Number(item.amount)}
                  remaining={item._remaining}
                  fullySettled={item._fullySettled}
                  netAfter={item._netAfter}
                  createdAt={item.created_at}
                />
              </SwipeRow>
            ) : item._itemType === "split" ? (
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
            ) : (
              <SwipeRow
                key={item.id}
                onEdit={() => setEditTxn(item)}
                onDelete={() => setDeleteTxn(item)}
              >
                <TxRow t={item} />
              </SwipeRow>
            ),
          )
        )}
      </div>

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

  const colorClass = isIncome ? "text-income" : isTransfer ? "text-transfer" : "text-expense";

  const bgClass = isIncome
    ? "bg-[var(--color-income-bg)]"
    : isTransfer
      ? "bg-[var(--color-transfer-bg)]"
      : "bg-[var(--color-expense-bg)]";

  const Icon = isIncome ? ArrowDownLeft : isTransfer ? ArrowLeftRight : ArrowUpRight;
  const sign = isIncome ? "+" : isTransfer ? "" : "-";

  const title = t.categories
    ? `${t.sub_categories?.icon ?? t.categories.icon ?? ""} ${t.categories.name}${t.sub_categories ? " · " + t.sub_categories.name : ""}`
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
  const vis = useContactVisibility();
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
  // Resolver-driven name + avatar — respects profile visibility (hidden → local name / blank avatar).
  const rowAv = splitRowAvatar(s, vis);
  const personName = rowAv.name;

  return (
    <div className="bg-card">
      <div className="px-4 py-3 flex gap-3">
        {rowAv.kind === "people" ? (
          <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0">
            <Users className="h-5 w-5" />
          </div>
        ) : (
          <UserAvatar url={rowAv.url} name={rowAv.name} size={40} className="shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium truncate flex-1">{description}</p>
            <p className="text-sm font-mono font-semibold text-split shrink-0">
              {formatMoney(total)}
            </p>
          </div>
          {isPerson && (
            <div className="flex items-center justify-between gap-2 mt-0.5">
              <p className="text-[12px] text-muted-foreground truncate flex-1">{personName}</p>
              <p className="text-[12px] font-mono font-semibold text-settled shrink-0">
                You lent {formatMoney(totalShares)}
              </p>
            </div>
          )}
          {(isMulti || isGroup) && (
            <>
              <div className="flex items-center justify-between gap-2 mt-0.5">
                <p className="text-[12px] text-muted-foreground truncate flex-1">
                  {isGroup ? groupName : peopleName}
                </p>
                <p className="text-[12px] font-mono text-muted-foreground shrink-0">
                  {shares.length} × {formatMoney(perShare)}
                </p>
              </div>
              <div className="flex items-center justify-between gap-2 mt-0.5">
                <p className="text-[12px] text-muted-foreground">Paid by You</p>
                <p className="text-[12px] font-mono font-semibold text-settled shrink-0">
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
    </div>
  );
}
