import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { accountQuery, transactionsQuery } from "@/lib/queries";
import { AccountIcon } from "@/components/AccountIcon";
import { formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";
import { AddAccountSheet } from "@/components/AddAccountSheet";
import { ArrowLeft, Pencil, Trash2, ArrowDownLeft, ArrowUpRight, ArrowLeftRight } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Link, useNavigate, useParams } from "react-router-dom";

export default function AccountDetail() {
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: account } = useQuery(accountQuery(accountId!));
  const { data: txns = [] } = useQuery(transactionsQuery({ accountId }));
  const [edit, setEdit] = useState(false);

  const del = useMutation({
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
    <div className="px-4 pt-4 pb-24 space-y-5">
      <Link to="/accounts" className="inline-flex items-center text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4 mr-1" /> Accounts
      </Link>
      <div className="flex items-center gap-4">
        <AccountIcon iconType={account.icon_type} iconName={account.icon_name} iconColor={account.icon_color} iconUrl={account.icon_url} size={56} />
        <div className="flex-1">
          <p className="text-xs uppercase text-muted-foreground">{account.type}{account.institution && ` · ${account.institution}`}</p>
          <h1 className="text-lg font-semibold">{account.label}</h1>
        </div>
      </div>

      <div className="surface-card p-4">
        <p className="text-xs text-muted-foreground">Current balance</p>
        <p className="text-3xl font-mono font-bold mt-1">{formatMoney(account.current_balance)}</p>
        <p className="text-xs text-muted-foreground mt-1">Opening: {formatMoney(account.opening_balance)}</p>
      </div>

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
                {txns.length > 0 ? `This account has ${txns.length} transactions and cannot be deleted.` : "This cannot be undone."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction disabled={txns.length > 0} onClick={() => del.mutate()}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2 px-1">Transactions</p>
        <div className="surface-card">
          {txns.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No transactions yet</p>
          ) : (
            <ul className="divide-y divide-border">
              {txns.map((t: any) => <TxRow key={t.id} t={t} accountId={accountId!} />)}
            </ul>
          )}
        </div>
      </div>

      <AddAccountSheet open={edit} onOpenChange={setEdit} edit={account} />
    </div>
  );
}

function TxRow({ t, accountId }: { t: any; accountId: string }) {
  const isIncome = t.type === "income";
  const isExpense = t.type === "expense";
  const isTransfer = t.type === "transfer";
  const isOutgoingTransfer = isTransfer && t.account_id === accountId;
  const colorClass = isIncome || (isTransfer && !isOutgoingTransfer) ? "text-income" : "text-expense";
  const sign = isIncome || (isTransfer && !isOutgoingTransfer) ? "+" : "-";
  const Icon = isIncome ? ArrowDownLeft : isExpense ? ArrowUpRight : ArrowLeftRight;
  const title = t.categories ? `${t.categories.icon ?? ""} ${t.categories.name}` : isIncome ? (t.income_source_text ?? "Income") : isTransfer ? "Transfer" : "Expense";

  return (
    <li className="flex items-center gap-3 p-3">
      <div className={`h-9 w-9 rounded-full bg-secondary flex items-center justify-center ${colorClass}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate">{title}</p>
        <p className="text-[10px] text-muted-foreground font-mono">{t.date} {t.time?.slice(0, 5)}</p>
      </div>
      <p className={`text-sm font-mono font-semibold ${colorClass}`}>{sign}{formatMoney(t.amount)}</p>
    </li>
  );
}