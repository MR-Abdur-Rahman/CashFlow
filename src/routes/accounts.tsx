import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { accountsQuery, notificationsQuery } from "@/lib/queries";
import { AccountIcon } from "@/components/AccountIcon";
import { formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, ChevronRight, ChevronLeft, ChevronDown } from "lucide-react";
import { useState, useMemo } from "react";
import { AddAccountSheet } from "@/components/AddAccountSheet";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "react-router-dom";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  startOfYear, endOfYear, subMonths, addMonths, subWeeks, addWeeks, subYears, addYears,
} from "date-fns";

type Period = "weekly" | "monthly" | "annually";

function getPeriodRange(period: Period, anchor: Date) {
  if (period === "weekly") return { from: startOfWeek(anchor, { weekStartsOn: 1 }), to: endOfWeek(anchor, { weekStartsOn: 1 }) };
  if (period === "monthly") return { from: startOfMonth(anchor), to: endOfMonth(anchor) };
  return { from: startOfYear(anchor), to: endOfYear(anchor) };
}

function navigateAnchor(period: Period, anchor: Date, dir: -1 | 1): Date {
  if (period === "weekly") return dir === -1 ? subWeeks(anchor, 1) : addWeeks(anchor, 1);
  if (period === "monthly") return dir === -1 ? subMonths(anchor, 1) : addMonths(anchor, 1);
  return dir === -1 ? subYears(anchor, 1) : addYears(anchor, 1);
}

function formatAnchorLabel(period: Period, anchor: Date) {
  if (period === "weekly") return `${format(startOfWeek(anchor, { weekStartsOn: 1 }), "MMM d")} – ${format(endOfWeek(anchor, { weekStartsOn: 1 }), "MMM d, yyyy")}`;
  if (period === "monthly") return format(anchor, "MMM yyyy");
  return format(anchor, "yyyy");
}

function parseSettlementNotif(message: string) {
  const parts = message.split(" settled LKR ");
  const personName = parts[0] ?? "Someone";
  const rest = parts[1] ?? "";
  const amtStr = rest.split(" —")[0];
  const amount = parseFloat(amtStr) || 0;
  return { personName, amount };
}

export default function AccountsPage() {
  const { data: accounts = [] } = useQuery(accountsQuery());
  const { data: notifications = [] } = useQuery(notificationsQuery());
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  // Pending settlements state
  const [psPeriod, setPsPeriod] = useState<Period>("monthly");
  const [psAnchor, setPsAnchor] = useState(new Date());
  const [psSearch, setPsSearch] = useState("");
  const [selectedNotif, setSelectedNotif] = useState<any | null>(null);

  const total = accounts.reduce((s, a) => s + Number(a.current_balance), 0);
  const grouped = accounts.reduce<Record<string, Record<string, typeof accounts>>>((acc, a) => {
    const type = a.type;
    const inst = a.institution || "—";
    acc[type] ??= {};
    acc[type][inst] ??= [];
    acc[type][inst].push(a);
    return acc;
  }, {});

  const { from: psFrom, to: psTo } = useMemo(
    () => getPeriodRange(psPeriod, psAnchor),
    [psPeriod, psAnchor]
  );

  const pendingSettlements = useMemo(() => {
    return (notifications as any[]).filter((n) => {
      if (n.type !== "settlement_account_needed" || n.is_read) return false;
      const d = new Date(n.created_at);
      if (d < psFrom || d > psTo) return false;
      if (psSearch) return n.message.toLowerCase().includes(psSearch.toLowerCase());
      return true;
    });
  }, [notifications, psFrom, psTo, psSearch]);

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
                        <AccountIcon iconType={a.icon_type} iconName={a.icon_name} iconColor={a.icon_color} iconUrl={a.icon_url} size={32} />
                        <span className="flex-1 text-sm">{a.label}</span>
                        <span className="font-mono text-sm font-semibold">{formatMoney(a.current_balance)}</span>
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

      {/* ── Pending Settlements ─────────────────────────────────────── */}
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3 px-1">Pending Settlements</p>

        {/* Time selector */}
        <div className="flex items-center gap-2 mb-3">
          <button onClick={() => setPsAnchor((a) => navigateAnchor(psPeriod, a, -1))} className="p-1 rounded-md hover:bg-secondary">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold">{formatAnchorLabel(psPeriod, psAnchor)}</span>
          <button onClick={() => setPsAnchor((a) => navigateAnchor(psPeriod, a, 1))} className="p-1 rounded-md hover:bg-secondary">
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 bg-primary text-white text-sm font-medium px-3 py-1.5 rounded-xl capitalize">
                  {psPeriod} <ChevronDown className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36">
                {(["weekly", "monthly", "annually"] as Period[]).map((p) => (
                  <DropdownMenuItem key={p} onClick={() => { setPsPeriod(p); setPsAnchor(new Date()); }}
                    className={`capitalize py-3 text-base ${psPeriod === p ? "text-primary font-medium" : ""}`}>
                    {p}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Search */}
        <Input
          placeholder="Search by person or amount..."
          value={psSearch}
          onChange={(e) => setPsSearch(e.target.value)}
          className="mb-3"
        />

        {pendingSettlements.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            No pending settlements
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden border border-border divide-y divide-border">
            {pendingSettlements.map((n: any) => {
              const { personName, amount } = parseSettlementNotif(n.message);
              const date = format(new Date(n.created_at), "MMM d, yyyy");
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => setSelectedNotif(n)}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-card active:bg-secondary/40 text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{personName}</p>
                    <p className="text-xs text-muted-foreground">{date}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-mono font-semibold text-income">+{formatMoney(amount)}</p>
                    <p className="text-xs text-muted-foreground">Tap to credit</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <AddAccountSheet open={open} onOpenChange={setOpen} />

      {selectedNotif && (
        <SelectAccountSheet
          notif={selectedNotif}
          accounts={accounts as any[]}
          open={!!selectedNotif}
          onOpenChange={(o) => { if (!o) setSelectedNotif(null); }}
          onDone={() => {
            qc.invalidateQueries({ queryKey: ["accounts"] });
            qc.invalidateQueries({ queryKey: ["transactions"] });
            qc.invalidateQueries({ queryKey: ["notifications"] });
            setSelectedNotif(null);
          }}
        />
      )}
    </div>
  );
}

function SelectAccountSheet({ notif, accounts, open, onOpenChange, onDone }: {
  notif: any;
  accounts: any[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDone: () => void;
}) {
  const { personName, amount } = parseSettlementNotif(notif.message);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");

  const mutation = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const today = new Date();
      const { error: txError } = await supabase.from("transactions").insert({
        type: "income",
        amount,
        account_id: accountId,
        note: `Settlement from ${personName}`,
        date: today.toISOString().split("T")[0],
        time: today.toTimeString().split(" ")[0],
        user_id: u.user.id,
      });
      if (txError) throw txError;
      await supabase.from("notifications").update({ is_read: true }).eq("id", notif.id);
    },
    onSuccess: () => {
      toast.success("Settlement recorded");
      onDone();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="bg-card border-border rounded-t-3xl p-0 flex flex-col">
        <SheetTitle className="sr-only">Record Settlement</SheetTitle>
        <div className="px-5 pt-5 pb-3 border-b border-border">
          <p className="text-base font-semibold">Settlement received</p>
          <p className="text-sm text-muted-foreground mt-0.5">
            {personName} · <span className="text-income font-mono">+{formatMoney(amount)}</span>
          </p>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="space-y-1.5">
            <Label>Credit to account</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {[a.institution, a.label].filter(Boolean).join(" · ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="p-4 border-t border-border">
          <Button
            className="w-full bg-primary text-white"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !accountId}
          >
            {mutation.isPending ? "Recording..." : `Record +${formatMoney(amount)}`}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
