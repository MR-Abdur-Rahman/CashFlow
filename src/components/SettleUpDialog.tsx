import { useState, useEffect, useMemo } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { accountsQuery } from "@/lib/queries";
import { toast } from "sonner";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

type UnsettledItem = {
  shareId: string;
  splitId: string;
  description: string;
  date: string;
  shareAmount: number;
  paidAmount: number;
  remaining: number;
};

export function SettleUpDialog({
  open,
  onOpenChange,
  personId,
  personName,
  unsettledItems,
  // Legacy single-share support
  share,
  split,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  personId?: string;
  personName?: string;
  unsettledItems?: UnsettledItem[];
  share?: { id: string; share_amount: number; person_name: string };
  split?: { id: string; description: string };
}) {
  const qc = useQueryClient();
  const { data: accounts = [] } = useQuery(accountsQuery());
  const [method, setMethod] = useState<"cash" | "bank_transfer" | "e-wallet">("cash");
  const [accountId, setAccountId] = useState("");
  const [note, setNote] = useState("");

  const methodToAccountType: Record<string, string> = {
    cash: "cash",
    bank_transfer: "bank",
    "e-wallet": "e-wallet",
  };

  const filteredAccounts = useMemo(
    () => (accounts as any[]).filter((a) => a.type === methodToAccountType[method]),
    [accounts, method]
  );

  // Build items list — support both multi and legacy single
  const items: UnsettledItem[] = useMemo(() => {
    if (unsettledItems && unsettledItems.length > 0) return unsettledItems;
    if (share && split) {
      return [{
        shareId: share.id,
        splitId: split.id,
        description: split.description || "Split",
        date: "",
        shareAmount: Number(share.share_amount),
        paidAmount: 0,
        remaining: Number(share.share_amount),
      }];
    }
    return [];
  }, [unsettledItems, share, split]);

  // Selected items with custom amounts
  const [selected, setSelected] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open && items.length > 0) {
      // Auto-select all with remaining amounts
      const init: Record<string, string> = {};
      items.forEach((item) => { init[item.shareId] = String(item.remaining.toFixed(2)); });
      setSelected(init);
    }
  }, [open, items]);

  useEffect(() => {
    setAccountId((filteredAccounts as any[])[0]?.id ?? "");
  }, [filteredAccounts]);

  const totalSettling = Object.values(selected)
    .filter((_, i) => Object.keys(selected)[i] !== undefined)
    .reduce((s, v) => s + (Number(v) || 0), 0);

  function toggleItem(shareId: string, remaining: number) {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[shareId] !== undefined) {
        delete next[shareId];
      } else {
        next[shareId] = String(remaining.toFixed(2));
      }
      return next;
    });
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");

      const entries = Object.entries(selected).filter(([, v]) => Number(v) > 0);
      if (entries.length === 0) throw new Error("Select at least one split to settle");

      const today = new Date();
      const dateStr = today.toISOString().split("T")[0];
      const timeStr = today.toTimeString().split(" ")[0];

      for (const [shareId, amtStr] of entries) {
        const amt = Number(amtStr);
        const item = items.find((i) => i.shareId === shareId);
        if (!item) continue;

        const { error } = await supabase.from("settlements").insert({
          split_id: item.splitId,
          split_share_id: shareId,
          amount: amt,
          method,
          account_id: accountId || null,
          note: note || null,
          created_by: u.user.id,
        });
        if (error) throw error;

        if ((method === "bank_transfer" || method === "e-wallet") && accountId) {
          const txLabel = personName || item.description || "Split";
          const { error: txError } = await supabase.from("transactions").insert({
            type: "expense",
            amount: amt,
            account_id: accountId,
            note: `Settlement — ${txLabel}`,
            date: dateStr,
            time: timeStr,
            is_split: false,
            user_id: u.user.id,
          });
          if (txError) throw txError;
        }

        const totalSettled = item.paidAmount + amt;
        if (totalSettled >= item.shareAmount) {
          await supabase.from("split_shares").update({
            is_settled: true,
            settled_at: new Date().toISOString(),
          }).eq("id", shareId);
        } else {
          await supabase.from("split_shares").update({
            is_settled: false,
          }).eq("id", shareId);
        }

        // Notify split creator when settled via bank_transfer or e-wallet
        if (method === "bank_transfer" || method === "e-wallet") {
          const { data: splitData } = await supabase
            .from("splits").select("created_by").eq("id", item.splitId).maybeSingle();
          if (splitData && splitData.created_by !== u.user.id) {
            const { data: settlerProfile } = await supabase
              .from("profiles").select("full_name").eq("id", u.user.id).maybeSingle();
            const settlerName = settlerProfile?.full_name ?? personName ?? "Someone";
            await supabase.from("notifications").insert({
              user_id: splitData.created_by,
              type: "settlement_account_needed",
              title: "Settlement received",
              message: `${settlerName} settled LKR ${amt} — tap to select which account to credit`,
              related_split_id: item.splitId,
              is_read: false,
            });
          }
        }
      }
    },
    onSuccess: () => {
      toast.success("Settled successfully");
      qc.invalidateQueries({ queryKey: ["splits"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="bg-card border-border rounded-t-3xl p-0 h-[80dvh] flex flex-col">
        <SheetTitle className="sr-only">Settle Up</SheetTitle>
        <div className="px-5 pt-5 pb-3 border-b border-border">
          <p className="text-base font-semibold">Settle Up{personName ? ` — ${personName}` : ""}</p>
          {items.length > 1 && (
            <p className="text-xs text-muted-foreground mt-0.5">Select splits to settle</p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Split selection — only show if multiple */}
          {items.length > 1 && (
            <div className="space-y-2">
              <Label>Splits to settle</Label>
              <div className="rounded-xl overflow-hidden border border-border divide-y divide-border">
                {items.map((item) => {
                  const isSelected = selected[item.shareId] !== undefined;
                  return (
                    <div key={item.shareId}
                      onClick={() => toggleItem(item.shareId, item.remaining)}
                      className="flex items-center gap-3 px-4 py-3 bg-card cursor-pointer active:bg-secondary/40">
                      <div className={cn("h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                        isSelected ? "bg-primary border-primary" : "border-border")}>
                        {isSelected && <Check className="h-3 w-3 text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.description || "Split"}</p>
                        <p className="text-xs text-muted-foreground">{item.date}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Remaining</p>
                        <p className="text-sm font-mono font-semibold text-expense">{formatMoney(item.remaining)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Custom amounts per selected split */}
          {Object.keys(selected).length > 0 && (
            <div className="space-y-2">
              <Label>Amounts</Label>
              <div className="space-y-2">
                {items.filter((item) => selected[item.shareId] !== undefined).map((item) => (
                  <div key={item.shareId} className="flex items-center gap-3">
                    {items.length > 1 && (
                      <span className="text-sm flex-1 truncate text-muted-foreground">{item.description || "Split"}</span>
                    )}
                    {items.length === 1 && (
                      <span className="text-sm flex-1 text-muted-foreground">
                        {item.description || "Split"} · remaining {formatMoney(item.remaining)}
                      </span>
                    )}
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground font-mono">LKR</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={selected[item.shareId] ?? ""}
                        onChange={(e) => setSelected((prev) => ({ ...prev, [item.shareId]: e.target.value }))}
                        className="w-28 bg-secondary rounded-md px-2 py-1.5 text-sm text-right font-mono outline-none border border-border focus:border-primary"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Total */}
          {Object.keys(selected).length > 0 && (
            <div className="flex justify-between text-sm font-semibold px-1">
              <span>Total settling</span>
              <span className="font-mono text-income">{formatMoney(totalSettling)}</span>
            </div>
          )}

          {/* Method */}
          <div className="space-y-1.5">
            <Label>Method</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                <SelectItem value="e-wallet">E-wallet</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Account</Label>
            {(filteredAccounts as any[]).length === 0 ? (
              <p className="text-xs text-muted-foreground px-1 py-1">
                No {methodToAccountType[method]} accounts found — add one in the Accounts tab.
              </p>
            ) : (
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>
                  {(filteredAccounts as any[]).map((a) => (
                    <SelectItem key={a.id} value={a.id}>{[a.institution, a.label].filter(Boolean).join(" · ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Note (optional)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Paid via bank" />
          </div>
        </div>

        <div className="p-4 border-t border-border">
          <Button className="w-full bg-primary text-white" onClick={() => {
            if (!totalSettling || isNaN(totalSettling) || totalSettling <= 0) {
              toast.error("Please enter a valid amount greater than 0");
              return;
            }
            mutation.mutate();
          }} disabled={mutation.isPending || Object.keys(selected).length === 0}>
            {mutation.isPending ? "Settling..." : `Confirm${totalSettling > 0 ? " — " + formatMoney(totalSettling) : ""}`}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}