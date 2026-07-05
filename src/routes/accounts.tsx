import { useQuery } from "@tanstack/react-query";
import { accountsQuery } from "@/lib/queries";
import { AccountIcon } from "@/components/AccountIcon";
import { formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Plus, ChevronRight } from "lucide-react";
import { useState } from "react";
import { AddAccountSheet } from "@/components/AddAccountSheet";
import { Link } from "react-router-dom";

export default function AccountsPage() {
  const { data: accounts = [] } = useQuery(accountsQuery());
  const [open, setOpen] = useState(false);

  const total = accounts.reduce((s, a) => s + Number(a.current_balance), 0);
  const grouped = accounts.reduce<Record<string, Record<string, typeof accounts>>>((acc, a) => {
    const type = a.type;
    const inst = a.institution || "—";
    acc[type] ??= {};
    acc[type][inst] ??= [];
    acc[type][inst].push(a);
    return acc;
  }, {});

  return (
    <div className="px-4 pt-6 space-y-5 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Total balance</p>
          <p className="text-3xl font-mono font-bold">{formatMoney(total)}</p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>

      {Object.entries(grouped).map(([type, byInst]) => (
        <div key={type}>
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2 px-1">{type}</p>
          <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden shadow-sm">
            {Object.entries(byInst).map(([inst, list]) => (
              <div key={inst} className="p-3">
                {inst !== "—" && <p className="text-xs text-muted-foreground mb-2">{inst}</p>}
                <ul className="space-y-1">
                  {list.map((a) => (
                    <li key={a.id}>
                      <Link
                        to={`/accounts/${a.id}`}
                        className="flex items-center gap-3 py-1.5 active:bg-secondary/40 rounded-md -mx-1 px-1"
                      >
                        <AccountIcon
                          iconType={a.icon_type}
                          iconName={a.icon_name}
                          iconColor={a.icon_color}
                          iconUrl={a.icon_url}
                          size={32}
                        />
                        <span className="flex-1 text-sm">{a.label}</span>
                        <span className="font-mono text-sm font-semibold">
                          {formatMoney(a.current_balance)}
                        </span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ))}

      <AddAccountSheet open={open} onOpenChange={setOpen} />
    </div>
  );
}
