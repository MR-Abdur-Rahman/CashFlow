import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { accountsQuery } from "@/lib/queries";
import { toast } from "sonner";

export function SettleUpDialog({ open, onOpenChange, share, split }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  share: { id: string; share_amount: number; person_name: string };
  split: { id: string; description: string };
}) {
  const qc = useQueryClient();
  const { data: accounts = [] } = useQuery(accountsQuery());
  const [amount, setAmount] = useState(String(share.share_amount));
  const [method, setMethod] = useState<"cash" | "bank_transfer">("cash");
  const [accountId, setAccountId] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (accounts[0]?.id) setAccountId(accounts[0].id);
  }, [accounts]);

  const mutation = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const amt = Number(amount);
      if (!amt) throw new Error("Enter an amount");
      const { error } = await supabase.from("settlements").insert({
        split_id: split.id, split_share_id: share.id, amount: amt, method,
        account_id: method === "bank_transfer" ? accountId : null,
        note: note || null, created_by: u.user.id,
      });
      if (error) throw error;
      if (amt >= Number(share.share_amount)) {
        await supabase.from("split_shares").update({ is_settled: true, settled_at: new Date().toISOString() }).eq("id", share.id);
      }
    },
    onSuccess: () => {
      toast.success("Settled");
      qc.invalidateQueries({ queryKey: ["splits"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Settle: {split.description}</DialogTitle>
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-3">
          <p className="text-xs text-muted-foreground">{share.person_name} owes {Number(share.share_amount).toFixed(2)}</p>
          <div className="space-y-1.5">
            <Label>Amount</Label>
            <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} />
          </div>
          <div className="space-y-1.5">
            <Label>Method</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="bank_transfer">Bank transfer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {method === "bank_transfer" && (
            <div className="space-y-1.5">
              <Label>Account</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{[a.institution, a.label].filter(Boolean).join(" · ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Note</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={mutation.isPending}>Confirm</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}