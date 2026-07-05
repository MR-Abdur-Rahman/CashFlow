import { useState, useEffect, useMemo } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { accountsQuery } from "@/lib/queries";
import { methodToAccountType } from "@/lib/settlement";
import { toast } from "sonner";
import { notifyToast } from "@/lib/notify";
import { formatMoney } from "@/lib/format";

type UnsettledItem = {
  shareId: string;
  splitId: string;
  description: string;
  date: string;
  time?: string;      // split time (minute precision) — FIFO primary order
  createdAt?: string; // split created_at (has seconds/ms) — FIFO tiebreaker for same-minute debts
  shareAmount: number;
  paidAmount: number;
  remaining: number;
  // true = the viewer owes on this share; false = the other party owes. Used to settle only
  // the direction the viewer actually owes (a bilateral relationship can have both).
  viewerOwes?: boolean;
};

export function SettleUpDialog({
  open,
  onOpenChange,
  personId,
  personName,
  personLinkedUserId,
  netBalance,
  unsettledItems,
  // Legacy single-share support (group member "Settle up" button)
  share,
  split,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  personId?: string;
  personName?: string;
  // The other party's auth user id (when they're a linked CashFlow user). Used so BOTH
  // directions prompt the other party for their account selection.
  personLinkedUserId?: string | null;
  // Viewer-relative net balance: negative = viewer owes (paying out, red), positive =
  // viewer is owed (receiving, green).
  netBalance?: number;
  unsettledItems?: UnsettledItem[];
  share?: { id: string; share_amount: number; person_name: string };
  split?: { id: string; description: string };
}) {
  const iOwe = netBalance == null ? true : netBalance < 0;
  const qc = useQueryClient();
  const { data: accounts = [] } = useQuery(accountsQuery());
  const [method, setMethod] = useState<"cash" | "bank_transfer" | "e-wallet">("cash");
  const [accountId, setAccountId] = useState("");
  const [note, setNote] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");

  const filteredAccounts = useMemo(
    () => (accounts as any[]).filter((a) => a.type === methodToAccountType[method]),
    [accounts, method]
  );

  // Normalize both callers (multi unsettledItems + legacy single share) into one list.
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

  // Only the shares in the direction the viewer actually owes/is-owed are settleable here.
  // (A bilateral relationship can hold debts both ways; those net out — you settle the net.)
  const dirItems = useMemo(
    () => items.filter((i) => i.viewerOwes === undefined || i.viewerOwes === iOwe),
    [items, iOwe]
  );
  const grossOwed = useMemo(
    () => dirItems.reduce((s, i) => s + Math.max(0, i.remaining), 0),
    [dirItems]
  );
  // The amount you settle is the NET balance (both users agree on it), not the gross of one
  // side's shares. Fall back to the gross when no net is provided (group legacy caller).
  const netOwed = netBalance != null ? Math.abs(netBalance) : grossOwed;

  // Default the amount to the full net owed each time the sheet opens.
  useEffect(() => {
    if (open) setAmount(netOwed > 0 ? netOwed.toFixed(2) : "");
  }, [open, netOwed]);

  useEffect(() => {
    setAccountId((filteredAccounts as any[])[0]?.id ?? "");
  }, [filteredAccounts]);

  const amountNum = Number(amount) || 0;
  const overpaying = amountNum > netOwed + 0.005;

  const mutation = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      if (amountNum <= 0) throw new Error("Enter an amount greater than 0");

      // Net-balance settle: allocate the entered amount across the unsettled shares
      // OLDEST-FIRST (FIFO), creating a settlement per share consumed. The user no longer
      // picks individual splits — they just settle the overall amount owed. (This also
      // implements the FIFO-allocation behaviour.)
      // Order oldest-first by the debt's date+time (minute precision), breaking same-minute ties
      // with the split's created_at (has seconds/ms) so genuine creation order wins.
      const key = (i: UnsettledItem) => `${i.date ?? ""}T${i.time ?? "00:00:00"}|${i.createdAt ?? ""}`;
      const sorted = [...dirItems]
        .filter((i) => i.remaining > 0.005)
        .sort((a, b) => key(a).localeCompare(key(b)));

      let remaining = Math.min(amountNum, netOwed + 0.005);
      let settledAny = false;
      for (const item of sorted) {
        if (remaining <= 0.005) break;
        const alloc = Math.min(remaining, item.remaining);
        if (alloc <= 0.005) continue;

        // Resolve the split's CREDITOR (whoever PAID it) to decide direction. When the settler
        // is the DEBTOR paying a remote creditor, pending_for_user_id flags it so the balance
        // trigger debits the payer's account and the creditor confirms which account received it.
        // Keying off created_by instead of the payer would reverse the direction (see the
        // settlement-direction fix).
        const { data: splitData } = await supabase
          .from("splits")
          .select("created_by, paid_by, paid_by_person_id, paid_by_person:paid_by_person_id(linked_user_id)")
          .eq("id", item.splitId).maybeSingle();
        let creditorId: string | null = null;
        if (splitData) {
          if (splitData.paid_by_person_id) creditorId = (splitData as any).paid_by_person?.linked_user_id ?? null;
          else if (splitData.paid_by === "me") creditorId = splitData.created_by;
        }
        // Is the SETTLER the creditor (recording a receipt) or the debtor (paying out)?
        // This drives the balance-trigger sign for the settler's own account.
        const settlerIsCreditor = !!creditorId && creditorId === u.user.id;
        // The prompted (other) party is the target person in this bilateral settle — prompted in
        // BOTH directions so their account is recorded (creditor: +receipt, debtor: -payment).
        // Prefer the explicit linked id; fall back to the resolved creditor when we're the debtor.
        const otherUid = (personLinkedUserId && personLinkedUserId !== u.user.id)
          ? personLinkedUserId
          : (!settlerIsCreditor && creditorId && creditorId !== u.user.id ? creditorId : null);

        const { error } = await supabase.from("settlements").insert({
          split_id: item.splitId,
          split_share_id: item.shareId,
          amount: alloc,
          method,
          account_id: accountId || null,
          note: note || null,
          description: description.trim() || null,
          created_by: u.user.id,
          settler_is_creditor: settlerIsCreditor,
          receiver_account_pending: !!otherUid,
          pending_for_user_id: otherUid,
        } as any);
        if (error) throw error;

        const totalSettled = item.paidAmount + alloc;
        const fullySettled = totalSettled >= item.shareAmount - 0.005;
        await supabase.from("split_shares").update({
          is_settled: fullySettled,
          ...(fullySettled ? { settled_at: new Date().toISOString() } : {}),
        }).eq("id", item.shareId);

        remaining -= alloc;
        settledAny = true;
      }

      if (!settledAny) throw new Error("Nothing to settle");
    },
    onSuccess: () => {
      notifyToast("settlement_created", "Settled successfully");
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
      <SheetContent side="bottom" className="bg-card border-border rounded-t-3xl p-0 max-h-[80dvh] flex flex-col">
        <SheetTitle className="sr-only">Settle Up</SheetTitle>
        <div className="px-5 pt-5 pb-3 border-b border-border">
          <p className="text-base font-semibold">Settle Up{personName ? ` — ${personName}` : ""}</p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Net balance summary — red when you owe (paying out), green when you lent (receiving) */}
          <div className="rounded-xl bg-secondary/50 px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{iOwe ? "You owe" : "You lent"}</span>
            <span className={`text-lg font-mono font-semibold ${iOwe ? "text-expense" : "text-income"}`}>{formatMoney(netOwed)}</span>
          </div>

          {/* Amount to settle */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Amount to settle</Label>
              {netOwed > 0 && amountNum < netOwed - 0.005 && (
                <button type="button" onClick={() => setAmount(netOwed.toFixed(2))}
                  className="text-[11px] text-primary underline">Full amount</button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-mono">LKR</span>
              <input
                type="number" inputMode="decimal" value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={`flex-1 bg-secondary rounded-md px-3 py-2 text-sm text-right font-mono font-semibold outline-none border border-border focus:border-primary ${iOwe ? "text-expense" : "text-income"}`}
              />
            </div>
            {overpaying ? (
              <p className="text-[11px] text-expense">More than owed — will be capped at {formatMoney(netOwed)}.</p>
            ) : (
              <p className="text-[11px] text-muted-foreground">Oldest debts are settled first.</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Paid via bank, Coffee money" />
          </div>

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
            if (!amountNum || isNaN(amountNum) || amountNum <= 0) {
              toast.error("Please enter a valid amount greater than 0");
              return;
            }
            mutation.mutate();
          }} disabled={mutation.isPending || netOwed <= 0}>
            {mutation.isPending ? "Settling..." : `Confirm${amountNum > 0 ? " — " + formatMoney(Math.min(amountNum, netOwed)) : ""}`}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
