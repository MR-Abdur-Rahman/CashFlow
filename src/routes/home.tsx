import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  accountsQuery,
  transactionsQuery,
  profileQuery,
  notificationsQuery,
  peopleQuery,
  splitsQuery,
  incomingSplitsQuery,
  groupsQuery,
  categoriesQuery,
  subCategoriesQuery,
  splitBalancesQuery,
  scheduledTransactionsQuery,
} from "@/lib/queries";
import { settlementNetAfter } from "@/lib/balance";
import { isDue } from "@/lib/scheduled";
import { openScheduledPrompt } from "@/lib/scheduledPrompt";
import { formatMoney, greeting, formatDateTime } from "@/lib/format";
import { SplitDirectRow } from "@/components/SplitDirectRow";
import { useContactVisibility } from "@/hooks/useContactVisibility";
import { AccountIcon } from "@/components/AccountIcon";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Users,
  ChevronDown,
  ChevronRight,
  CalendarClock,
  Check,
  Bell,
  Trash2,
  ShieldAlert,
  Wallet,
} from "lucide-react";
import { format, startOfWeek, startOfMonth } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { UserAvatar } from "@/components/UserAvatar";
import { SwipeRow } from "@/components/SwipeRow";
import { toast } from "sonner";
import { notifyToast } from "@/lib/notify";
import { canModifySplit, deleteSplit as runSplitDelete } from "@/lib/deleteSplit";
import {
  canDeleteSettlement,
  deleteSettlement as deleteSettlementRpc,
} from "@/lib/deleteSettlement";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { SettlementEditSheet } from "@/components/SettlementEditSheet";
import { SettlementRow } from "@/components/SettlementRow";
import { settlementDirection, shareRemaining } from "@/lib/settlement";

type FilterPeriod = "today" | "week" | "month";

function getDateRange(period: FilterPeriod): { dateFrom: string; dateTo: string } {
  const today = format(new Date(), "yyyy-MM-dd");
  if (period === "today") return { dateFrom: today, dateTo: today };
  if (period === "week")
    return {
      dateFrom: format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"),
      dateTo: today,
    };
  return { dateFrom: format(startOfMonth(new Date()), "yyyy-MM-dd"), dateTo: today };
}

const PERIOD_LABELS: { key: FilterPeriod; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "Weekly" },
  { key: "month", label: "Monthly" },
];

// Show a toast for a freshly-arrived notification only if the user's toast pref for that type is on.
function showToastIfEnabled(n: any, prefs: any) {
  if (!n || !prefs) return;
  let shouldShow = false;
  switch (n.type) {
    case "split_added":
      shouldShow = !!prefs.toast_split_added;
      break;
    case "split_deleted":
      shouldShow = !!prefs.toast_split_deleted;
      break;
    case "settlement_created": {
      const m = String(n.message ?? "").toLowerCase();
      if (m.includes("bank")) shouldShow = !!prefs.toast_settlement_bank;
      else if (m.includes("wallet")) shouldShow = !!prefs.toast_settlement_ewallet;
      else shouldShow = !!prefs.toast_settlement_cash;
      break;
    }
    case "delete_attempt":
      shouldShow = !!prefs.toast_delete_attempt;
      break;
    case "account_selection":
      shouldShow = !!prefs.toast_account_selection;
      break;
    case "settlement_account_selection":
      shouldShow = !!prefs.toast_account_selection;
      break;
    case "scheduled_due":
      shouldShow = true; // recurring reminder — always surfaced
      break;
  }
  if (shouldShow) notifyToast(n.type, n.title, n.message);
}

// Colored circle icon per notification type
function getNotificationIcon(type: string) {
  switch (type) {
    case "split_added":
      return { bg: "#78350F", color: "#F59E0B", Icon: Users };
    case "split_deleted":
      return { bg: "#7F1D1D", color: "#EF4444", Icon: Trash2 };
    case "settlement_created":
      return { bg: "#064E3B", color: "#10B981", Icon: Check };
    case "delete_attempt":
      return { bg: "var(--muted)", color: "var(--muted-foreground)", Icon: ShieldAlert };
    case "account_selection":
      return { bg: "#78350F", color: "#F59E0B", Icon: Wallet };
    case "settlement_account_selection":
    case "settlement_account_needed":
      return { bg: "#064E3B", color: "#10B981", Icon: Wallet };
    case "scheduled_due":
      return { bg: "#2E1065", color: "#A78BFA", Icon: CalendarClock };
    default:
      return { bg: "var(--muted)", color: "var(--muted-foreground)", Icon: Bell };
  }
}

// Relative "time ago" label
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr > 1 ? "s" : ""} ago`;
  const day = Math.floor(hr / 24);
  if (day === 1) return "Yesterday";
  if (day < 7) return `${day} days ago`;
  return format(new Date(dateStr), "MMM d, yyyy");
}

export default function Home() {
  const navigate = useNavigate();
  const [editTxn, setEditTxn] = useState<any>(null);
  const [deleteTxn, setDeleteTxn] = useState<any>(null);
  const [editSplit, setEditSplit] = useState<any>(null);
  const [deleteSplit, setDeleteSplit] = useState<any>(null);
  const [editSettlement, setEditSettlement] = useState<any>(null);
  const [deleteHomeSettlement, setDeleteHomeSettlement] = useState<any>(null);
  const [period, setPeriod] = useState<FilterPeriod>("today");
  const [notifOpen, setNotifOpen] = useState(false);
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | undefined>();
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id));
  }, []);

  const { dateFrom, dateTo } = getDateRange(period);
  const { data: accounts = [] } = useQuery(accountsQuery());
  const { data: txns = [] } = useQuery(transactionsQuery({ dateFrom, dateTo }));
  const { data: ownSplits = [] } = useQuery(splitsQuery());
  const { data: incomingSplits = [] } = useQuery(incomingSplitsQuery());
  // Full split set (shared cache) for each settlement row's running net.
  const { data: balanceData } = useQuery(splitBalancesQuery());
  const netSplits = balanceData?.splits ?? [];
  const netSettlements = balanceData?.settlements ?? [];
  const netMeId = balanceData?.currentUserId ?? null;
  const netMyPids = balanceData?.myPersonIds ?? [];

  const { data: homeSettlements = [] } = useQuery({
    queryKey: ["settlements", "home", dateFrom, dateTo],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      // No created_by filter — RLS returns every settlement that involves me (ones I recorded,
      // ones on splits I created, or ones on my shares), so receiver-side settlements show too.
      const { data, error } = await supabase
        .from("settlements")
        .select(
          "*, person:person_id(name, nickname, avatar_url, linked:linked_user_id(full_name, avatar_url)), creator:created_by(full_name, avatar_url), split_shares:split_share_id(person_name, share_amount, person:people(linked_user_id)), splits:split_id(paid_by, created_by, creator:created_by(full_name), paid_by_person:paid_by_person_id(linked_user_id, name))",
        )
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
      .filter((s) => s.date >= dateFrom && s.date <= dateTo)
      .sort((a, b) =>
        a.date !== b.date
          ? b.date.localeCompare(a.date)
          : (b.time || "").localeCompare(a.time || ""),
      );
  }, [ownSplits, incomingSplits, dateFrom, dateTo]);

  const vis = useContactVisibility();
  // Unified activity feed (transactions + splits + settlements), narrowed by the History-style
  // type chip. "income/expense/transfer" → transactions only; "split"/"settlement" → those only.
  const feedItems = useMemo(() => {
    const txnItems = (txns as any[])
      .filter((t) => !t.is_split)
      .map((t) => ({
        ...t,
        _itemType: "txn" as const,
        _sortKey: (t.created_at ?? `${t.date}T${t.time ?? "00:00"}`) as string,
      }));

    const splitItems = allSplitsForTab.map((s: any) => ({
      ...s,
      _itemType: "split" as const,
      _sortKey: s.created_at ?? `${s.date}T${s.time ?? "00:00"}`,
    }));

    const settlementItems = (homeSettlements as any[]).map((s) => {
      const { iPaid, otherName, otherAvatar } = settlementDirection(s, userId, undefined, vis);
      const { remaining, fullySettled } = shareRemaining(s, homeSettlements as any[]);
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
  }, [
    txns,
    allSplitsForTab,
    homeSettlements,
    userId,
    netSplits,
    netSettlements,
    netMeId,
    netMyPids,
    vis,
  ]);

  const { data: profile } = useQuery(profileQuery(userId));
  const { data: scheduledList = [] } = useQuery(scheduledTransactionsQuery());
  const scheduledDueCount = (scheduledList as any[]).filter((s) => isDue(s)).length;
  // Map a linked user's id → the viewer's own contact row id, so an incoming split's avatar can
  // open the right Person detail page.
  const { data: homePeople = [] } = useQuery(peopleQuery());
  const peopleByLinkedUid = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of homePeople as any[]) if (p.linked_user_id) m.set(p.linked_user_id, p.id);
    return m;
  }, [homePeople]);

  // Where a split-row avatar navigates: group split → Group detail; 1-to-1 person split → Person
  // detail (own uses person_id; incoming resolves the viewer's contact for the creator). Multi-person
  // splits have no single target.
  function splitAvatarPath(item: any): string | null {
    const shares = (item.split_shares ?? []) as any[];
    if (item.type === "group") return item.group_id ? `/split/group/${item.group_id}` : null;
    if (shares.length > 1) return null;
    if (item._isIncoming) {
      const pid = peopleByLinkedUid.get(item.created_by);
      return pid ? `/split/person/${pid}` : null;
    }
    const pid = item.person_id ?? shares[0]?.person_id ?? null;
    return pid ? `/split/person/${pid}` : null;
  }
  const { data: notifications = [] } = useQuery(notificationsQuery());
  const unreadCount = (notifications as any[]).filter((n: any) => !n.is_read).length;

  // Per-user toast preferences (which notification types pop a toast)
  const { data: toastPrefs } = useQuery({
    queryKey: ["toast-preferences", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return null;
      const { data } = await (supabase as any)
        .from("notification_preferences")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      return data;
    },
  });
  const toastPrefsRef = useRef<any>(null);
  useEffect(() => {
    toastPrefsRef.current = toastPrefs;
  }, [toastPrefs]);

  // Real-time: refresh badge/list + relevant data, and toast on new notifications.
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload: any) => {
          const n = payload.new;
          qc.invalidateQueries({ queryKey: ["notifications"] });
          if (n?.type === "split_added" || n?.type === "split_deleted") {
            qc.invalidateQueries({ queryKey: ["splits"] }); // covers split-balances & person-splits (["splits", ...])
            qc.invalidateQueries({ queryKey: ["transactions"] });
            qc.invalidateQueries({ queryKey: ["accounts"] });
          }
          if (n?.type === "settlement_created") {
            qc.invalidateQueries({ queryKey: ["settlements"] });
            qc.invalidateQueries({ queryKey: ["splits"] });
            qc.invalidateQueries({ queryKey: ["accounts"] });
          }
          showToastIfEnabled(n, toastPrefsRef.current);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, qc]);

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
              <span
                className="absolute top-0.5 right-0.5 h-[18px] min-w-[18px] rounded-full text-white text-[10px] font-bold flex items-center justify-center px-1 leading-none"
                style={{ background: "#EF4444" }}
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
          <Link to="/settings/account" aria-label="Profile">
            <UserAvatar url={profile?.avatar_url} name={profile?.full_name} size={40} />
          </Link>
        </div>
      </div>

      {/* Scheduled transactions due — reopens the confirm/skip prompt */}
      {scheduledDueCount > 0 && (
        <button
          type="button"
          onClick={openScheduledPrompt}
          className="flex w-full items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-left"
        >
          <CalendarClock className="h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">
              {scheduledDueCount} scheduled transaction{scheduledDueCount > 1 ? "s" : ""} due
            </p>
            <p className="text-xs text-muted-foreground">Tap to review and confirm</p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      )}

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
        {/* py-2/-my-2: give the horizontal scroller vertical room so the cards' shadow isn't clipped
            by overflow-x-auto (which forces overflow-y to clip); the negative margin cancels it so
            layout/spacing is unchanged. */}
        <div className="flex gap-3 overflow-x-auto py-2 -my-2 -mx-4 px-4 snap-x snap-mandatory">
          {accounts.map((a) => (
            <Link
              to={`/accounts/${a.id}`}
              key={a.id}
              className="shrink-0 w-40 h-[124px] rounded-xl border border-border bg-card p-3 snap-start flex flex-col active:opacity-80 shadow-sm"
            >
              <AccountIcon
                iconType={a.icon_type}
                iconName={a.icon_name}
                iconColor={a.icon_color}
                iconUrl={a.icon_url}
                size={44}
                className="shadow-md"
              />
              <p className="text-xs text-muted-foreground mt-2.5 truncate">
                {[a.institution, a.label].filter(Boolean).join(" · ") || a.label}
              </p>
              <p className="font-mono text-base font-semibold text-foreground mt-0.5 truncate">
                {formatMoney(a.current_balance)}
              </p>
            </Link>
          ))}
          {accounts.length === 0 && (
            <p className="text-sm text-muted-foreground py-4">No accounts yet</p>
          )}
        </div>
      </div>

      {/* Transactions Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground px-1">
            Transactions
          </p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 bg-primary text-white text-sm font-medium px-4 py-1.5 rounded-xl">
                {currentLabel} <ChevronDown className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {PERIOD_LABELS.map(({ key, label }) => (
                <DropdownMenuItem
                  key={key}
                  onClick={() => setPeriod(key)}
                  className={cn("text-base py-3", period === key && "text-primary font-medium")}
                >
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
          {feedItems.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10 px-4">
              {emptyMessages[period]}
            </p>
          ) : (
            <div className="divide-y divide-border">
              {feedItems.map((item: any) =>
                item._itemType === "settlement" ? (
                  <SwipeRow
                    key={`set-${item.id}`}
                    onEdit={() => setEditSettlement(item)}
                    onDelete={() => setDeleteHomeSettlement(item)}
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
                    key={item.id}
                    onEdit={() => setEditSplit(item)}
                    onDelete={() => setDeleteSplit(item)}
                    canEdit={canModifySplit(item)}
                    canDelete={canModifySplit(item)}
                    editDeniedMessage="Only the creator or payer can edit this split"
                    deleteDeniedMessage="Only the creator or payer can delete this split"
                  >
                    <SplitDirectRow
                      s={item}
                      onAvatarClick={
                        splitAvatarPath(item)
                          ? () => navigate(splitAvatarPath(item)!)
                          : undefined
                      }
                    />
                  </SwipeRow>
                ) : (
                  <SwipeRow
                    key={item.id}
                    onEdit={() => setEditTxn(item)}
                    onDelete={() => setDeleteTxn(item)}
                  >
                    <TxRowInner t={item} />
                  </SwipeRow>
                ),
              )}
            </div>
          )}
        </div>
      </div>

      <NotificationSheet
        open={notifOpen}
        onOpenChange={setNotifOpen}
        notifications={notifications as any[]}
        userId={userId}
        onNavigate={(path) => {
          setNotifOpen(false);
          navigate(path);
        }}
      />

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
              className="bg-destructive text-white"
              onClick={async () => {
                if (!deleteTxn) return;
                const { error } = await supabase
                  .from("transactions")
                  .delete()
                  .eq("id", deleteTxn.id);
                if (error) toast.error(error.message);
                else {
                  toast.success("Deleted");
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

      {editSplit && (
        <EditSplitSheet
          split={editSplit}
          open={!!editSplit}
          onOpenChange={(o) => {
            if (!o) setEditSplit(null);
          }}
        />
      )}

      <AlertDialog
        open={!!deleteSplit}
        onOpenChange={(o) => {
          if (!o) setDeleteSplit(null);
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
              className="bg-destructive text-white"
              onClick={async () => {
                if (!deleteSplit) return;
                await runSplitDelete(deleteSplit.id, qc);
                setDeleteSplit(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
        open={!!deleteHomeSettlement}
        onOpenChange={(o) => {
          if (!o) setDeleteHomeSettlement(null);
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
              className="bg-destructive text-white"
              onClick={async () => {
                if (!deleteHomeSettlement) return;
                await deleteSettlementRpc(deleteHomeSettlement.id, qc);
                setDeleteHomeSettlement(null);
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

function TxRowInner({ t }: { t: any }) {
  if (t.is_split) return <SplitRowContent t={t} />;

  const isIncome = t.type === "income";
  const isExpense = t.type === "expense";
  const isTransfer = t.type === "transfer";

  const colorClass = isIncome ? "text-income" : isExpense ? "text-expense" : "text-transfer";
  const bgClass = isIncome
    ? "bg-[var(--color-income-bg)]"
    : isExpense
      ? "bg-[var(--color-expense-bg)]"
      : "bg-[var(--color-transfer-bg)]";
  const Icon = isIncome ? ArrowDownLeft : isExpense ? ArrowUpRight : ArrowLeftRight;
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
        className={`h-10 w-10 rounded-full flex items-center justify-center ${bgClass} ${colorClass}`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{title}</p>
        <p className="text-xs text-muted-foreground truncate">{sub}</p>
      </div>
      <div className="text-right">
        <p className={`text-sm font-mono font-semibold ${colorClass}`}>
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

function SplitRowContent({ t }: { t: any }) {
  const s = t.split;

  // Fallback if split data not joined
  if (!s) {
    return (
      <div
        className="flex items-center gap-3 p-4 bg-card"
        style={{ borderLeft: "3px solid var(--split)" }}
      >
        <div className="h-10 w-10 rounded-full flex items-center justify-center bg-[var(--color-split-bg)] text-split shrink-0">
          <Users className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Split expense</p>
        </div>
        <p className="text-sm font-mono font-semibold text-split">-{formatMoney(t.amount)}</p>
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
    <div className="bg-card" style={{ borderLeft: "3px solid var(--split)" }}>
      <div className="px-4 py-3">
        {/* Line 1: description + total */}
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium truncate flex-1">{description}</p>
          <p className="text-sm font-mono font-semibold text-split shrink-0">
            {formatMoney(total)}
          </p>
        </div>

        {/* Person split: 2 lines */}
        {isPerson && (
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <p className="text-[12px] text-muted-foreground truncate flex-1">{personName}</p>
            <div className="text-right shrink-0">
              {isMePaid ? (
                <p className="text-[12px] font-mono font-semibold text-settled">
                  You lent {formatMoney(totalShares)}
                </p>
              ) : (
                <p className="text-[12px] font-mono font-semibold text-split">
                  You owe {formatMoney(myShare)}
                </p>
              )}
            </div>
          </div>
        )}

        {/* People / Group split: 3 lines */}
        {(isMulti || isGroup) && (
          <>
            <div className="flex items-center justify-between gap-2 mt-0.5">
              <p className="text-[12px] text-muted-foreground truncate flex-1">
                {isGroup ? groupName : peopleName}
              </p>
              <p className="text-[12px] font-mono text-muted-foreground shrink-0">
                {isMePaid ? `${shares.length} × ${formatMoney(perShare)}` : formatMoney(perShare)}
              </p>
            </div>
            <div className="flex items-center justify-between gap-2 mt-0.5">
              <p className="text-[12px] text-muted-foreground">
                {isMePaid ? "Paid by You" : `Paid by ${s.paid_by}`}
              </p>
              <p
                className={`text-[12px] font-mono font-semibold shrink-0 ${isMePaid ? "text-settled" : "text-split"}`}
              >
                {isMePaid
                  ? `You lent ${formatMoney(totalShares)}`
                  : `You owe ${formatMoney(myShare > 0 ? myShare : perShare)}`}
              </p>
            </div>
          </>
        )}

        {/* Time */}
        <p className="text-[10px] text-muted-foreground font-mono mt-0.5 text-right">
          {formatDateTime(t.date, t.time)}
        </p>
      </div>
    </div>
  );
}

function EditMultiPickerSheet({
  open,
  onOpenChange,
  selected,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  selected: { id: string; name: string }[];
  onConfirm: (people: { id: string; name: string }[]) => void;
}) {
  const { data: people = [] } = useQuery(peopleQuery());
  const [checked, setChecked] = useState<Set<string>>(new Set(selected.map((p) => p.id)));

  useEffect(() => {
    if (open) setChecked(new Set(selected.map((p) => p.id)));
  }, [open]);

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function confirm() {
    const result = (people as any[])
      .filter((p) => checked.has(p.id))
      .map((p) => ({ id: p.id, name: p.name }));
    onConfirm(result);
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="bg-card border-border rounded-t-3xl p-0 h-[75dvh] flex flex-col"
      >
        <SheetTitle className="sr-only">Select People</SheetTitle>
        <div className="px-5 pt-5 pb-3 border-b border-border shrink-0">
          <span className="text-base font-semibold">Select People</span>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {(people as any[]).length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-10">No people yet.</p>
          )}
          {(people as any[]).map((p) => (
            <div
              key={p.id}
              onClick={() => toggle(p.id)}
              className="flex items-center gap-3 px-5 py-4 bg-card active:bg-secondary/40 cursor-pointer"
            >
              <div
                className={cn(
                  "h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                  checked.has(p.id) ? "bg-primary border-primary" : "border-border",
                )}
              >
                {checked.has(p.id) && <Check className="h-3 w-3 text-white" />}
              </div>
              <p className="text-sm font-medium flex-1">{p.name}</p>
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-border shrink-0">
          <Button
            className="w-full bg-primary text-white"
            onClick={confirm}
            disabled={checked.size === 0}
          >
            Confirm ({checked.size} selected)
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function EditSplitSheet({
  split,
  open,
  onOpenChange,
}: {
  split: any;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();

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

  const [splitType, setSplitType] = useState<"equal" | "custom">(
    split.split_type === "custom" ? "custom" : "equal",
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
    supabase
      .from("transactions")
      .select("note")
      .eq("split_id", split.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.note) setNote(String(data.note).replace(/^Split: /, ""));
      });
  }, [split.id]);

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
      return (g?.group_members ?? []).map((m: any) => ({
        id: m.person_id as string,
        name: (m.people?.name ?? "?") as string,
      }));
    }
    return [];
  }, [target, personId, people, multiPeople, groupId, groups]);

  const total = Number(amount);
  const equalShare = participants.length > 0 ? total / (participants.length + 1) : 0;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!total || total <= 0) throw new Error("Enter a valid amount");
      if (!description.trim()) throw new Error("Please enter a description");
      if (target === "group" && !groupId) throw new Error("Select a group");
      if (target !== "group" && participants.length === 0)
        throw new Error("Select at least one person");

      const shares = participants.map((p) => ({
        person_id: p.id || null,
        person_name: p.name,
        share_amount: splitType === "custom" ? (customAmounts[p.id] ?? 0) : equalShare,
      }));

      // All writes go through the update_split RPC (SECURITY DEFINER): it enforces
      // creator-or-payer permission, reconciles shares WITHOUT duplicating on a payer
      // edit (split_shares RLS lets anyone INSERT but only the creator DELETE), and
      // syncs the linked expense transaction so the balance trigger auto-adjusts the
      // payer's account by the amount delta. Who-paid and account are LOCKED server-side.
      const { error } = await supabase.rpc("update_split", {
        p_split_id: split.id,
        p_total_amount: total,
        p_description: description.trim(),
        p_type: target === "group" ? "group" : "individual",
        p_person_id: target === "person" ? personId || null : null,
        p_group_id: target === "group" ? groupId || null : null,
        p_split_type: splitType,
        p_category_id: categoryId || null,
        p_sub_category_id: subCatId || null,
        p_date: date,
        p_time: time,
        p_shares: shares,
      });
      if (error) throw error;

      // Best-effort: keep the linked transaction's note in sync. RLS makes this a
      // silent no-op for a payer editing the creator's transaction.
      await supabase
        .from("transactions")
        .update({ note: note.trim() ? `Split: ${note.trim()}` : null })
        .eq("split_id", split.id);
    },
    onSuccess: () => {
      notifyToast("split_added", "Split updated");
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
        <SheetContent
          side="bottom"
          className="bg-card border-border rounded-t-3xl p-0 h-[88dvh] flex flex-col"
        >
          <SheetTitle className="sr-only">Edit split</SheetTitle>
          <div className="px-5 pt-5 pb-3 border-b border-border shrink-0">
            <span className="text-base font-semibold">Edit Split</span>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {/* Amount */}
            <div className="text-center py-2">
              <input
                inputMode="decimal"
                value={amount}
                placeholder="0.00"
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                className="w-full bg-transparent text-center text-5xl font-mono font-semibold outline-none text-split"
              />
              <p className="text-xs text-muted-foreground mt-1 font-mono">LKR</p>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label>Description</Label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Dinner, Groceries, Trip"
                className="w-full text-sm text-foreground placeholder:text-muted-foreground outline-none px-3 py-2.5 bg-secondary border border-border rounded-lg"
              />
            </div>

            {/* Split with */}
            <div className="space-y-1.5">
              <Label>Split with</Label>
              <div className="flex gap-2 rounded-lg bg-secondary p-1">
                {(["person", "multi", "group"] as const).map((m) => (
                  <button
                    type="button"
                    key={m}
                    onClick={() => setTarget(m)}
                    className={cn(
                      "flex-1 rounded-md py-1.5 text-xs font-medium capitalize",
                      target === m && "bg-primary text-white",
                    )}
                  >
                    {m === "multi" ? "People" : m}
                  </button>
                ))}
              </div>
              {target === "person" && (
                <Select value={personId} onValueChange={setPersonId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select person" />
                  </SelectTrigger>
                  <SelectContent>
                    {(people as any[]).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {target === "multi" && (
                <button
                  type="button"
                  onClick={() => setMultiPickerOpen(true)}
                  className="w-full flex items-center justify-between px-3 py-2.5 bg-secondary rounded-lg text-sm"
                >
                  <span
                    className={multiPeople.length > 0 ? "text-foreground" : "text-muted-foreground"}
                  >
                    {multiPeople.length > 0
                      ? multiPeople.map((p) => p.name).join(", ")
                      : "Select people"}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
              {target === "group" && (
                <Select value={groupId} onValueChange={setGroupId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select group" />
                  </SelectTrigger>
                  <SelectContent>
                    {(groups as any[]).map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Who paid — LOCKED after creation (read-only). Change requires delete + recreate. */}
            <div className="space-y-1.5">
              <Label>Who paid?</Label>
              <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-secondary/60">
                <span className="text-sm text-muted-foreground">
                  {split.paid_by === "me" ? "You paid" : `${split.paid_by ?? "Someone"} paid`}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Locked
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground px-1">
                Who paid can't be changed after creation — delete and recreate if it's wrong.
              </p>
            </div>

            {/* Split type */}
            <div className="space-y-1.5">
              <Label>Split type</Label>
              <div className="flex gap-2 rounded-lg bg-secondary p-1">
                {(["equal", "custom"] as const).map((m) => (
                  <button
                    type="button"
                    key={m}
                    onClick={() => setSplitType(m)}
                    className={cn(
                      "flex-1 rounded-md py-1.5 text-sm capitalize",
                      splitType === m && "bg-primary text-white",
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
              {splitType === "equal" && participants.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Each person pays: {formatMoney(equalShare)}
                </p>
              )}
              {splitType === "custom" && participants.length > 0 && (
                <div className="space-y-2 mt-1">
                  {participants.map((p) => (
                    <div key={p.id} className="flex items-center gap-3">
                      <span className="text-sm flex-1 truncate">{p.name}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-xs text-muted-foreground font-mono">LKR</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          placeholder="0.00"
                          value={customAmounts[p.id] ?? ""}
                          onChange={(e) =>
                            setCustomAmounts((prev) => ({
                              ...prev,
                              [p.id]: Number(e.target.value) || 0,
                            }))
                          }
                          className="w-28 bg-secondary rounded-md px-2 py-1.5 text-sm text-right font-mono outline-none border border-border focus:border-primary"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={categoryId || "none"}
                onValueChange={(v) => {
                  setCategoryId(v === "none" ? "" : v);
                  setSubCatId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category (optional)">
                    {categoryId ? (catDisplay ?? "Category") : "Select category (optional)"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {(cats as any[]).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.icon} {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {categoryId && (subs as any[]).length > 0 && (
                <Select
                  value={subCatId || "none"}
                  onValueChange={(v) => setSubCatId(v === "none" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sub-category (optional)">
                      {subCatId ? (subDisplay ?? "Sub-category") : "Sub-category (optional)"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {(subs as any[]).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Time</Label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground outline-none"
                />
              </div>
            </div>

            {/* Note */}
            <div className="space-y-1.5">
              <Label>Note</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Optional note"
              />
            </div>
          </div>

          <div className="p-4 pt-2 border-t border-border bg-card shrink-0">
            <Button
              className="w-full text-white font-medium"
              style={{ background: "#78350F" }}
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <EditMultiPickerSheet
        open={multiPickerOpen}
        onOpenChange={setMultiPickerOpen}
        selected={multiPeople}
        onConfirm={setMultiPeople}
      />
    </>
  );
}

export function EditTxSheet({
  txn,
  open,
  onOpenChange,
}: {
  txn: any;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
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
  const [sourceType, setSourceType] = useState<"person" | "source">(
    txn.income_source_type ?? "source",
  );
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
      const { data, error } = await supabase
        .from("sub_categories")
        .select("*")
        .eq("category_id", categoryId)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!categoryId,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("transactions")
        .update({
          amount: Number(amount),
          account_id: accountId || null,
          to_account_id: txn.type === "transfer" && toAccountId ? toAccountId : undefined,
          category_id: categoryId || null,
          sub_category_id: subCatId || null,
          note: note || null,
          date,
          time,
          ...(txn.type === "income"
            ? {
                income_source_type: sourceType,
                income_person_id: sourceType === "person" && personId ? personId : null,
                income_source_text: sourceType === "source" ? sourceText : null,
              }
            : {}),
        })
        .eq("id", txn.id);
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
      <SheetContent
        side="bottom"
        className="bg-card border-border rounded-t-3xl p-0 h-[80dvh] flex flex-col"
      >
        <SheetTitle className="sr-only">Edit transaction</SheetTitle>
        <div className="px-5 pt-5 pb-3 border-b border-border">
          <span className="capitalize text-base font-semibold">
            {txn.is_split ? "Split" : txn.type} — Edit
          </span>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="text-center py-2">
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
              className="w-full bg-transparent text-center text-5xl font-mono font-semibold outline-none text-foreground"
            />
            <p className="text-xs text-muted-foreground mt-1 font-mono">LKR</p>
          </div>

          <div className="space-y-1.5">
            <Label>{txn.type === "transfer" ? "From account" : "Account"}</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {(accounts as any[]).map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {[a.institution, a.label].filter(Boolean).join(" · ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {txn.type === "income" && (
            <div className="space-y-1.5">
              <Label>From</Label>
              <div className="flex gap-2 rounded-lg bg-secondary p-1">
                {(["person", "source"] as const).map((m) => (
                  <button
                    type="button"
                    key={m}
                    onClick={() => setSourceType(m)}
                    className={cn(
                      "flex-1 rounded-md py-1.5 text-sm capitalize",
                      sourceType === m && "bg-primary text-white",
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
              {sourceType === "person" && (
                <Select value={personId} onValueChange={setPersonId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select person" />
                  </SelectTrigger>
                  <SelectContent>
                    {(people as any[]).map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
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
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {(accounts as any[]).map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {[a.institution, a.label].filter(Boolean).join(" · ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {(txn.type === "expense" || txn.is_split) && (
            <>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select
                  value={categoryId}
                  onValueChange={(v) => {
                    setCategoryId(v);
                    setSubCatId("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {(cats as any[]).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.icon} {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {categoryId && subs.length > 0 && (
                <div className="space-y-1.5">
                  <Label>Sub-category</Label>
                  <Select value={subCatId} onValueChange={setSubCatId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select sub-category" />
                    </SelectTrigger>
                    <SelectContent>
                      {(subs as any[]).map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
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
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Time</Label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground outline-none"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Note</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>
        </div>
        <div className="p-4 pt-2 border-t border-border bg-card">
          <Button
            className="w-full bg-primary text-white"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function NotificationSheet({
  open,
  onOpenChange,
  notifications,
  onNavigate,
  userId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  notifications: any[];
  onNavigate: (path: string) => void;
  userId?: string;
}) {
  const qc = useQueryClient();
  const recent = notifications.slice(0, 10);

  async function markAllRead() {
    if (!userId) return;
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  async function handleTap(n: any) {
    await supabase.from("notifications").update({ is_read: true }).eq("id", n.id);
    qc.invalidateQueries({ queryKey: ["notifications"] });
    onOpenChange(false);

    // Account selection (split payer, or settlement receiver) → Split page Pending tab.
    // settlement_account_needed is the legacy type, now routed to Pending too.
    if (
      n.type === "account_selection" ||
      n.type === "settlement_account_selection" ||
      n.type === "settlement_account_needed"
    ) {
      onNavigate("/split?tab=pending");
      return;
    }

    if (n.type === "scheduled_due") {
      onNavigate("/settings/scheduled");
      return;
    }

    // split_added / settlement_created → navigate to the counterpart person's detail page.
    // notifications has related_split_id (not from_user_id), so resolve via the split's creator.
    if (
      (n.type === "split_added" || n.type === "settlement_created") &&
      n.related_split_id &&
      userId
    ) {
      const { data: split } = await supabase
        .from("splits")
        .select("created_by")
        .eq("id", n.related_split_id)
        .maybeSingle();
      if (split?.created_by) {
        const { data: person } = await supabase
          .from("people")
          .select("id")
          .eq("user_id", userId)
          .eq("linked_user_id", split.created_by)
          .maybeSingle();
        if (person) onNavigate(`/split/person/${person.id}`);
      }
    }
    // split_deleted, delete_attempt → just mark as read, no navigation
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="border-0 p-0 max-h-[75dvh] flex flex-col"
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "12px 12px 0 0",
        }}
      >
        <SheetTitle className="sr-only">Notifications</SheetTitle>

        {/* Header */}
        <div
          className="flex items-center justify-between"
          style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}
        >
          <span className="font-semibold text-foreground">Notifications</span>
          <button
            type="button"
            onClick={markAllRead}
            className="text-sm font-medium"
            style={{ color: "var(--primary)" }}
          >
            Mark all read
          </button>
        </div>

        {/* List (max 10, scrollable to 400px) */}
        <div className="overflow-y-auto" style={{ maxHeight: 400 }}>
          {recent.length === 0 ? (
            <p
              className="text-center"
              style={{ color: "var(--muted-foreground)", padding: 40, fontSize: 14 }}
            >
              No notifications yet
            </p>
          ) : (
            recent.map((n: any) => {
              const { bg, color, Icon } = getNotificationIcon(n.type);
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleTap(n)}
                  className="w-full flex items-start text-left transition-colors hover:bg-secondary active:bg-secondary"
                  style={{ gap: 12, padding: "12px 16px", borderBottom: "1px solid var(--border)" }}
                >
                  <div
                    className="shrink-0 rounded-full flex items-center justify-center"
                    style={{ width: 36, height: 36, background: bg }}
                  >
                    <Icon style={{ width: 18, height: 18, color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground font-medium text-sm">{n.title}</p>
                    <p
                      className="text-[13px] mt-0.5 line-clamp-2"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {n.message}
                    </p>
                    <p className="text-[11px] mt-1" style={{ color: "var(--muted-foreground)" }}>
                      {timeAgo(n.created_at)}
                    </p>
                  </div>
                  {!n.is_read && (
                    <span
                      className="shrink-0 mt-1.5 rounded-full"
                      style={{ width: 8, height: 8, background: "#3B82F6" }}
                    />
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <button
          type="button"
          onClick={() => {
            onOpenChange(false);
            onNavigate("/settings/notifications/history");
          }}
          className="text-center text-sm font-medium"
          style={{
            padding: "12px 16px",
            borderTop: "1px solid var(--border)",
            color: "var(--primary)",
          }}
        >
          View all
        </button>
      </SheetContent>
    </Sheet>
  );
}
