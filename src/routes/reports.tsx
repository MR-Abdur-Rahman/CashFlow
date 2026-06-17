import { useQuery } from "@tanstack/react-query";
import { transactionsQuery, accountsQuery, categoriesQuery, subCategoriesQuery, peopleQuery } from "@/lib/queries";
import { formatMoney } from "@/lib/format";
import { useState, useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { startOfMonth, startOfWeek, startOfYear, format, subDays } from "date-fns";

const COLORS = ["#7C3AED", "#0EA5E9", "#F59E0B", "#EF4444", "#10B981", "#EC4899", "#8B5CF6", "#14B8A6"];

export default function ReportsPage() {
  const [period, setPeriod] = useState<"week" | "month" | "year" | "all">("month");
  const [accountId, setAccountId] = useState<string>("all");
  const [selectedExpenseCat, setSelectedExpenseCat] = useState<string>("all");
  const [selectedExpenseSubCat, setSelectedExpenseSubCat] = useState<string>("all");
  const [incomeSourceType, setIncomeSourceType] = useState<"person" | "source">("source");
  const [selectedPerson, setSelectedPerson] = useState<string>("all");
  const [selectedSource, setSelectedSource] = useState<string>("");
  const [drillCategory, setDrillCategory] = useState<string | null>(null);

  const { data: accounts = [] } = useQuery(accountsQuery());
  const { data: expenseCats = [] } = useQuery(categoriesQuery("expense"));
  const { data: people = [] } = useQuery(peopleQuery());
  const { data: subCats = [] } = useQuery(subCategoriesQuery(selectedExpenseCat !== "all" ? selectedExpenseCat : null));

  const dateFrom = useMemo(() => {
    const now = new Date();
    if (period === "week") return format(startOfWeek(now), "yyyy-MM-dd");
    if (period === "month") return format(startOfMonth(now), "yyyy-MM-dd");
    if (period === "year") return format(startOfYear(now), "yyyy-MM-dd");
    return undefined;
  }, [period]);

  const { data: txns = [] } = useQuery(transactionsQuery({ dateFrom, accountId: accountId === "all" ? undefined : accountId }));

  const income = txns.filter((t: any) => t.type === "income").reduce((s: number, t: any) => s + Number(t.amount), 0);
  const expense = txns.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + Number(t.amount), 0);
  const net = income - expense;
  const rate = income > 0 ? (net / income) * 100 : 0;

  const expenseByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of txns as any[]) {
      if (t.type !== "expense") continue;
      const name = t.categories?.name ?? "Other";
      map.set(name, (map.get(name) ?? 0) + Number(t.amount));
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [txns]);

  const incomeBySource = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of txns as any[]) {
      if (t.type !== "income") continue;
      const name = t.income_source_text ?? t.categories?.name ?? "Income";
      map.set(name, (map.get(name) ?? 0) + Number(t.amount));
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [txns]);

  // Drill down into category sub-categories
  const drillData = useMemo(() => {
    if (!drillCategory) return [];
    const map = new Map<string, number>();
    for (const t of txns as any[]) {
      if (t.type !== "expense" || t.categories?.name !== drillCategory) continue;
      const name = t.sub_categories?.name ?? "Uncategorized";
      map.set(name, (map.get(name) ?? 0) + Number(t.amount));
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [txns, drillCategory]);

  // Filtered expense transactions
  const filteredExpenseTxns = useMemo(() => {
    return (txns as any[]).filter((t) => {
      if (t.type !== "expense") return false;
      if (selectedExpenseCat !== "all" && t.category_id !== selectedExpenseCat) return false;
      if (selectedExpenseSubCat !== "all" && t.sub_category_id !== selectedExpenseSubCat) return false;
      return true;
    });
  }, [txns, selectedExpenseCat, selectedExpenseSubCat]);

  // Filtered income transactions
  const filteredIncomeTxns = useMemo(() => {
    return (txns as any[]).filter((t) => {
      if (t.type !== "income") return false;
      if (incomeSourceType === "person" && selectedPerson !== "all") {
        return t.income_person_id === selectedPerson;
      }
      if (incomeSourceType === "source" && selectedSource) {
        return t.income_source_text?.toLowerCase().includes(selectedSource.toLowerCase());
      }
      return true;
    });
  }, [txns, incomeSourceType, selectedPerson, selectedSource]);

  const last7 = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => format(subDays(new Date(), 6 - i), "yyyy-MM-dd"));
    return days.map((d) => {
      const inc = (txns as any[]).filter((t) => t.date === d && t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
      const exp = (txns as any[]).filter((t) => t.date === d && t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
      return { day: d.slice(5), income: inc, expense: exp };
    });
  }, [txns]);

  return (
    <div className="px-4 pt-6 pb-24 space-y-5">
      <h1 className="text-xl font-semibold">Reports</h1>

      {/* Period & Account filters */}
      <div className="grid grid-cols-2 gap-2">
        <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="week">This week</SelectItem>
            <SelectItem value="month">This month</SelectItem>
            <SelectItem value="year">This year</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>
        <Select value={accountId} onValueChange={setAccountId}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All accounts</SelectItem>
            {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card label="Income" value={formatMoney(income)} color="text-income" />
        <Card label="Expenses" value={formatMoney(expense)} color="text-expense" />
        <Card label="Net" value={formatMoney(net)} color={net >= 0 ? "text-income" : "text-expense"} />
        <Card label="Savings Rate" value={`${rate.toFixed(1)}%`} color="text-primary" />
      </div>

      {/* Expense Pie Chart */}
      <ChartCard title="Expenses by category">
        {expenseByCategory.length === 0 ? <Empty /> : (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={expenseByCategory}
                dataKey="value"
                nameKey="name"
                innerRadius={50}
                outerRadius={85}
                paddingAngle={2}
                onClick={(d) => setDrillCategory(drillCategory === d.name ? null : d.name)}
              >
                {expenseByCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#0a0a0a", border: "1px solid #222" }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
        <ProgressList items={expenseByCategory} total={expense} onTap={(name) => setDrillCategory(drillCategory === name ? null : name)} />

        {/* Drill down */}
        {drillCategory && drillData.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border">
            <p className="text-xs text-muted-foreground mb-2">↳ {drillCategory} sub-categories</p>
            <ProgressList items={drillData} total={drillData.reduce((s, i) => s + i.value, 0)} />
          </div>
        )}
      </ChartCard>

      {/* Income Pie Chart */}
      <ChartCard title="Income by source">
        {incomeBySource.length === 0 ? <Empty /> : (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={incomeBySource} dataKey="value" nameKey="name" outerRadius={80}>
                {incomeBySource.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#0a0a0a", border: "1px solid #222" }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Last 7 days */}
      <ChartCard title="Last 7 days">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={last7}>
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#888" }} />
            <YAxis tick={{ fontSize: 10, fill: "#888" }} />
            <Tooltip contentStyle={{ background: "#0a0a0a", border: "1px solid #222" }} />
            <Bar dataKey="income" fill="#10B981" />
            <Bar dataKey="expense" fill="#EF4444" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Expense Filter */}
      <ChartCard title="Filter expenses">
        <div className="space-y-3">
          <Select value={selectedExpenseCat} onValueChange={(v) => { setSelectedExpenseCat(v); setSelectedExpenseSubCat("all"); }}>
            <SelectTrigger><SelectValue placeholder="All categories" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {expenseCats.map((c) => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {selectedExpenseCat !== "all" && subCats.length > 0 && (
            <Select value={selectedExpenseSubCat} onValueChange={setSelectedExpenseSubCat}>
              <SelectTrigger><SelectValue placeholder="All sub-categories" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sub-categories</SelectItem>
                {subCats.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <div className="text-xs text-muted-foreground">
            {filteredExpenseTxns.length} transactions · {formatMoney(filteredExpenseTxns.reduce((s, t: any) => s + Number(t.amount), 0))}
          </div>
          <div className="surface-card divide-y divide-border max-h-48 overflow-y-auto">
            {filteredExpenseTxns.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No transactions</p>
            ) : filteredExpenseTxns.map((t: any) => (
              <div key={t.id} className="flex justify-between items-center p-2 text-xs">
                <span>{t.categories?.name}{t.sub_categories ? ` · ${t.sub_categories.name}` : ""}</span>
                <span className="text-expense font-mono">-{formatMoney(t.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      </ChartCard>

      {/* Income Filter */}
      <ChartCard title="Filter income">
        <div className="space-y-3">
          <div className="flex gap-2 rounded-lg bg-secondary p-1">
            {(["source", "person"] as const).map((m) => (
              <button key={m} onClick={() => setIncomeSourceType(m)}
                className={`flex-1 rounded-md py-1.5 text-sm capitalize ${incomeSourceType === m ? "bg-primary text-white" : "text-muted-foreground"}`}>
                {m}
              </button>
            ))}
          </div>
          {incomeSourceType === "person" ? (
            <Select value={selectedPerson} onValueChange={setSelectedPerson}>
              <SelectTrigger><SelectValue placeholder="All people" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All people</SelectItem>
                {people.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : (
            <input
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              placeholder="e.g. Salary, Freelance..."
              className="w-full bg-secondary rounded-md px-3 py-2 text-sm text-foreground outline-none"
            />
          )}
          <div className="text-xs text-muted-foreground">
            {filteredIncomeTxns.length} transactions · {formatMoney(filteredIncomeTxns.reduce((s, t: any) => s + Number(t.amount), 0))}
          </div>
          <div className="surface-card divide-y divide-border max-h-48 overflow-y-auto">
            {filteredIncomeTxns.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No transactions</p>
            ) : filteredIncomeTxns.map((t: any) => (
              <div key={t.id} className="flex justify-between items-center p-2 text-xs">
                <span>{t.income_source_text ?? "Income"}</span>
                <span className="text-income font-mono">+{formatMoney(t.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      </ChartCard>
    </div>
  );
}

function Card({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="surface-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-mono text-base font-semibold mt-1 ${color}`}>{value}</p>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="surface-card p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{title}</p>
      {children}
    </div>
  );
}

function Empty() {
  return <p className="text-sm text-muted-foreground text-center py-8">No data</p>;
}

function ProgressList({ items, total, onTap }: { items: { name: string; value: number }[]; total: number; onTap?: (name: string) => void }) {
  if (items.length === 0) return null;
  return (
    <ul className="space-y-2 mt-3">
      {items.slice(0, 6).map((it, i) => {
        const pct = total > 0 ? (it.value / total) * 100 : 0;
        return (
          <li key={it.name} onClick={() => onTap?.(it.name)} className={onTap ? "cursor-pointer" : ""}>
            <div className="flex justify-between text-xs mb-1">
              <span>{it.name}</span>
              <span className="font-mono">{formatMoney(it.value)} ({pct.toFixed(0)}%)</span>
            </div>
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}