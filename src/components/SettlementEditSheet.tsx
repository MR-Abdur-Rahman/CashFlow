import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { accountsQuery } from "@/lib/queries";
import { toast } from "sonner";
import { format } from "date-fns";

export function SettlementEditSheet({
  settlement,
  open,
  onOpenChange,
}: {
  settlement: any;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const { data: accounts = [] } = useQuery(accountsQuery());

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"cash" | "bank_transfer">("cash");
  const [accountId, setAccountId] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState("");

  useEffect(() => {
    if (open && settlement) {
      setAmount(String(settlement.amount));
      setMethod(settlement.method === "bank_transfer" ? "bank_transfer" : "cash");
      setAccountId(settlement.account_id ?? "");
      setNote(settlement.note ?? "");
      setDate(
        settlement.created_at
          ? settlement.created_at.split("T")[0]
          : format(new Date(), "yyyy-MM-dd")
      );
    }
  }, [open, settlement]);

  const bankAccounts = (accounts as any[]).filter((a) => a.type === "bank");

  const mutation = useMutation({
    mutationFn: async () => {
      const timeStr = settlement.created_at?.split("T")[1] ?? "00:00:00";
      const newCreatedAt = `${date}T${timeStr}`;
      const { error } = await supabase
        .from("settlements")
        .update({
          amount: Number(amount),
          method,
          account_id: method === "bank_transfer" && accountId ? accountId : settlement.account_id,
          note: note || null,
          created_at: newCreatedAt,
        })
        .eq("id", settlement.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Settlement updated");
      qc.invalidateQueries({ queryKey: ["settlements"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="bg-card border-border rounded-t-3xl p-0 flex flex-col max-h-[90dvh]"
      >
        <SheetTitle className="sr-only">Edit Settlement</SheetTitle>
        <div className="px-5 pt-5 pb-3 border-b border-border shrink-0">
          <p className="text-base font-semibold">Edit Settlement</p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="space-y-1.5">
            <Label>Amount</Label>
            <Input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Method</Label>
            <div className="flex gap-2">
              {(["cash", "bank_transfer"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMethod(m);
                    if (m !== "bank_transfer") setAccountId("");
                  }}
                  className="flex-1 py-2 text-sm font-medium rounded-lg transition-colors"
                  style={
                    method === m
                      ? { background: "#1A1A1A", color: "white", border: "1px solid #7C3AED" }
                      : { background: "#2A2A2A", color: "#9CA3AF", border: "1px solid transparent" }
                  }
                >
                  {m === "cash" ? "Cash" : "Bank Transfer"}
                </button>
              ))}
            </div>
          </div>

          {method === "bank_transfer" && (
            <div className="space-y-1.5">
              <Label>Account</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((a: any) => (
                    <SelectItem key={a.id} value={a.id}>
                      {[a.institution, a.label].filter(Boolean).join(" · ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Date</Label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Note</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Optional note"
            />
          </div>
        </div>

        <div className="p-4 border-t border-border shrink-0">
          <Button
            className="w-full text-white"
            style={{ background: "#10B981" }}
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !amount || Number(amount) <= 0}
          >
            {mutation.isPending ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
