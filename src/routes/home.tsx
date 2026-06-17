import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { accountsQuery, transactionsQuery, profileQuery } from "@/lib/queries";
import { formatMoney, greeting } from "@/lib/format";
import { AccountIcon } from "@/components/AccountIcon";
import { AddTransactionSheet } from "@/components/AddTransactionSheet";
import { Fab } from "@/components/Fab";
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Users } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { UserAvatar } from "@/components/UserAvatar";
import { SwipeRow } from "@/components/SwipeRow";
import { toast } from "sonner";

export default function Home() {
  const [open, setOpen] = useState(false);
  const today = format(new Date(), "yyyy-MM-dd");
  const { data: accounts = [] } = useQuery(accountsQuery());
  const { data: txns = [] } = useQuery(transactionsQuery({ dateFrom: today, dateTo: today }));

  const [userId, setUserId] = useState<string | undefined>();
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id));
  }, []);
  const { data: profile } = useQuery(profileQuery(userId));

  const total = accounts.reduce((s, a) => s + Number(a.current_balance), 0);
  const displayName = profile?.full_name
    ? profile.full_name.split(/\s+/).slice(0, 2).join(" ")
    : "there";

  return (
    <div className="px-4 pt-6 space-y-5 pb-24">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{greeting()},</p>
          <h1 className="text-xl font-semibold">{displayName}</h1>
        </div>
        <Link to="/settings" aria-label="Profile">
          <UserAvatar url={profile?.avatar_url} name={profile?.full_name} size={40} />
        </Link>
      </div>

      <div className="balance-gradient rounded-2xl p-5 relative overflow-hidden">
        <p className="text-xs font-mono text-white/70 uppercase tracking-wider">Total Balance</p>
        <p className="text-xs font-mono text-white mt-1">LKR</p>
        <p className="text-4xl font-mono font-bold text-white tracking-tight">
          {total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2 px-1">Accounts</p>
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x">
          {accounts.map((a) => (
            <div key={a.id} className="surface-card min-w-[180px] p-3 snap-start">
              <AccountIcon iconType={a.icon_type} iconName={a.icon_name} iconColor={a.icon_color} iconUrl={a.icon_url} size={36} />
              <p className="text-xs text-muted-foreground mt-2 truncate">
                {[a.institution, a.label].filter(Boolean).join(" · ") || a.label}
              </p>
              <p className="font-mono text-base font-semibold mt-0.5">{formatMoney(a.current_balance)}</p>
            </div>
          ))}
          {accounts.length === 0 && (
            <p className="text-sm text-muted-foreground py-4">No accounts yet</p>
          )}
        </div>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2 px-1">Today's Transactions</p>
        <div className="surface-card overflow-hidden">
          {txns.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10 px-4">
              No transactions today. Tap + to add one.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {txns.map((t: any) => <TxRow key={t.id} t={t} />)}
            </div>
          )}
        </div>
      </div>

      <Fab onClick={() => setOpen(true)} />
      <AddTransactionSheet open={open} onOpenChange={setOpen} />
    </div>
  );
}

function TxRow({ t }: { t: any }) {
  const qc = useQueryClient();

  async function del() {
    if (!confirm("Delete this transaction?")) return;
    const { error } = await supabase.from("transactions").delete().eq("id", t.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["transactions"] });
    qc.invalidateQueries({ queryKey: ["accounts"] });
  }

  async function edit() {
    const note = window.prompt("Edit note", t.note ?? "");
    if (note === null) return;
    const { error } = await supabase.from("transactions").update({ note }).eq("id", t.id);
    if (error) return toast.error(error.message);
    toast.success("Updated");
    qc.invalidateQueries({ queryKey: ["transactions"] });
  }

  return (
    <SwipeRow onEdit={edit} onDelete={del}>
      <TxRowInner t={t} />
    </SwipeRow>
  );
}

function TxRowInner({ t }: { t: any }) {
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
    <div className="flex items-center gap-3 p-4">
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
