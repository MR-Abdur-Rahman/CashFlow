import { useQuery, useQueryClient } from "@tanstack/react-query";
import { transactionsQuery, peopleQuery } from "@/lib/queries";
import { formatMoney } from "@/lib/format";
import { useState, useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { startOfWeek, startOfMonth, startOfYear, endOfWeek, endOfMonth, endOfYear, format, subMonths, addMonths, subWeeks, addWeeks, subYears, addYears, eachMonthOfInterval } from "date-fns";
import { ChevronLeft, ChevronRight, ChevronDown, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { SwipeRow } from "@/components/SwipeRow";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const COLORS = [
  "#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6",
  "#EC4899", "#14B8A6", "#F97316", "#6366F1", "#84CC16",
];

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

// ─── Drill-down page ───────────────────────────────────────────────────────
function DrillPage({
  title, total, items, txns, anchor, colorIdx, onBack, type,
}: {
  title: string;
  total: number;
  items: { name: string; value: number; id?: string }[];
  txns: any[];
  period: Period;
  anchor: Date;
  colorIdx: number;
  onBack: () => void;
  type: "income" | "expense";
}) {
  const qc = useQueryClient();
  const [selectedSub, setSelectedSub] = useState<string | null>(null);
  const [deleteTxn, setDeleteTxn] = useState<any | null>(null);
  const [editTxn, setEditTxn] = useState<any | null>(null);
  const [editNote, setEditNote] = useState("");

  const filteredTxns = useMemo(() => {
    if (!selectedSub) return txns;
    return txns.filter((t) =>
      type === "expense"
        ? t.sub_categories?.name === selectedSub || t.categories?.name === selectedSub
        : t.income_source_text === selectedSub || t.categories?.name === selectedSub
    );
  }, [txns, selectedSub, type]);

  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const t of filteredTxns) {
      if (!map.has(t.date)) map.set(t.date, []);
      map.get(t.date)!.push(t);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredTxns]);

  const trendData = useMemo(() => {
    const months = eachMonthOfInterval({ start: subMonths(anchor, 7), end: anchor });
    return months.map((m) => {
      const label = format(m, "MMM");
      const mFrom = format(startOfMonth(m), "yyyy-MM-dd");
      const mTo = format(endOfMonth(m), "yyyy-MM-dd");
      const val = txns.filter((t) => t.date >= mFrom && t.date <= mTo).reduce((s, t) => s + Number(t.amount), 0);
      return { label, value: val };
    });
  }, [txns, anchor]);

  async function deleteTx(t: any) {
    const { error } = await supabase.from("transactions").delete().eq("id", t.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
    }
    setDeleteTxn(null);
  }

  async function saveEdit() {
    if (!editTxn) return;
    const { error } = await supabase.from("transactions").update({ note: editNote }).eq("id", editTxn.id);
    if (error) toast.error(error.message);
    else { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["transactions"] }); }
    setEditTxn(null);
  }

  const color = COLORS[colorIdx % COLORS.length];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-3 border-b border-border">
        <button type="button" onClick={onBack} className="text-muted-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="text-base font-semibold flex-1">{title}</span>
      </div>

      <div className="flex-1 overflow-y-auto pb-24">
        {/* Total */}
        <div className="px-4 py-4">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-3xl font-mono font-bold" style={{ color }}>{formatMoney(total)}</p>
        </div>

        {/* Sub-items list */}
        <div className="mx-4 rounded-xl overflow-hidden border border-border mb-4">
          <button type="button" onClick={() => setSelectedSub(null)}
            className={cn("w-full flex items-center justify-between px-4 py-3 text-sm border-b border-border",
              selectedSub === null ? "bg-primary/10" : "bg-card")}>
            <span className="font-medium">All</span>
            <div className="flex items-center gap-4">
              <span className="text-muted-foreground text-xs">100%</span>
              <span className="font-mono text-xs">{formatMoney(total)}</span>
            </div>
          </button>
          {items.map((item) => {
            const pct = total > 0 ? (item.value / total) * 100 : 0;
            return (
              <button key={item.name} type="button"
                onClick={() => setSelectedSub(selectedSub === item.name ? null : item.name)}
                className={cn("w-full flex items-center justify-between px-4 py-3 text-sm border-b border-border last:border-0",
                  selectedSub === item.name ? "bg-primary/10" : "bg-card")}>
                <span>{item.name}</span>
                <div className="flex items-center gap-4">
                  <span className="text-muted-foreground text-xs">{pct.toFixed(0)}%</span>
                  <span className="font-mono text-xs">{formatMoney(item.value)}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Trend chart */}
        <div className="mx-4 mb-4">
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#9CA3AF" }} />
              <YAxis tick={{ fontSize: 10, fill: "#9CA3AF" }} width={40} />
              <Tooltip contentStyle={{ background: "#1A1A1A", border: "1px solid #2A2A2A", fontSize: 11 }}
                formatter={(v: any) => formatMoney(v)} />
              <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={{ fill: color, r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Transaction list grouped by date */}
        <div className="px-4 space-y-4">
          {grouped.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">No transactions</p>
          )}
          {grouped.map(([date, dayTxns]) => {
            const dayTotal = dayTxns.reduce((s, t) => s + Number(t.amount), 0);
            return (
              <div key={date}>
                <div className="flex items-center justify-between mb-1 px-1">
                  <p className="text-xs font-mono text-muted-foreground">{date}</p>
                  <p className="text-xs font-mono" style={{ color }}>{formatMoney(dayTotal)}</p>
                </div>
                <div className="rounded-xl overflow-hidden border border-border divide-y divide-border">
                  {dayTxns.map((t) => (
                    <SwipeRow
                      key={t.id}
                      onEdit={() => { setEditTxn(t); setEditNote(t.note ?? ""); }}
                      onDelete={() => setDeleteTxn(t)}
                    >
                      <div className="flex items-center justify-between px-4 py-3 bg-card">
                        <div>
                          <p className="text-sm font-medium">
                            {type === "expense"
                              ? (t.categories?.name ?? "Expense")
                              : (t.income_source_text ?? "Income")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {type === "expense"
                              ? (t.sub_categories?.name ?? (t.accounts ? [t.accounts.institution, t.accounts.label].filter(Boolean).join(" · ") : ""))
                              : (t.accounts ? [t.accounts.institution, t.accounts.label].filter(Boolean).join(" · ") : "")}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-mono font-semibold" style={{ color }}>
                            {type === "income" ? "+" : "-"}{formatMoney(t.amount)}
                          </p>
                          <p className="text-[10px] text-muted-foreground font-mono">{t.time?.slice(0, 5)}</p>
                        </div>
                      </div>
                    </SwipeRow>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTxn} onOpenChange={(o) => { if (!o) setDeleteTxn(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete transaction?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white"
              onClick={() => deleteTxn && deleteTx(deleteTxn)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit note dialog */}
      <AlertDialog open={!!editTxn} onOpenChange={(o) => { if (!o) setEditTxn(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Edit Note</AlertDialogTitle>
            <AlertDialogDescription>
              <input
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                className="w-full bg-secondary rounded-md px-3 py-2 text-sm text-foreground outline-none mt-2"
                placeholder="Add a note..."
              />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={saveEdit}>Save</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Custom Pie Label ──────────────────────────────────────────────────────
function PieLabel({ cx, cy, midAngle, outerRadius, name, percent }: any) {
  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 30;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  if (percent < 0.03) return null;
  return (
    <text x={x} y={y} fill="#9CA3AF" textAnchor={x > cx ? "start" : "end"} dominantBaseline="central" fontSize={10}>
      {name} {(percent * 100).toFixed(1)}%
    </text>
  );
}

// ─── Main Reports Page ─────────────────────────────────────────────────────
export default function ReportsPage() {
  const [period, setPeriod] = useState<Period>("monthly");
  const [anchor, setAnchor] = useState(new Date());
  const [tab, setTab] = useState<"income" | "expense">("expense");
  const [drillItem, setDrillItem] = useState<{ name: string; colorIdx: number } | null>(null);
  const [activeSlice, setActiveSlice] = useState<{ name: string; value: number; color: string } | null>(null);

  const { from, to } = getPeriodRange(period, anchor);
  const dateFrom = format(from, "yyyy-MM-dd");
  const dateTo = format(to, "yyyy-MM-dd");

  const { data: txns = [] } = useQuery(transactionsQuery({ dateFrom, dateTo }));
  const { data: people = [] } = useQuery(peopleQuery());

  const income = useMemo(() => (txns as any[]).filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0), [txns]);
  const expense = useMemo(() => (txns as any[]).filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0), [txns]);

  const expenseData = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of txns as any[]) {
      if (t.type !== "expense") continue;
      const name = t.categories?.name ?? "Other";
      map.set(name, (map.get(name) ?? 0) + Number(t.amount));
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [txns]);

  const incomeData = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of txns as any[]) {
      if (t.type !== "income") continue;
      let name = "Other";
      if (t.income_source_type === "person") {
        const person = (people as any[]).find((p) => p.id === t.income_person_id);
        name = person?.name ?? "Unknown";
      } else {
        name = t.income_source_text ?? "Other";
      }
      map.set(name, (map.get(name) ?? 0) + Number(t.amount));
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [txns, people]);

  const chartData = tab === "expense" ? expenseData : incomeData;
  const chartTotal = tab === "expense" ? expense : income;

  const drillTxns = useMemo(() => {
    if (!drillItem) return [];
    return (txns as any[]).filter((t) => {
      if (tab === "expense") {
        return t.type === "expense" && (t.categories?.name ?? "Other") === drillItem.name;
      } else {
        if (t.type !== "income") return false;
        if (t.income_source_type === "person") {
          const person = (people as any[]).find((p) => p.id === t.income_person_id);
          return (person?.name ?? "Unknown") === drillItem.name;
        }
        return (t.income_source_text ?? "Other") === drillItem.name;
      }
    });
  }, [drillItem, txns, tab, people]);

  const drillSubItems = useMemo(() => {
    if (!drillItem) return [];
    const map = new Map<string, number>();
    for (const t of drillTxns) {
      const name = tab === "expense"
        ? (t.sub_categories?.name ?? "Uncategorized")
        : (t.income_source_text ?? "Other");
      map.set(name, (map.get(name) ?? 0) + Number(t.amount));
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [drillTxns, drillItem, tab]);

  // If drill page is open
  if (drillItem) {
    return (
      <div className="h-full flex flex-col">
        <DrillPage
          title={drillItem.name}
          total={drillTxns.reduce((s, t) => s + Number(t.amount), 0)}
          items={drillSubItems}
          txns={drillTxns}
          period={period}
          anchor={anchor}
          colorIdx={drillItem.colorIdx}
          onBack={() => setDrillItem(null)}
          type={tab}
        />
      </div>
    );
  }

  return (
    <div className="pb-24">
      {/* Top header */}
      <div className="px-4 pt-5 pb-0 space-y-3">
        {/* Period navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button type="button"
              onClick={() => { setAnchor(navigateAnchor(period, anchor, -1)); setActiveSlice(null); }}
              className="h-8 w-8 flex items-center justify-center rounded-full bg-secondary text-foreground">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold">{formatAnchorLabel(period, anchor)}</span>
            <button type="button"
              onClick={() => { setAnchor(navigateAnchor(period, anchor, 1)); setActiveSlice(null); }}
              className="h-8 w-8 flex items-center justify-center rounded-full bg-secondary text-foreground">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Period dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 bg-primary text-white text-sm font-medium px-3 py-1.5 rounded-xl capitalize">
                {period} <ChevronDown className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              {(["weekly", "monthly", "annually"] as Period[]).map((p) => (
                <DropdownMenuItem key={p}
                  onClick={() => { setPeriod(p); setAnchor(new Date()); setActiveSlice(null); }}
                  className={cn("capitalize py-3 text-base", period === p && "text-primary font-medium")}>
                  {p}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Income / Expense tab toggle */}
        <div className="flex border-b border-border">
          <button type="button"
            onClick={() => { setTab("income"); setActiveSlice(null); }}
            className={cn("flex-1 py-3 text-sm font-medium transition-colors",
              tab === "income" ? "text-income border-b-2 border-income" : "text-muted-foreground")}>
            Income &nbsp;
            <span className="font-mono text-xs">{formatMoney(income)}</span>
          </button>
          <button type="button"
            onClick={() => { setTab("expense"); setActiveSlice(null); }}
            className={cn("flex-1 py-3 text-sm font-medium transition-colors",
              tab === "expense" ? "text-expense border-b-2 border-expense" : "text-muted-foreground")}>
            Expenses &nbsp;
            <span className="font-mono text-xs">{formatMoney(expense)}</span>
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
                        : { name: d.name, value: d.value, color: COLORS[i % COLORS.length] }
                    );
                  }}
                >
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: any) => formatMoney(v)}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Popup on slice tap */}
            {activeSlice && (
              <div className="mx-auto w-fit bg-card border border-border rounded-xl px-5 py-3 text-center shadow-lg -mt-4 mb-2">
                <p className="text-sm font-semibold">{activeSlice.name}</p>
                <p className="font-mono text-base font-bold mt-0.5" style={{ color: activeSlice.color }}>
                  {formatMoney(activeSlice.value)}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Category / Source list — tap to drill down */}
      <div className="px-4 mt-2 divide-y divide-border border-t border-border">
        {chartData.map((item, i) => {
          const pct = chartTotal > 0 ? Math.round((item.value / chartTotal) * 100) : 0;
          return (
            <button key={item.name} type="button"
              onClick={() => { setDrillItem({ name: item.name, colorIdx: i }); setActiveSlice(null); }}
              className="w-full flex items-center gap-3 py-3.5 active:bg-secondary/40">
              <div className="h-9 w-12 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                style={{ background: COLORS[i % COLORS.length] }}>
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