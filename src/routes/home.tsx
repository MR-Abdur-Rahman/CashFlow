import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { accountsQuery, transactionsQuery, profileQuery } from "@/lib/queries";
import { formatMoney, greeting } from "@/lib/format";
import { AccountIcon } from "@/components/AccountIcon";
import { AddTransactionSheet } from "@/components/AddTransactionSheet";
import { Fab } from "@/components/Fab";
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Users, Pencil, Trash2, ChevronDown } from "lucide-react";
import { format, startOfWeek, startOfMonth } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { UserAvatar } from "@/components/UserAvatar";
import { SwipeRow } from "@/components/SwipeRow";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  const [open, setOpen] = useState(false);
  const [editTxn, setEditTxn] = useState<any>(null);
  const [period, setPeriod] = useState<FilterPeriod>("today");

  const { dateFrom, dateTo } = getDateRange(period);
  const { data: accounts = [] } = useQuery(accountsQuery());
  const { data: txns = [] } = useQuery(transactionsQuery({ dateFrom, dateTo }));

  const [userId, setUserId] = useState<string | undefined>();
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id));
  }, []);
  const { data: profile } = useQuery(profileQuery(userId));

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
        <Link to="/settings" aria-label="Profile">
          <UserAvatar url={profile?.avatar_url} name={profile?.full_name} size={40} />
        </Link>
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
            <Link
              to={`/accounts/${a.id}`}
              key={a.id}
              className="surface-card min-w-[180px] p-3 snap-start block active:opacity-80"
            >
              <AccountIcon iconType={a.icon_type} iconName={a.icon_name} iconColor={a.icon_color} iconUrl={a.icon_url} size={36} />
              <p className="text-xs text-muted-foreground mt-2 truncate">
                {[a.institution, a.label].filter(Boolean).join(" · ") || a.label}
              </p>
              <p className="font-mono text-base font-semibold mt-0.5">{formatMoney(a.current_balance)}</p>
            </Link>
          ))}
          {accounts.length === 0 && (
            <p className="text-sm text-muted-foreground py-4">No accounts yet</p>
          )}
        </div>
      </div>

      {/* Transactions Section */}
      <div>
        {/* Period Filter */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground px-1">Transactions</p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 bg-primary text-white text-sm font-medium px-4 py-1.5 rounded-xl">
                {currentLabel}
                <ChevronDown className="h-4 w-4" />
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

        {/* Transaction List */}
        <div className="surface-card overflow-hidden">
          {txns.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10 px-4">
              {emptyMessages[period]}
            </p>
          ) : (
            <div className="divide-y divide-border">
              {(txns as any[]).map((t: any) => (
                <TxRow key={t.id} t={t} onEdit={() => setEditTxn(t)} />
              ))}
            </div>
          )}
        </div>
      </div>

      <Fab onClick={() => setOpen(true)} />
      <AddTransactionSheet open={open} onOpenChange={setOpen} />

      {editTxn && (
        <TxDetailDialog
          txn={editTxn}
          onClose={() => setEditTxn(null)}
        />
      )}
    </div>
  );
}

function TxRow({ t, onEdit }: { t: any; onEdit: () => void }) {
  const qc = useQueryClient();

  async function del() {
    if (!confirm("Delete this transaction?")) return;
    const { error } = await supabase.from("transactions").delete().eq("id", t.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["transactions"] });
    qc.invalidateQueries({ queryKey: ["accounts"] });
  }

  return (
    <SwipeRow onEdit={onEdit} onDelete={del}>
      <TxRowInner t={t} onClick={onEdit} />
    </SwipeRow>
  );
}

function TxRowInner({ t, onClick }: { t: any; onClick: () => void }) {
  const isIncome = t.type === "income";
  const isExpense = t.type === "expense";
  const isTransfer = t.type === "transfer";
  const isSplit = t.is_split;

  const colorClass = isSplit ? "text-split" : isIncome ? "text-income" : isExpense ? "text-expense" : "text-transfer";
  const bgClass = isSplit ? "bg-[var(--color-split-bg)]" : isIncome ? "bg-[var(--color-income-bg)]" : isExpense ? "bg-[var(--color-expense-bg)]" : "bg-[var(--color-transfer-bg)]";
  const Icon = isSplit ? Users : isIncome ? ArrowDownLeft : isExpense ? ArrowUpRight : ArrowLeftRight;
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

function TxDetailDialog({ txn, onClose }: { txn: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [note, setNote] = useState(txn.note ?? "");

  async function save() {
    const { error } = await supabase.from("transactions").update({ note }).eq("id", txn.id);
    if (error) return toast.error(error.message);
    toast.success("Updated");
    qc.invalidateQueries({ queryKey: ["transactions"] });
    onClose();
  }

  async function del() {
    if (!confirm("Delete this transaction?")) return;
    const { error } = await supabase.from("transactions").delete().eq("id", txn.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["transactions"] });
    qc.invalidateQueries({ queryKey: ["accounts"] });
    onClose();
  }

  const isIncome = txn.type === "income";
  const isExpense = txn.type === "expense";
  const colorClass = txn.is_split ? "text-split" : isIncome ? "text-income" : isExpense ? "text-expense" : "text-transfer";
  const sign = isIncome ? "+" : txn.type === "transfer" ? "" : "-";

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <DialogTitle>Transaction Detail</DialogTitle>
        <div className="space-y-4">
          <div className="text-center">
            <p className={`text-3xl font-mono font-bold ${colorClass}`}>
              {sign}{formatMoney(txn.amount)}
            </p>
            <p className="text-sm text-muted-foreground mt-1">{txn.date} at {txn.time?.slice(0, 5)}</p>
          </div>
          <div className="surface-card p-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type</span>
              <span className="capitalize">{txn.type}</span>
            </div>
            {txn.accounts && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Account</span>
                <span>{[txn.accounts.institution, txn.accounts.label].filter(Boolean).join(" · ")}</span>
              </div>
            )}
            {txn.categories && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Category</span>
                <span>{txn.categories.icon} {txn.categories.name}</span>
              </div>
            )}
            {txn.income_source_text && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Source</span>
                <span>{txn.income_source_text}</span>
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">Note</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-secondary rounded-md px-3 py-2 text-sm text-foreground outline-none"
              placeholder="Add a note..."
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="text-expense" onClick={del}>
              <Trash2 className="h-4 w-4 mr-1" /> Delete
            </Button>
            <Button onClick={save}>
              <Pencil className="h-4 w-4 mr-1" /> Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}