import { useState } from "react";
import { formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { SettleUpDialog } from "./SettleUpDialog";
import { CheckCircle2 } from "lucide-react";

export function ShareList({ splits, personId }: { splits: any[]; personId?: string }) {
  const [settle, setSettle] = useState<{ share: any; split: any } | null>(null);
  if (splits.length === 0) return <div className="surface-card p-6 text-center text-sm text-muted-foreground">No splits yet</div>;
  return (
    <div className="space-y-3">
      {splits.map((s) => {
        const shares = (s.split_shares ?? []).filter((sh: any) => !personId || sh.person_id === personId);
        const settlements = s.settlements ?? [];
        return (
          <div key={s.id} className="surface-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{s.description}</p>
                <p className="text-xs text-muted-foreground font-mono">{s.date} · paid by {s.paid_by}</p>
              </div>
              <p className="text-sm font-mono font-semibold">{formatMoney(s.total_amount)}</p>
            </div>
            <ul className="space-y-1.5">
              {shares.map((sh: any) => {
                const paid = settlements.filter((x: any) => x.split_share_id === sh.id).reduce((a: number, x: any) => a + Number(x.amount), 0);
                const remaining = Number(sh.share_amount) - paid;
                const isSettled = sh.is_settled || remaining <= 0.005;
                return (
                  <li key={sh.id} className="flex items-center gap-2 text-xs">
                    <span className="flex-1 truncate">{sh.person_name}</span>
                    <span className="font-mono">{formatMoney(sh.share_amount)}</span>
                    {isSettled ? (
                      <span className="text-income inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Settled</span>
                    ) : (
                      <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => setSettle({ share: sh, split: s })}>Settle</Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
      {settle && <SettleUpDialog open={true} onOpenChange={(o) => !o && setSettle(null)} share={settle.share} split={settle.split} />}
    </div>
  );
}
