import { useQuery, useQueryClient } from "@tanstack/react-query";
import { transactionsQuery, peopleQuery } from "@/lib/queries";
import { formatMoney } from "@/lib/format";
import { useState, useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { startOfWeek, format, addDays } from "date-fns";
import {
  type Period,
  PERIODS,
  periodLabel,
  getPeriodRange,
  navigateAnchor,
  formatAnchorLabel,
} from "@/lib/period";
import { ChevronLeft, ChevronRight, ChevronDown, ArrowLeft, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/UserAvatar";
import { splitRowAvatar } from "@/lib/people";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SwipeRow } from "@/components/SwipeRow";
import { deleteSettlement as deleteSettlementRpc } from "@/lib/deleteSettlement";
import { EditTxSheet, EditSplitSheet } from "@/routes/home";
import { SettlementEditSheet } from "@/components/SettlementEditSheet";
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
import { toast } from "sonner";

// A settlement counts as the viewer's INCOME only when the viewer is the CREDITOR (received the
// money). Bin model: the settler is the creditor when settler_is_creditor; the counterparty is the
// creditor otherwise. Works regardless of who recorded the settlement.
function settlementReceivedByMe(s: any, myUid: string | undefined): boolean {
  if (!myUid) return false;
  const settlerIsMe = s.created_by === myUid;
  return settlerIsMe ? !!s.settler_is_creditor : !s.settler_is_creditor;
}
// Mirror of settlementReceivedByMe: a settlement counts as the viewer's EXPENSE when the viewer is
// the DEBTOR (paid the money out). Exactly the inverse direction of "received by me".
function settlementPaidByMe(s: any, myUid: string | undefined): boolean {
  if (!myUid) return false;
  const settlerIsMe = s.created_by === myUid;
  return settlerIsMe ? !s.settler_is_creditor : !!s.settler_is_creditor;
}
// The other party's display name, resolved to the viewer's own contact name so the same person
// isn't split across their profile name vs contact name.
function settlementCounterpartyName(s: any, myUid: string | undefined, people: any[]): string {
  const settlerIsMe = s.created_by === myUid;
  if (settlerIsMe) return s.split_shares?.person_name ?? s.person?.name ?? "Unknown";
  return (
    people.find((p) => p.linked_user_id === s.created_by)?.name ?? s.creator?.full_name ?? "Unknown"
  );
}

// ─── Constants ──────────────────────────────────────────────────────────────
const COLORS = [
  "#EF4444",
  "#F59E0B",
  "#10B981",
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
  "#F97316",
  "#6366F1",
  "#84CC16",
];

type DrillType = "expense-category" | "expense-person" | "income-source" | "income-person";

interface DrillItem {
  name: string;
  colorIdx: number;
  drillType: DrillType;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function periodRangeStrings(period: Period, anchor: Date): { dateFrom: string; dateTo: string } {
  const { from, to } = getPeriodRange(period, anchor);
  return { dateFrom: format(from, "yyyy-MM-dd"), dateTo: format(to, "yyyy-MM-dd") };
}

function fmtDT(date?: string, time?: string): string {
  if (!date) return "";
  const t = time?.slice(0, 5) ?? "00:00";
  return format(new Date(`${date}T${t}`), "MMM dd · hh:mm a");
}

function fmtCAT(createdAt?: string): string {
  if (!createdAt) return "";
  return format(new Date(createdAt), "MMM dd · hh:mm a");
}

// ─── Pie Label ────────────────────────────────────────────────────────────────
function PieLabel({ cx, cy, midAngle, outerRadius, name, percent }: any) {
  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 30;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  if (percent < 0.04) return null;
  return (
    <text
      x={x}
      y={y}
      fill="var(--muted-foreground)"
      textAnchor={x > cx ? "start" : "end"}
      dominantBaseline="central"
      fontSize={10}
    >
      {name} {(percent * 100).toFixed(1)}%
    </text>
  );
}

// ─── Row Components ───────────────────────────────────────────────────────────

function ExpenseRow({ t }: { t: any }) {
  const catLabel = t.categories?.name
    ? `${t.categories.name}${t.sub_categories?.name ? " · " + t.sub_categories.name : ""}`
    : "Expense";
  const account = t.accounts
    ? [t.accounts.institution, t.accounts.label].filter(Boolean).join(" · ")
    : "";
  return (
    <div className="flex items-start justify-between px-4 py-3 bg-card">
      <div className="flex-1 min-w-0 pr-3">
        <p className="text-sm text-expense font-medium truncate">{catLabel}</p>
        <p className="text-[12px] text-muted-foreground truncate mt-0.5">{account}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-mono font-semibold text-expense">{formatMoney(t.amount)}</p>
        <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
          {fmtDT(t.date, t.time)}
        </p>
      </div>
    </div>
  );
}

function SplitItemRow({ s, highlightPerson }: { s: any; highlightPerson?: string }) {
  const shares = (s.split_shares ?? []) as any[];
  const total = Number(s.total_amount);
  const totalShares = shares.reduce((sum: number, sh: any) => sum + Number(sh.share_amount), 0);
  const isGroup = s.type === "group";
  const isMulti = !isGroup && shares.length > 1;
  const isPerson = !isGroup && shares.length <= 1;
  const shareCount = shares.length + 1;
  const perShare = shareCount > 0 ? total / shareCount : 0;
  const account = s.accounts
    ? [s.accounts.institution, s.accounts.label].filter(Boolean).join(" · ")
    : "";
  const dateStr = fmtDT(s.date, s.time);
  const description =
    s.description ||
    (isGroup
      ? (s.groups?.name ?? "Group split")
      : isPerson
        ? `Split w/ ${shares[0]?.person_name ?? ""}`
        : "Split");
  const peopleLine = highlightPerson
    ? highlightPerson
    : isGroup
      ? (s.groups?.name ?? "Group")
      : shares
          .map((sh: any) => sh.person_name)
          .filter(Boolean)
          .join(", ");

  const rowAv = splitRowAvatar(s);
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
            <>
              <div className="flex items-center justify-between gap-2 mt-0.5">
                <p className="text-[12px] text-muted-foreground truncate flex-1">
                  {shares[0]?.person_name ?? ""}
                </p>
                <p className="text-[12px] font-mono text-settled shrink-0">
                  You lent {formatMoney(totalShares)}
                </p>
              </div>
              <div className="flex items-center justify-between gap-2 mt-0.5">
                <p className="text-[12px] text-muted-foreground truncate flex-1">{account}</p>
                <p className="text-[10px] text-muted-foreground font-mono shrink-0">{dateStr}</p>
              </div>
            </>
          )}
          {(isMulti || isGroup) && (
            <>
              <div className="flex items-center justify-between gap-2 mt-0.5">
                <p className="text-[12px] text-muted-foreground truncate flex-1">{peopleLine}</p>
                <p className="text-[12px] font-mono text-muted-foreground shrink-0">
                  {shares.length} × {formatMoney(perShare)}
                </p>
              </div>
              <div className="flex items-center justify-between gap-2 mt-0.5">
                <p className="text-[12px] text-muted-foreground truncate flex-1">{account}</p>
                <p className="text-[12px] font-mono text-settled shrink-0">
                  You lent {formatMoney(totalShares)}
                </p>
              </div>
              <p className="text-[10px] text-muted-foreground font-mono mt-0.5 text-right">
                {dateStr}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function IncomeRow({ t }: { t: any }) {
  const label = t.income_source_text ?? t.people?.name ?? null ?? t.categories?.name ?? "Income";
  const account = t.accounts
    ? [t.accounts.institution, t.accounts.label].filter(Boolean).join(" · ")
    : "";
  return (
    <div className="flex items-start justify-between px-4 py-3 bg-card">
      <div className="flex-1 min-w-0 pr-3">
        <p className="text-sm font-medium truncate">{label}</p>
        <p className="text-[12px] text-muted-foreground truncate mt-0.5">{account}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-mono font-semibold text-income">+{formatMoney(t.amount)}</p>
        <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
          {fmtDT(t.date, t.time)}
        </p>
      </div>
    </div>
  );
}

function SettlementIncomeRow({ s }: { s: any }) {
  const payerName = (s.split_shares as any)?.person_name ?? "Unknown";
  const account = s.accounts
    ? [s.accounts.institution, s.accounts.label].filter(Boolean).join(" · ")
    : "";
  return (
    <div className="bg-card" style={{ borderLeft: "3px solid var(--settled)" }}>
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium">{payerName} → You</p>
          <p className="text-sm font-mono font-semibold text-income shrink-0">
            +{formatMoney(s.amount)}
          </p>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className="text-[12px] text-muted-foreground truncate flex-1">{account}</p>
          <p className="text-[10px] text-muted-foreground font-mono shrink-0">
            {fmtCAT(s.created_at)}
          </p>
        </div>
      </div>
    </div>
  );
}

// Mirror of SettlementIncomeRow for the DEBTOR side: a settlement the current user PAID reads as an
// expense (red, "-", "You → <receiver>"). `name` is the drill person (already the receiver here).
function SettlementExpenseRow({ s, name }: { s: any; name?: string }) {
  const receiverName =
    name ??
    s.creator?.full_name ??
    (s.person as any)?.name ??
    (s.split_shares as any)?.person_name ??
    "Unknown";
  const account = s.accounts
    ? [s.accounts.institution, s.accounts.label].filter(Boolean).join(" · ")
    : "";
  return (
    <div className="bg-card" style={{ borderLeft: "3px solid var(--expense)" }}>
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium">You → {receiverName}</p>
          <p className="text-sm font-mono font-semibold text-expense shrink-0">
            -{formatMoney(s.amount)}
          </p>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className="text-[12px] text-muted-foreground truncate flex-1">{account}</p>
          <p className="text-[10px] text-muted-foreground font-mono shrink-0">
            {fmtCAT(s.created_at)}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Period Nav (shared) ─────────────────────────────────────────────────────
function PeriodNav({
  period,
  anchor,
  onNavigate,
  onChangePeriod,
  compact = false,
}: {
  period: Period;
  anchor: Date;
  onNavigate: (dir: -1 | 1) => void;
  onChangePeriod: (p: Period) => void;
  compact?: boolean;
}) {
  const btnCls = compact
    ? "h-7 w-7 flex items-center justify-center rounded-full bg-secondary"
    : "h-8 w-8 flex items-center justify-center rounded-full bg-secondary";
  const labelCls = compact ? "text-xs font-semibold whitespace-nowrap" : "text-sm font-semibold";
  const dropCls = compact
    ? "flex items-center gap-1 bg-primary text-white text-xs font-medium px-2.5 py-1.5 rounded-xl"
    : "flex items-center gap-1.5 bg-primary text-white text-sm font-medium px-3 py-1.5 rounded-xl";

  return (
    <div className={compact ? "flex items-center gap-2" : "flex items-center gap-2 w-full"}>
      <button type="button" onClick={() => onNavigate(-1)} className={btnCls}>
        <ChevronLeft className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
      </button>
      <span className={labelCls}>{formatAnchorLabel(period, anchor)}</span>
      <button type="button" onClick={() => onNavigate(1)} className={btnCls}>
        <ChevronRight className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={cn(compact ? dropCls : `${dropCls} ml-auto`, "capitalize")}>
            {periodLabel(period)}
            <ChevronDown className={compact ? "h-3 w-3" : "h-4 w-4"} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-36">
          {PERIODS.map((p) => (
            <DropdownMenuItem
              key={p}
              onClick={() => onChangePeriod(p)}
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
  );
}

// ─── Drill Page ───────────────────────────────────────────────────────────────
function DrillPage({ drillItem, onBack }: { drillItem: DrillItem; onBack: () => void }) {
  const [drillPeriod, setDrillPeriod] = useState<Period>("monthly");
  const [drillAnchor, setDrillAnchor] = useState(new Date());
  const [selectedSub, setSelectedSub] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<any>(null);
  const [deleteItem, setDeleteItem] = useState<any>(null);
  const qc = useQueryClient();

  const { dateFrom, dateTo } = useMemo(
    () => periodRangeStrings(drillPeriod, drillAnchor),
    [drillPeriod, drillAnchor],
  );

  const color = COLORS[drillItem.colorIdx % COLORS.length];
  const isExpenseCat = drillItem.drillType === "expense-category";
  const isExpensePerson = drillItem.drillType === "expense-person";
  const isIncomeSource = drillItem.drillType === "income-source";
  const isIncomePerson = drillItem.drillType === "income-person";
  const isIncome = isIncomeSource || isIncomePerson;

  // Expense transactions (non-split) for this category
  const { data: expTxns = [] } = useQuery({
    queryKey: ["drill", "exp-txns", drillItem.name, dateFrom, dateTo],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data, error } = await supabase
        .from("transactions")
        .select(
          "*, categories:category_id(name,icon), sub_categories:sub_category_id(name), accounts:account_id(label,institution)",
        )
        .eq("user_id", u.user.id)
        .eq("type", "expense")
        .eq("is_split", false)
        .gte("date", dateFrom)
        .lte("date", dateTo)
        .order("date", { ascending: false })
        .order("time", { ascending: false });
      if (error) throw error;
      return (data ?? []).filter((t: any) => (t.categories?.name ?? "Other") === drillItem.name);
    },
    enabled: isExpenseCat,
  });

  // Splits (paid_by=me) for expense drills
  const { data: drillSplits = [] } = useQuery({
    queryKey: ["drill", "splits", drillItem.name, drillItem.drillType, dateFrom, dateTo],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data, error } = await supabase
        .from("splits")
        .select(
          "*, categories:category_id(name,icon), split_shares(*), accounts:account_id(label,institution), groups:group_id(name), people:person_id(name)",
        )
        .eq("paid_by", "me")
        .eq("created_by", u.user.id)
        .gte("date", dateFrom)
        .lte("date", dateTo)
        .order("date", { ascending: false })
        .order("time", { ascending: false });
      if (error) throw error;
      return (data ?? []).filter((s: any) => {
        if (isExpenseCat)
          return ((s.categories as any)?.name ?? "Uncategorized") === drillItem.name;
        return false;
      });
    },
    // expense-person drills are settlement-only (mirror of income-person); category drills use splits.
    enabled: isExpenseCat,
  });

  // Incoming splits the current user paid (confirmed) for this expense category.
  const { data: drillPayerSplits = [] } = useQuery({
    queryKey: ["drill", "payer-splits", drillItem.name, drillItem.drillType, dateFrom, dateTo],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data, error } = await supabase
        .from("splits")
        .select(
          "*, categories:category_id(name,icon), split_shares(*), accounts:account_id(label,institution), groups:group_id(name), people:person_id(name)",
        )
        .eq("pending_for_user_id", u.user.id)
        .eq("account_pending", false)
        .not("category_id", "is", null)
        .gte("date", dateFrom)
        .lte("date", dateTo)
        .order("date", { ascending: false })
        .order("time", { ascending: false });
      if (error) throw error;
      return (data ?? []).filter(
        (s: any) => ((s.categories as any)?.name ?? "Uncategorized") === drillItem.name,
      );
    },
    enabled: isExpenseCat,
  });

  // Income transactions
  const { data: incTxns = [] } = useQuery({
    queryKey: ["drill", "inc-txns", drillItem.name, drillItem.drillType, dateFrom, dateTo],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data, error } = await supabase
        .from("transactions")
        .select(
          "*, categories:category_id(name), sub_categories:sub_category_id(name), accounts:account_id(label,institution), people:income_person_id(name)",
        )
        .eq("user_id", u.user.id)
        .eq("type", "income")
        .gte("date", dateFrom)
        .lte("date", dateTo)
        .order("date", { ascending: false })
        .order("time", { ascending: false });
      if (error) throw error;
      return (data ?? []).filter((t: any) => {
        const label =
          t.income_source_type === "person"
            ? (t.people?.name ?? "Unknown")
            : (t.income_source_text ?? "Other");
        return label === drillItem.name;
      });
    },
    enabled: isIncome,
  });

  // Declared here (not lower) so the drill settlement memos below can resolve counterparty names.
  const { data: people = [] } = useQuery(peopleQuery());

  // Settlements involving me in this period (RLS-scoped); filtered to this person's received income
  // in drillSettlements below (needs the people list for cross-user name resolution).
  const { data: drillSettlementsRaw = [] } = useQuery({
    queryKey: ["drill", "settlements", dateFrom, dateTo],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data, error } = await supabase
        .from("settlements")
        .select(
          "*, person:person_id(name), creator:created_by(full_name), split_shares:split_share_id(person_name, share_amount), accounts:account_id(label,institution)",
        )
        .gte("created_at", dateFrom)
        .lte("created_at", dateTo + "T23:59:59.999");
      if (error) throw error;
      return (data ?? []).map((s: any) => ({ ...s, _uid: u.user!.id }));
    },
    enabled: isIncomePerson || isExpensePerson,
  });
  // Settlements with THIS drill person that match the drill's direction:
  //   income-person  → money I RECEIVED, expense-person → money I PAID (either direction, whoever recorded).
  const drillSettlements = useMemo(
    () =>
      (drillSettlementsRaw as any[]).filter((s) => {
        const dirMatch = isExpensePerson
          ? settlementPaidByMe(s, s._uid)
          : settlementReceivedByMe(s, s._uid);
        return dirMatch && settlementCounterpartyName(s, s._uid, people as any[]) === drillItem.name;
      }),
    [drillSettlementsRaw, people, drillItem.name, isExpensePerson],
  );

  // ─── Chart buckets: X-axis structure driven by drillPeriod ─────────────────
  const chartBuckets = useMemo((): { label: string; key: number | string }[] => {
    if (drillPeriod === "daily") {
      return Array.from({ length: 24 }, (_, h) => ({
        label: h === 0 ? "12AM" : h < 12 ? `${h}AM` : h === 12 ? "12PM" : `${h - 12}PM`,
        key: h,
      }));
    }
    if (drillPeriod === "weekly") {
      const weekStart = startOfWeek(drillAnchor, { weekStartsOn: 1 });
      return Array.from({ length: 7 }, (_, i) => {
        const d = addDays(weekStart, i);
        return { label: format(d, "EEE"), key: format(d, "yyyy-MM-dd") };
      });
    }
    if (drillPeriod === "monthly") {
      return [1, 2, 3, 4, 5].map((w) => ({ label: `W${w}`, key: w }));
    }
    // annually
    const year = drillAnchor.getFullYear();
    return Array.from({ length: 12 }, (_, i) => ({
      label: format(new Date(year, i, 1), "MMM"),
      key: i + 1,
    }));
  }, [drillPeriod, drillAnchor]);

  const trendData = useMemo(() => {
    function txnKey(dateStr: string, timeStr?: string | null): number | string {
      if (drillPeriod === "daily") return parseInt((timeStr ?? "00:00").split(":")[0], 10);
      if (drillPeriod === "weekly") return dateStr;
      if (drillPeriod === "monthly")
        return Math.min(Math.ceil(parseInt(dateStr.split("-")[2], 10) / 7), 5);
      return parseInt(dateStr.split("-")[1], 10);
    }
    function caKey(createdAt: string): number | string {
      const d = new Date(createdAt);
      if (drillPeriod === "daily") return d.getHours();
      if (drillPeriod === "weekly") return format(d, "yyyy-MM-dd");
      if (drillPeriod === "monthly") return Math.min(Math.ceil(d.getDate() / 7), 5);
      return d.getMonth() + 1;
    }
    const sums = new Map<number | string, number>(chartBuckets.map((b) => [b.key, 0]));
    if (isExpenseCat) {
      for (const t of expTxns as any[]) {
        const k = txnKey(t.date, t.time);
        sums.set(k, (sums.get(k) ?? 0) + Number(t.amount));
      }
      for (const s of drillSplits as any[]) {
        const k = txnKey(s.date, s.time);
        sums.set(k, (sums.get(k) ?? 0) + Number(s.total_amount));
      }
      for (const s of drillPayerSplits as any[]) {
        const k = txnKey(s.date, s.time);
        sums.set(k, (sums.get(k) ?? 0) + Number(s.total_amount));
      }
    } else if (isExpensePerson) {
      for (const s of drillSettlements as any[]) {
        const k = caKey(s.created_at);
        sums.set(k, (sums.get(k) ?? 0) + Number(s.amount));
      }
    } else {
      for (const t of incTxns as any[]) {
        const k = txnKey(t.date, t.time);
        sums.set(k, (sums.get(k) ?? 0) + Number(t.amount));
      }
      if (isIncomePerson) {
        for (const s of drillSettlements as any[]) {
          const k = caKey(s.created_at);
          sums.set(k, (sums.get(k) ?? 0) + Number(s.amount));
        }
      }
    }
    return chartBuckets.map((b) => ({ label: b.label, value: sums.get(b.key) ?? 0 }));
  }, [
    chartBuckets,
    expTxns,
    drillSplits,
    drillPayerSplits,
    incTxns,
    drillSettlements,
    drillPeriod,
    isExpenseCat,
    isExpensePerson,
    isIncomePerson,
  ]);

  // Sub-categories for filter list (expense-category only, from expense txns)
  const subItems = useMemo(() => {
    if (!isExpenseCat) return [];
    const map = new Map<string, number>();
    for (const t of expTxns as any[]) {
      const sub = t.sub_categories?.name ?? "Uncategorized";
      map.set(sub, (map.get(sub) ?? 0) + Number(t.amount));
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [expTxns, isExpenseCat]);

  const showSubFilter = isExpenseCat && subItems.length > 0;

  // Merge all items, sorted by date
  const allItems = useMemo(() => {
    const items: any[] = [];
    if (isExpenseCat) {
      const filteredTxns = selectedSub
        ? (expTxns as any[]).filter(
            (t) => (t.sub_categories?.name ?? "Uncategorized") === selectedSub,
          )
        : (expTxns as any[]);
      filteredTxns.forEach((t) =>
        items.push({ ...t, _type: "exp", _sort: `${t.date}T${t.time ?? "00:00"}` }),
      );
      if (!selectedSub) {
        (drillSplits as any[]).forEach((s) =>
          items.push({ ...s, _type: "split", _sort: `${s.date}T${s.time ?? "00:00"}` }),
        );
        (drillPayerSplits as any[]).forEach((s) =>
          items.push({ ...s, _type: "split", _sort: `${s.date}T${s.time ?? "00:00"}` }),
        );
      }
    } else if (isExpensePerson) {
      (drillSettlements as any[]).forEach((s) =>
        items.push({ ...s, _type: "set-exp", _sort: s.created_at ?? "" }),
      );
    } else if (isIncomeSource) {
      (incTxns as any[]).forEach((t) =>
        items.push({ ...t, _type: "inc", _sort: `${t.date}T${t.time ?? "00:00"}` }),
      );
    } else if (isIncomePerson) {
      (incTxns as any[]).forEach((t) =>
        items.push({ ...t, _type: "inc", _sort: `${t.date}T${t.time ?? "00:00"}` }),
      );
      (drillSettlements as any[]).forEach((s) =>
        items.push({ ...s, _type: "set-inc", _sort: s.created_at ?? "" }),
      );
    }
    return items.sort((a, b) => b._sort.localeCompare(a._sort));
  }, [
    expTxns,
    drillSplits,
    drillPayerSplits,
    incTxns,
    drillSettlements,
    selectedSub,
    isExpenseCat,
    isExpensePerson,
    isIncomeSource,
    isIncomePerson,
  ]);

  const total = useMemo(
    () =>
      allItems.reduce((s, item) => {
        if (item._type === "exp") return s + Number(item.amount);
        if (item._type === "split") return s + Number(item.total_amount);
        if (item._type === "inc") return s + Number(item.amount);
        if (item._type === "set-inc") return s + Number(item.amount);
        if (item._type === "set-exp") return s + Number(item.amount);
        return s;
      }, 0),
    [allItems],
  );

  // Re-compute total for sub-filter "All" row
  const totalAll = useMemo(() => {
    let t = 0;
    (expTxns as any[]).forEach((x) => {
      t += Number(x.amount);
    });
    (drillSplits as any[]).forEach((x) => {
      t += Number(x.total_amount);
    });
    (drillPayerSplits as any[]).forEach((x) => {
      t += Number(x.total_amount);
    });
    return t;
  }, [expTxns, drillSplits, drillPayerSplits]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-5 pb-3 border-b border-border">
        <button type="button" onClick={onBack} className="text-muted-foreground mr-1">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="text-base font-semibold flex-1 truncate">{drillItem.name}</span>
        <PeriodNav
          period={drillPeriod}
          anchor={drillAnchor}
          compact
          onNavigate={(dir) => setDrillAnchor((a) => navigateAnchor(drillPeriod, a, dir))}
          onChangePeriod={(p) => {
            setDrillPeriod(p);
            setDrillAnchor(new Date());
          }}
        />
      </div>

      <div className="flex-1 overflow-y-auto pb-24">
        {/* Total */}
        <div className="px-4 py-4">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-3xl font-mono font-bold" style={{ color }}>
            {isIncome ? "+" : ""}
            {formatMoney(total)}
          </p>
        </div>

        {/* Sub-category filter list (expense-category only) */}
        {showSubFilter && (
          <div className="mx-4 rounded-xl overflow-hidden border border-border mb-4">
            <button
              type="button"
              onClick={() => setSelectedSub(null)}
              className={cn(
                "w-full flex items-center justify-between px-4 py-3 text-sm border-b border-border",
                selectedSub === null ? "bg-primary/10" : "bg-card",
              )}
            >
              <span className="font-medium">All</span>
              <div className="flex items-center gap-4">
                <span className="text-muted-foreground text-xs">100%</span>
                <span className="font-mono text-xs">{formatMoney(totalAll)}</span>
              </div>
            </button>
            {subItems.map((item) => {
              const pct = totalAll > 0 ? (item.value / totalAll) * 100 : 0;
              return (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => setSelectedSub(selectedSub === item.name ? null : item.name)}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-3 text-sm border-b border-border last:border-0",
                    selectedSub === item.name ? "bg-primary/10" : "bg-card",
                  )}
                >
                  <span>{item.name}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-muted-foreground text-xs">{pct.toFixed(0)}%</span>
                    <span className="font-mono text-xs">{formatMoney(item.value)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Trend line chart */}
        {(() => {
          const pointPx = 50;
          const chartW = Math.max(chartBuckets.length * pointPx, 280);
          return (
            <div className="mx-4 mb-4 rounded-xl overflow-hidden bg-background">
              <div style={{ overflowX: "auto", touchAction: "pan-x" }}>
                <div style={{ width: chartW, padding: "12px 8px 4px 0" }}>
                  <LineChart
                    width={chartW}
                    height={140}
                    data={trendData}
                    margin={{ top: 4, right: 16, bottom: 0, left: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                      width={44}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        fontSize: 11,
                        color: "#FFFFFF",
                      }}
                      labelStyle={{ color: "var(--muted-foreground)" }}
                      formatter={(v: any) => [formatMoney(v), ""]}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#FFFFFF"
                      strokeWidth={2}
                      dot={{ fill: "#FFFFFF", r: 3 }}
                    />
                  </LineChart>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Transaction list */}
        <div className="mx-4 rounded-xl overflow-hidden border border-border divide-y divide-border">
          {allItems.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No data for this period
            </p>
          )}
          {allItems.map((item) => {
            if (item._type === "exp")
              return (
                <SwipeRow
                  key={item.id}
                  onEdit={() => setEditItem(item)}
                  onDelete={() => setDeleteItem(item)}
                >
                  <ExpenseRow t={item} />
                </SwipeRow>
              );
            if (item._type === "split") {
              const highlight = isExpensePerson ? drillItem.name : undefined;
              return (
                <SwipeRow
                  key={item.id}
                  onEdit={() => setEditItem(item)}
                  onDelete={() => setDeleteItem(item)}
                >
                  <SplitItemRow s={item} highlightPerson={highlight} />
                </SwipeRow>
              );
            }
            if (item._type === "inc")
              return (
                <SwipeRow
                  key={item.id}
                  onEdit={() => setEditItem(item)}
                  onDelete={() => setDeleteItem(item)}
                >
                  <IncomeRow t={item} />
                </SwipeRow>
              );
            if (item._type === "set-inc")
              return (
                <SwipeRow
                  key={item.id}
                  onEdit={() => setEditItem(item)}
                  onDelete={() => setDeleteItem(item)}
                >
                  <SettlementIncomeRow s={item} />
                </SwipeRow>
              );
            if (item._type === "set-exp")
              return (
                <SwipeRow
                  key={item.id}
                  onEdit={() => setEditItem(item)}
                  onDelete={() => setDeleteItem(item)}
                >
                  <SettlementExpenseRow s={item} name={drillItem.name} />
                </SwipeRow>
              );
            return null;
          })}
        </div>
      </div>

      {/* Edit sheets */}
      {editItem && (editItem._type === "exp" || editItem._type === "inc") && (
        <EditTxSheet
          txn={editItem}
          open={!!editItem}
          onOpenChange={(o) => {
            if (!o) {
              setEditItem(null);
              qc.invalidateQueries({ queryKey: ["drill"] });
            }
          }}
        />
      )}
      {editItem && editItem._type === "split" && (
        <EditSplitSheet
          split={editItem}
          open={!!editItem}
          onOpenChange={(o) => {
            if (!o) {
              setEditItem(null);
              qc.invalidateQueries({ queryKey: ["drill"] });
            }
          }}
        />
      )}
      {editItem && editItem._type === "set-inc" && (
        <SettlementEditSheet
          settlement={editItem}
          open={!!editItem}
          onOpenChange={(o) => {
            if (!o) {
              setEditItem(null);
              qc.invalidateQueries({ queryKey: ["drill"] });
            }
          }}
        />
      )}

      {/* Delete dialog */}
      <AlertDialog
        open={!!deleteItem}
        onOpenChange={(o) => {
          if (!o) setDeleteItem(null);
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
                if (!deleteItem) return;
                const item = deleteItem;
                setDeleteItem(null);
                let error: any = null;
                if (item._type === "exp" || item._type === "inc") {
                  ({ error } = await supabase.from("transactions").delete().eq("id", item.id));
                  if (!error) {
                    qc.invalidateQueries({ queryKey: ["transactions"] });
                    qc.invalidateQueries({ queryKey: ["accounts"] });
                    qc.invalidateQueries({ queryKey: ["splits"] });
                    qc.invalidateQueries({ queryKey: ["drill"] });
                  }
                } else if (item._type === "split") {
                  ({ error } = await supabase.from("splits").delete().eq("id", item.id));
                  if (!error) {
                    qc.invalidateQueries({ queryKey: ["splits"] });
                    qc.invalidateQueries({ queryKey: ["transactions"] });
                    qc.invalidateQueries({ queryKey: ["accounts"] });
                    qc.invalidateQueries({ queryKey: ["drill"] });
                  }
                } else if (item._type === "set-inc") {
                  // Routed through the delete_settlement RPC (permission + balance triggers +
                  // notifications). It shows its own toast, so return before the generic one.
                  await deleteSettlementRpc(item.id, qc);
                  qc.invalidateQueries({ queryKey: ["drill"] });
                  return;
                }
                if (error) toast.error(error.message);
                else toast.success("Deleted");
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

// ─── Main Reports Page ────────────────────────────────────────────────────────
export default function ReportsPage() {
  const [period, setPeriod] = useState<Period>("monthly");
  const [anchor, setAnchor] = useState(new Date());
  const [tab, setTab] = useState<"income" | "expense">("expense");
  const [drillItem, setDrillItem] = useState<DrillItem | null>(null);
  const [activeSlice, setActiveSlice] = useState<{
    name: string;
    value: number;
    color: string;
  } | null>(null);

  const { dateFrom, dateTo } = useMemo(() => periodRangeStrings(period, anchor), [period, anchor]);

  const { data: txns = [] } = useQuery(transactionsQuery({ dateFrom, dateTo }));
  const { data: people = [] } = useQuery(peopleQuery());

  // Splits paid by me in this period
  const { data: mySplits = [] } = useQuery({
    queryKey: ["splits", "reports-main", dateFrom, dateTo],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data, error } = await supabase
        .from("splits")
        .select("*, categories:category_id(name,icon)")
        .eq("paid_by", "me")
        .eq("created_by", u.user.id)
        .gte("date", dateFrom)
        .lte("date", dateTo);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Incoming splits where I'm the PAYER and I've confirmed an account + category (Pending tab).
  // pending_for_user_id = me identifies these; they never create a transaction, so they'd otherwise
  // be missing from expenses. No overlap with mySplits (those have pending_for_user_id = null).
  const { data: payerSplits = [] } = useQuery({
    queryKey: ["splits", "reports-payer", dateFrom, dateTo],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data, error } = await supabase
        .from("splits")
        .select("*, categories:category_id(name,icon)")
        .eq("pending_for_user_id", u.user.id)
        .eq("account_pending", false)
        .not("category_id", "is", null)
        .gte("date", dateFrom)
        .lte("date", dateTo);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Every settlement that involves me in this period (RLS-scoped). The income filter (only ones I
  // RECEIVED, either direction, whoever recorded) + person attribution happen in incomeData, where
  // the people list is available for cross-user name resolution.
  const { data: incomeSettlements = [] } = useQuery({
    queryKey: ["settlements", "reports-main", dateFrom, dateTo],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data, error } = await supabase
        .from("settlements")
        .select(
          "*, person:person_id(name), creator:created_by(full_name), split_shares:split_share_id(person_name, share_amount)",
        )
        .gte("created_at", dateFrom)
        .lte("created_at", dateTo + "T23:59:59.999");
      if (error) throw error;
      return (data ?? []).map((s: any) => ({ ...s, _uid: u.user!.id }));
    },
  });

  // ── Expense pie: normal expenses (non-split) + splits grouped by category, plus settlements I
  // PAID grouped under the receiver's name (mirror of how received settlements group under the
  // payer's name in the income pie). Category slices drill as expense-category; settlement slices
  // drill as expense-person.
  const expenseData = useMemo(() => {
    const map = new Map<string, { value: number; drillType: DrillType }>();
    const add = (name: string, amount: number, drillType: DrillType) => {
      const ex = map.get(name);
      map.set(name, { value: (ex?.value ?? 0) + amount, drillType: ex?.drillType ?? drillType });
    };
    (txns as any[]).forEach((t) => {
      if (t.type !== "expense" || t.is_split) return;
      add(t.categories?.name ?? "Other", Number(t.amount), "expense-category");
    });
    (mySplits as any[]).forEach((s) => {
      add((s.categories as any)?.name ?? "Uncategorized", Number(s.total_amount), "expense-category");
    });
    // Incoming splits I paid (full amount left my account on confirm).
    (payerSplits as any[]).forEach((s) => {
      add((s.categories as any)?.name ?? "Uncategorized", Number(s.total_amount), "expense-category");
    });
    (incomeSettlements as any[]).forEach((s) => {
      if (!settlementPaidByMe(s, s._uid)) return; // only money I actually paid out is expense
      const name = settlementCounterpartyName(s, s._uid, people as any[]);
      const ex = map.get(name);
      // settlement overrides drillType to expense-person
      map.set(name, { value: (ex?.value ?? 0) + Number(s.amount), drillType: "expense-person" });
    });
    return Array.from(map.entries())
      .map(([name, { value, drillType }]) => ({ name, value, drillType }))
      .sort((a, b) => b.value - a.value);
  }, [txns, mySplits, payerSplits, incomeSettlements, people]);

  const expenseTotal = useMemo(() => expenseData.reduce((s, d) => s + d.value, 0), [expenseData]);

  // ── Income pie: income transactions + settlements received grouped by source/person
  const incomeData = useMemo(() => {
    const map = new Map<string, { value: number; drillType: DrillType }>();
    (txns as any[]).forEach((t) => {
      if (t.type !== "income") return;
      let name: string;
      let dt: DrillType;
      if (t.income_source_type === "person") {
        const person = (people as any[]).find((p) => p.id === t.income_person_id);
        name = person?.name ?? "Unknown";
        dt = "income-person";
      } else {
        name = t.income_source_text ?? "Other";
        dt = "income-source";
      }
      const ex = map.get(name);
      map.set(name, { value: (ex?.value ?? 0) + Number(t.amount), drillType: ex?.drillType ?? dt });
    });
    (incomeSettlements as any[]).forEach((s) => {
      if (!settlementReceivedByMe(s, s._uid)) return; // only money I actually received is income
      const name = settlementCounterpartyName(s, s._uid, people as any[]);
      const ex = map.get(name);
      // settlement overrides drillType to income-person
      map.set(name, { value: (ex?.value ?? 0) + Number(s.amount), drillType: "income-person" });
    });
    return Array.from(map.entries())
      .map(([name, { value, drillType }]) => ({ name, value, drillType }))
      .sort((a, b) => b.value - a.value);
  }, [txns, incomeSettlements, people]);

  const incomeTotal = useMemo(() => incomeData.reduce((s, d) => s + d.value, 0), [incomeData]);

  const chartData = tab === "expense" ? expenseData : incomeData;
  const chartTotal = tab === "expense" ? expenseTotal : incomeTotal;

  if (drillItem) {
    return (
      <div className="h-full flex flex-col">
        <DrillPage
          drillItem={drillItem}
          onBack={() => {
            setDrillItem(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="pb-24">
      <div className="px-4 pt-5 pb-0 space-y-3">
        {/* Period nav */}
        <div className="flex items-center justify-between">
          <PeriodNav
            period={period}
            anchor={anchor}
            onNavigate={(dir) => {
              setAnchor((a) => navigateAnchor(period, a, dir));
              setActiveSlice(null);
            }}
            onChangePeriod={(p) => {
              setPeriod(p);
              setAnchor(new Date());
              setActiveSlice(null);
            }}
          />
        </div>

        {/* Income / Expense tabs */}
        <div className="flex rounded-xl bg-secondary p-1 gap-1">
          <button
            type="button"
            onClick={() => {
              setTab("income");
              setActiveSlice(null);
            }}
            className={cn(
              "flex-1 rounded-lg py-2 text-sm font-medium transition-colors",
              tab === "income" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            Income <span className="font-mono text-xs ml-1">{formatMoney(incomeTotal)}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("expense");
              setActiveSlice(null);
            }}
            className={cn(
              "flex-1 rounded-lg py-2 text-sm font-medium transition-colors",
              tab === "expense" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            Expenses <span className="font-mono text-xs ml-1">{formatMoney(expenseTotal)}</span>
          </button>
        </div>
      </div>

      {/* Pie chart */}
      <div className="px-4 pt-4">
        {chartData.length === 0 ? (
          <div className="h-48 flex items-center justify-center">
            <p className="text-sm text-muted-foreground">No data for this period</p>
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  labelLine
                  label={PieLabel}
                  onClick={(d, i) => {
                    setActiveSlice(
                      activeSlice?.name === d.name
                        ? null
                        : { name: d.name, value: d.value, color: COLORS[i % COLORS.length] },
                    );
                  }}
                >
                  {chartData.map((entry, i) => (
                    <Cell
                      key={entry.name}
                      fill={COLORS[i % COLORS.length]}
                      opacity={activeSlice && activeSlice.name !== entry.name ? 0.4 : 1}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>

            {activeSlice && (
              <div className="mx-auto w-fit bg-card border border-border rounded-xl px-5 py-3 text-center shadow-lg -mt-4 mb-2">
                <p className="text-sm font-semibold text-foreground">{activeSlice.name}</p>
                <p
                  className="font-mono text-base font-bold mt-0.5"
                  style={{ color: activeSlice.color }}
                >
                  {formatMoney(activeSlice.value)}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Category / source list */}
      <div className="mx-4 mt-2 rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden shadow-sm">
        {chartData.map((item, i) => {
          const pct = chartTotal > 0 ? Math.round((item.value / chartTotal) * 100) : 0;
          return (
            <button
              key={item.name}
              type="button"
              onClick={() => {
                setDrillItem({ name: item.name, colorIdx: i, drillType: item.drillType });
                setActiveSlice(null);
              }}
              className="w-full flex items-center gap-3 px-3 py-3.5 active:bg-secondary/40"
            >
              <div
                className="h-9 w-12 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                style={{ background: COLORS[i % COLORS.length] }}
              >
                {pct}%
              </div>
              <span className="flex-1 text-left text-sm font-medium">{item.name}</span>
              <span className="font-mono text-sm">{formatMoney(item.value)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
