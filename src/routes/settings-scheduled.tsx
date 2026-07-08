import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  CalendarClock,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
} from "lucide-react";
import { SettingsHeader } from "@/components/SettingsRows";
import { Switch } from "@/components/ui/switch";
import { ScheduledTransactionSheet } from "@/components/ScheduledTransactionSheet";
import { scheduledTransactionsQuery, accountsQuery } from "@/lib/queries";
import { formatMoney } from "@/lib/format";
import { formatTime12 } from "@/components/TimePicker";
import { isDue, type Scheduled } from "@/lib/scheduled";
import { cn } from "@/lib/utils";

function typeMeta(t: string) {
  if (t === "income") return { Icon: ArrowDownLeft, color: "text-income" };
  if (t === "transfer") return { Icon: ArrowLeftRight, color: "text-transfer" };
  return { Icon: ArrowUpRight, color: "text-expense" };
}

export default function ScheduledPage() {
  const qc = useQueryClient();
  const { data: list = [] } = useQuery(scheduledTransactionsQuery());
  const { data: accounts = [] } = useQuery(accountsQuery());
  const [sheetOpen, setSheetOpen] = useState(false);
  const [edit, setEdit] = useState<Scheduled | null>(null);

  const accLabel = (id: string | null) =>
    (accounts as any[]).find((a) => a.id === id)?.label ?? "—";

  async function toggleActive(s: Scheduled, v: boolean) {
    const { error } = await supabase
      .from("scheduled_transactions")
      .update({ is_active: v } as never)
      .eq("id", s.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["scheduled_transactions"] });
  }

  async function remove(s: Scheduled) {
    if (!confirm("Delete this scheduled transaction?")) return;
    const { error } = await supabase.from("scheduled_transactions").delete().eq("id", s.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["scheduled_transactions"] });
    toast.success("Deleted");
  }

  const rows = list as Scheduled[];

  return (
    <div className="px-4 pt-6 pb-24 space-y-4">
      <SettingsHeader title="Scheduled" back="/settings" />

      <button
        onClick={() => {
          setEdit(null);
          setSheetOpen(true);
        }}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-medium text-white"
      >
        <Plus className="h-4 w-4" /> New scheduled transaction
      </button>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          <CalendarClock className="mx-auto mb-2 h-6 w-6 opacity-60" />
          No scheduled transactions yet. Set up recurring income, bills or transfers.
        </div>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {rows.map((s) => {
            const m = typeMeta(s.type);
            return (
              <div
                key={s.id}
                className={cn("flex items-center gap-3 p-4", !s.is_active && "opacity-50")}
              >
                <button
                  onClick={() => {
                    setEdit(s);
                    setSheetOpen(true);
                  }}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span
                    className={cn(
                      "grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary",
                      m.color,
                    )}
                  >
                    <m.Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                      {s.note || s.type[0].toUpperCase() + s.type.slice(1)}
                      {s.is_active && isDue(s) && (
                        <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                          Due
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      Day {s.day_of_month} · {formatTime12((s.scheduled_time ?? "09:00").slice(0, 5))}{" "}
                      ·{" "}
                      {s.type === "transfer"
                        ? `${accLabel(s.account_id)} → ${accLabel(s.to_account_id)}`
                        : accLabel(s.account_id)}
                    </p>
                  </div>
                  <span className={cn("shrink-0 text-sm font-semibold", m.color)}>
                    {formatMoney(Number(s.amount))}
                  </span>
                </button>
                <Switch checked={s.is_active} onCheckedChange={(v) => toggleActive(s, v)} />
                <button
                  onClick={() => remove(s)}
                  aria-label="Delete"
                  className="text-muted-foreground active:text-expense"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <ScheduledTransactionSheet open={sheetOpen} onOpenChange={setSheetOpen} edit={edit} />
    </div>
  );
}
