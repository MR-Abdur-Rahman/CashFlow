import { useState, useEffect, useMemo } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { accountsQuery } from "@/lib/queries";
import { methodToAccountType } from "@/lib/settlement";
import { toast } from "sonner";
import { notifyToast } from "@/lib/notify";
import { formatMoney } from "@/lib/format";

// Bin model: a settlement is a single person-to-person payment against the NET balance — not an
// allocation across individual splits. One payment = one settlement row.
export function SettleUpDialog({
  open,
  onOpenChange,
  personId,
  personName,
  personLinkedUserId,
  netBalance,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  // The counterparty's people-record id (stored on the settlement so it belongs to the bin).
  personId?: string;
  personName?: string;
  // The other party's auth user id (when they're a linked CashFlow user). Set so the other party
  // is prompted to confirm which account the money moved on.
  personLinkedUserId?: string | null;
  // Viewer-relative net balance: negative = viewer owes (paying out, red), positive = viewer is
  // owed (receiving, green).
  netBalance?: number;
}) {
  const iOwe = netBalance == null ? true : netBalance < 0;
  const netOwed = netBalance != null ? Math.abs(netBalance) : 0;
  const qc = useQueryClient();
  const { data: accounts = [] } = useQuery(accountsQuery());
  const [method, setMethod] = useState<"cash" | "bank_transfer" | "e-wallet">("cash");
  const [accountId, setAccountId] = useState("");
  const [note, setNote] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");

  const filteredAccounts = useMemo(
    () => (accounts as any[]).filter((a) => a.type === methodToAccountType[method]),
    [accounts, method],
  );

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

      // Record ONE settlement against the net. Direction from the net sign: viewer is owed →
      // creditor recording a receipt (+ own account); viewer owes → debtor paying out (− own
      // account). The other party (when linked) is prompted to confirm their account.
      const settleAmount = Math.min(amountNum, netOwed);
      const settlerIsCreditor = !iOwe;
      const otherUid =
        personLinkedUserId && personLinkedUserId !== u.user.id ? personLinkedUserId : null;

      const { error } = await supabase.from("settlements").insert({
        person_id: personId ?? null,
        split_id: null,
        split_share_id: null,
        amount: settleAmount,
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
    },
    onSuccess: () => {
      notifyToast("settlement_created", "Settled successfully");
      qc.invalidateQueries({ queryKey: ["splits"] });
      qc.invalidateQueries({ queryKey: ["settlements"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="bg-card border-border rounded-t-3xl p-0 max-h-[80dvh] flex flex-col"
      >
        <SheetTitle className="sr-only">Settle Up</SheetTitle>
        <div className="px-5 pt-5 pb-3 border-b border-border">
          <p className="text-base font-semibold">Settle Up{personName ? ` — ${personName}` : ""}</p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Net balance summary — red when you owe (paying out), green when you lent (receiving) */}
          <div className="rounded-xl bg-secondary/50 px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{iOwe ? "You owe" : "You lent"}</span>
            <span
              className={`text-lg font-mono font-semibold ${iOwe ? "text-expense" : "text-income"}`}
            >
              {formatMoney(netOwed)}
            </span>
          </div>

          {/* Amount to settle */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Amount to settle</Label>
              {netOwed > 0 && amountNum < netOwed - 0.005 && (
                <button
                  type="button"
                  onClick={() => setAmount(netOwed.toFixed(2))}
                  className="text-[11px] text-primary underline"
                >
                  Full amount
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-mono">LKR</span>
              <input
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={`flex-1 bg-secondary rounded-md px-3 py-2 text-sm text-right font-mono font-semibold outline-none border border-border focus:border-primary ${iOwe ? "text-expense" : "text-income"}`}
              />
            </div>
            {overpaying ? (
              <p className="text-[11px] text-expense">
                More than the net — will be capped at {formatMoney(netOwed)}.
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Records a payment against your net balance.
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Paid via bank, Coffee money"
            />
          </div>

          {/* Method */}
          <div className="space-y-1.5">
            <Label>Method</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
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
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {(filteredAccounts as any[]).map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {[a.institution, a.label].filter(Boolean).join(" · ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Note (optional)</Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Paid via bank"
            />
          </div>
        </div>

        <div className="p-4 border-t border-border">
          <Button
            className="w-full bg-primary text-white"
            onClick={() => {
              if (!amountNum || isNaN(amountNum) || amountNum <= 0) {
                toast.error("Please enter a valid amount greater than 0");
                return;
              }
              mutation.mutate();
            }}
            disabled={mutation.isPending || netOwed <= 0}
          >
            {mutation.isPending
              ? "Settling..."
              : `Confirm${amountNum > 0 ? " — " + formatMoney(Math.min(amountNum, netOwed)) : ""}`}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
