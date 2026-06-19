import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { personQuery, personSplitsQuery } from "@/lib/queries";
import { ArrowLeft, Bell, Plus, Users, CheckCircle2 } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { SendReminderDialog } from "@/components/SendReminderDialog";
import { AddTransactionSheet } from "@/components/AddTransactionSheet";
import { SettleUpDialog } from "@/components/SettleUpDialog";
import { SwipeRow } from "@/components/SwipeRow";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function PersonDetail() {
  const { personId } = useParams<{ personId: string }>();
  const qc = useQueryClient();
  const { data: person } = useQuery(personQuery(personId!));
  const { data: splits = [] } = useQuery(personSplitsQuery(personId!));
  const [reminderOpen, setReminderOpen] = useState(false);
  const [addSplitOpen, setAddSplitOpen] = useState(false);
  const [settleOpen, setSettleOpen] = useState(false);
  const [deleteSplit, setDeleteSplit] = useState<any | null>(null);
  const [editSplit, setEditSplit] = useState<any | null>(null);
  const [settleItem, setSettleItem] = useState<{ share: any; split: any } | null>(null);

  const totals = (splits as any[]).reduce((acc, s) => {
    for (const sh of (s.split_shares ?? [])) {
      if (sh.person_id !== personId) continue;
      const settled = (s.settlements ?? []).filter((x: any) => x.split_share_id === sh.id)
        .reduce((a: number, x: any) => a + Number(x.amount), 0);
      acc.owed += Number(sh.share_amount);
      acc.paid += settled;
    }
    return acc;
  }, { owed: 0, paid: 0 });

  const balance = totals.owed - totals.paid;

  const firstUnsettledShare = (splits as any[]).flatMap((s) =>
    (s.split_shares ?? []).filter((sh: any) => sh.person_id === personId && !sh.is_settled)
      .map((sh: any) => ({ share: sh, split: s }))
  )[0];

  if (!person) return <div className="p-6">Person not found</div>;

  return (
    <div className="px-4 pt-4 pb-24 space-y-5">
      <Link to="/split" className="inline-flex items-center text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4 mr-1" /> Split
      </Link>

      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-lg">
          {person.name[0]?.toUpperCase()}
        </div>
        <div>
          <h1 className="text-xl font-semibold">{person.name}</h1>
          <p className="text-xs text-muted-foreground">{person.phone_number ?? "no phone"}{person.linked_user_id && " · 🔗 linked"}</p>
        </div>
      </div>

      {/* Balance card */}
      <div className="balance-gradient rounded-2xl p-5">
        <p className="text-xs font-mono text-white/70 uppercase">Net balance</p>
        <p className="text-3xl font-mono font-bold text-white mt-1">{balance >= 0 ? "+" : ""}{formatMoney(balance)}</p>
        <p className="text-xs font-mono text-white/70 mt-1">{balance > 0 ? "owes you" : balance < 0 ? "you owe" : "settled"}</p>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={() => setAddSplitOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Add Split
        </Button>
        {firstUnsettledShare && (
          <Button variant="outline" className="flex-1 text-income" onClick={() => setSettleOpen(true)}>
            Settle Up
          </Button>
        )}
      </div>

      {balance > 0 && (
        <Button variant="outline" className="w-full" onClick={() => setReminderOpen(true)}>
          <Bell className="h-4 w-4 mr-2" /> Send reminder
        </Button>
      )}

      {/* History list */}
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2 px-1">History</p>
        {(splits as any[]).length === 0 ? (
          <div className="surface-card p-6 text-center text-sm text-muted-foreground">No splits yet</div>
        ) : (
          <div className="rounded-xl overflow-hidden border border-border divide-y divide-border">
            {(splits as any[]).map((s) => {
              const myShares = (s.split_shares ?? []).filter((sh: any) => sh.person_id === personId);
              const totalSettled = myShares.reduce((acc: number, sh: any) => {
                return acc + (s.settlements ?? []).filter((x: any) => x.split_share_id === sh.id)
                  .reduce((a: number, x: any) => a + Number(x.amount), 0);
              }, 0);
              const myTotal = myShares.reduce((a: number, sh: any) => a + Number(sh.share_amount), 0);
              const remaining = myTotal - totalSettled;
              const isSettled = remaining <= 0.005;
              const unsettledShare = myShares.find((sh: any) => !sh.is_settled);

              return (
                <SwipeRow
                  key={s.id}
                  onEdit={() => setEditSplit(s)}
                  onDelete={() => setDeleteSplit(s)}
                >
                  <div className="flex items-center gap-3 px-4 py-3 bg-card">
                    <div className="h-9 w-9 rounded-full bg-split/20 flex items-center justify-center text-split shrink-0">
                      <Users className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{s.description || "Split"}</p>
                      <p className="text-xs text-muted-foreground">{s.date} · paid by {s.paid_by}</p>
                      <p className="text-xs text-muted-foreground">
                        Your share: {formatMoney(myTotal)}
                        {isSettled
                          ? <span className="text-income ml-1 inline-flex items-center gap-0.5"><CheckCircle2 className="h-3 w-3" /> settled</span>
                          : <span className="text-expense ml-1">· {formatMoney(remaining)} remaining</span>}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-mono font-semibold text-split">{formatMoney(s.total_amount)}</p>
                      {!isSettled && unsettledShare && (
                        <button type="button"
                          onClick={(e) => { e.stopPropagation(); e.preventDefault(); setSettleItem({ share: unsettledShare, split: s }); }}
                          className="text-[10px] text-primary underline mt-0.5">
                          Settle up
                        </button>
                      )}
                    </div>
                  </div>
                </SwipeRow>
              );
            })}
          </div>
        )}
      </div>

      {/* Dialogs */}
      {splits[0] && (
        <SendReminderDialog
          open={reminderOpen}
          onOpenChange={setReminderOpen}
          person={{ id: person.id, name: person.name, phone_number: person.phone_number }}
          splitId={(splits[0] as any).id}
          amount={balance}
          description={(splits[0] as any).description}
        />
      )}

      <AddTransactionSheet open={addSplitOpen} onOpenChange={setAddSplitOpen} defaultTab="split" />

      {firstUnsettledShare && (
        <SettleUpDialog
          open={settleOpen}
          onOpenChange={setSettleOpen}
          share={firstUnsettledShare.share}
          split={firstUnsettledShare.split}
        />
      )}

      {settleItem && (
        <SettleUpDialog open={!!settleItem} onOpenChange={(o) => { if (!o) setSettleItem(null); }}
          share={settleItem.share} split={settleItem.split} />
      )}

      {/* Delete split confirm */}
      <AlertDialog open={!!deleteSplit} onOpenChange={(o) => { if (!o) setDeleteSplit(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete split?</AlertDialogTitle>
            <AlertDialogDescription>This will delete the split and all its shares. Cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white" onClick={async () => {
              if (!deleteSplit) return;
              const { error } = await supabase.from("splits").delete().eq("id", deleteSplit.id);
              if (error) toast.error(error.message);
              else { toast.success("Split deleted"); qc.invalidateQueries({ queryKey: ["splits"] }); }
              setDeleteSplit(null);
            }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit split sheet */}
      {editSplit && (
        <EditSplitSheet split={editSplit} open={!!editSplit} onOpenChange={(o) => { if (!o) setEditSplit(null); }} />
      )}
    </div>
  );
}

function EditSplitSheet({ split, open, onOpenChange }: { split: any; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [description, setDescription] = useState(split.description ?? "");
  const [date, setDate] = useState(split.date ?? "");

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("splits").update({ description: description || null, date }).eq("id", split.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Split updated");
      qc.invalidateQueries({ queryKey: ["splits"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="bg-card border-border rounded-t-3xl p-0 h-[50dvh] flex flex-col">
        <SheetTitle className="sr-only">Edit Split</SheetTitle>
        <div className="px-5 pt-5 pb-3 border-b border-border">
          <span className="text-base font-semibold">Edit Split</span>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Dinner" />
          </div>
          <div className="space-y-1.5">
            <Label>Date</Label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground outline-none" />
          </div>
        </div>
        <div className="p-4 border-t border-border">
          <Button className="w-full bg-primary text-white" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}