import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { scheduledTransactionsQuery, accountsQuery } from "@/lib/queries";
import {
  isDue,
  postScheduled,
  skipScheduled,
  currentCycleDueDate,
  type Scheduled,
} from "@/lib/scheduled";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

// Shown once per session when scheduled transactions are due (their day-of-month + time has passed
// this month and they haven't been posted/skipped yet). Confirm records the real transaction; Skip
// stamps the cycle so it won't ask again until next month.
export function ScheduledDuePrompt() {
  const qc = useQueryClient();
  const { data: list = [] } = useQuery(scheduledTransactionsQuery());
  const { data: accounts = [] } = useQuery(accountsQuery());
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const due = useMemo(() => (list as Scheduled[]).filter((s) => isDue(s)), [list]);
  const open = !dismissed && due.length > 0;

  const accLabel = (id: string | null) =>
    (accounts as any[]).find((a) => a.id === id)?.label ?? "—";

  async function confirm(s: Scheduled) {
    setBusy(s.id);
    try {
      await postScheduled(s);
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["scheduled_transactions"] });
      toast.success("Transaction recorded");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  }

  async function skip(s: Scheduled) {
    setBusy(s.id);
    try {
      await skipScheduled(s);
      qc.invalidateQueries({ queryKey: ["scheduled_transactions"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && setDismissed(true)}>
      <DialogContent className="max-w-sm">
        <DialogTitle>Scheduled transactions due</DialogTitle>
        <DialogDescription>Confirm to record them, or skip this month.</DialogDescription>
        <div className="mt-1 max-h-[60vh] space-y-2 overflow-y-auto">
          {due.map((s) => {
            const color =
              s.type === "income"
                ? "text-income"
                : s.type === "transfer"
                  ? "text-transfer"
                  : "text-expense";
            return (
              <div key={s.id} className="rounded-xl border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium">
                    {s.note || s.type[0].toUpperCase() + s.type.slice(1)}
                  </p>
                  <span className={cn("shrink-0 text-sm font-semibold", color)}>
                    {formatMoney(Number(s.amount))}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {s.type === "transfer"
                    ? `${accLabel(s.account_id)} → ${accLabel(s.to_account_id)}`
                    : accLabel(s.account_id)}{" "}
                  · {currentCycleDueDate(s)}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Button variant="ghost" size="sm" disabled={busy === s.id} onClick={() => skip(s)}>
                    Skip
                  </Button>
                  <Button size="sm" disabled={busy === s.id} onClick={() => confirm(s)}>
                    Confirm
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
