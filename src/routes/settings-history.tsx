import { useQuery } from "@tanstack/react-query";
import { transactionsQuery } from "@/lib/queries";
import { formatMoney } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";
import { ArrowLeft, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Users } from "lucide-react";
import { Link } from "react-router-dom";

export default function HistoryPage() {
  const { data: txns = [] } = useQuery(transactionsQuery());
  const [q, setQ] = useState("");
  const [type, setType] = useState<string>("all");

  const filtered = useMemo(() => {
    return (txns as any[]).filter((t) => {
      if (type !== "all" && t.type !== type) return false;
      if (type === "split" && !t.is_split) return false;
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
  }, [txns, q, type]);

  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const t of filtered) {
      if (!map.has(t.date)) map.set(t.date, []);
      map.get(t.date)!.push(t);
    }
    return Array.from(map.entries());
  }, [filtered]);

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
      {grouped.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-10">No results</p>
      )}
      {grouped.map(([date, items]) => (
        <div key={date}>
          <p className="text-xs uppercase text-muted-foreground mb-2 px-1 font-mono">{date}</p>
          <div className="surface-card divide-y divide-border">
            {items.map((t) => <Row key={t.id} t={t} />)}
          </div>
        </div>
      ))}
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
  const sign = isIncome ? "+" : isTransfer ? "" : "-";

  const title = t.categories
    ? `${t.categories.icon ?? ""} ${t.categories.name}${t.sub_categories ? " · " + t.sub_categories.name : ""}`
    : isIncome
    ? (t.income_source_text ?? "Income")
    : isTransfer
    ? "Transfer"
    : isSplit
    ? "Split"
    : "Expense";

  const sub = isTransfer
    ? `${t.accounts?.label ?? ""} → ${t.to_account?.label ?? ""}`
    : isIncome
    ? (t.accounts ? [t.accounts.institution, t.accounts.label].filter(Boolean).join(" · ") : "")
    : t.accounts
    ? [t.accounts.institution, t.accounts.label].filter(Boolean).join(" · ")
    : "";

  return (
    <div className="flex items-center gap-3 p-3">
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