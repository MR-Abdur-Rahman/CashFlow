import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { accountsQuery } from "@/lib/queries";
import { AccountIcon } from "@/components/AccountIcon";
import { formatMoney } from "@/lib/format";
import { Plus, ChevronRight } from "lucide-react";
import { useState } from "react";
import { AddAccountSheet } from "@/components/AddAccountSheet";
import { SwipeRow } from "@/components/SwipeRow";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link } from "react-router-dom";

export default function AccountsPage() {
  const { data: accounts = [] } = useQuery(accountsQuery());
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editAccount, setEditAccount] = useState<any>(null);

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  const total = accounts.reduce((s, a) => s + Number(a.current_balance), 0);
  const grouped = accounts.reduce<Record<string, typeof accounts>>((acc, a) => {
    (acc[a.type] ??= []).push(a);
    return acc;
  }, {});

  return (
    <div className="px-4 pt-6 space-y-5 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Total balance</p>
          <p className="text-3xl font-mono font-bold">{formatMoney(total)}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditAccount(null);
            setOpen(true);
          }}
          aria-label="Add account"
          className="h-10 w-10 shrink-0 rounded-lg bg-primary text-white grid place-items-center active:opacity-80"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      {Object.entries(grouped).map(([type, list]) => (
        <div key={type}>
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2 px-1">{type}</p>
          <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden shadow-sm">
            {list.map((a) => (
              <SwipeRow
                key={a.id}
                onEdit={() => {
                  setEditAccount(a);
                  setOpen(true);
                }}
                onDelete={() => {
                  if (confirm("Delete account?")) del.mutate(a.id);
                }}
              >
                <Link
                  to={`/accounts/${a.id}`}
                  className="flex items-center gap-3 p-3 bg-card active:bg-secondary/40"
                >
                  <AccountIcon
                    iconType={a.icon_type}
                    iconName={a.icon_name}
                    iconColor={a.icon_color}
                    iconUrl={a.icon_url}
                    size={36}
                  />
                  <p className="flex-1 min-w-0 text-sm truncate">
                    {[a.institution, a.label].filter(Boolean).join(" · ") || a.label}
                  </p>
                  <span className="font-mono text-sm font-semibold shrink-0">
                    {formatMoney(a.current_balance)}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </Link>
              </SwipeRow>
            ))}
          </div>
        </div>
      ))}

      <AddAccountSheet open={open} onOpenChange={setOpen} edit={editAccount} />
    </div>
  );
}
