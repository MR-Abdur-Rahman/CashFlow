import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { groupQuery, groupSplitsQuery } from "@/lib/queries";
import { ArrowLeft, Archive, Pencil, Trash2, Plus, Users, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SettleUpDialog } from "@/components/SettleUpDialog";
import { SwipeRow } from "@/components/SwipeRow";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";
import { AddGroupDialog } from "@/components/AddGroupDialog";
import { AddTransactionSheet } from "@/components/AddTransactionSheet";
import { Link, useParams, useNavigate } from "react-router-dom";
import { formatMoney } from "@/lib/format";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function GroupDetail() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: group } = useQuery(groupQuery(groupId!));
  const { data: splits = [] } = useQuery(groupSplitsQuery(groupId!));
  const [edit, setEdit] = useState(false);
  const [addSplitOpen, setAddSplitOpen] = useState(false);
  const [deleteSplit, setDeleteSplit] = useState<any | null>(null);
  const [editSplit, setEditSplit] = useState<any | null>(null);
  const [settleItem, setSettleItem] = useState<{ share: any; split: any } | null>(null);

  const archive = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("groups").update({ is_archived: !group?.is_archived }).eq("id", groupId!);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["groups"] }); toast.success("Updated"); },
  });

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("groups").delete().eq("id", groupId!);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["groups"] });
      toast.success("Group deleted");
      navigate(-1);
    },
    onError: (e) => toast.error(e.message),
  });

  const memberBalances = (group as any)?.group_members?.map((m: any) => {
    let owed = 0;
    for (const s of splits as any[]) {
      for (const sh of (s.split_shares ?? [])) {
        if (sh.person_id !== m.person_id) continue;
        const settled = (s.settlements ?? []).filter((x: any) => x.split_share_id === sh.id)
          .reduce((a: number, x: any) => a + Number(x.amount), 0);
        owed += Number(sh.share_amount) - settled;
      }
    }
    return { name: m.people?.name ?? "?", balance: owed };
  }) ?? [];

  if (!group) return <div className="p-6">Group not found</div>;

  return (
    <div className="px-4 pt-4 pb-24 space-y-5">
      <Link to="/split" className="inline-flex items-center text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4 mr-1" /> Split
      </Link>

      <div>
        <h1 className="text-xl font-semibold">{group.name}</h1>
        <p className="text-xs text-muted-foreground">{(group as any).group_members?.length ?? 0} members</p>
      </div>

      {/* Member balances */}
      {memberBalances.length > 0 && (
        <div className="surface-card p-3 space-y-2">
          {memberBalances.map((m: any) => (
            <div key={m.name} className="flex justify-between text-sm">
              <span>{m.name}</span>
              <span className={m.balance > 0 ? "text-income font-mono" : m.balance < 0 ? "text-expense font-mono" : "text-muted-foreground"}>
                {m.balance > 0 ? "+" : ""}{formatMoney(m.balance)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={() => setAddSplitOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Add Split
        </Button>
        <Button variant="outline" onClick={() => setEdit(true)}>
          <Pencil className="h-4 w-4 mr-2" /> Edit
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={() => archive.mutate()}>
          <Archive className="h-4 w-4 mr-2" /> {group.is_archived ? "Unarchive" : "Archive"}
        </Button>
        <Button variant="outline" className="text-expense" onClick={() => { if (confirm("Delete group?")) del.mutate(); }}>
          <Trash2 className="h-4 w-4 mr-2" /> Delete
        </Button>
      </div>

      {/* History list */}
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2 px-1">History</p>
        {(splits as any[]).length === 0 ? (
          <div className="surface-card p-6 text-center text-sm text-muted-foreground">No splits yet</div>
        ) : (
          <div className="rounded-xl overflow-hidden border border-border divide-y divide-border">
            {(splits as any[]).map((s) => {
              const totalShares = (s.split_shares ?? []).length;
              const settledShares = (s.split_shares ?? []).filter((sh: any) => sh.is_settled).length;
              const isFullySettled = totalShares > 0 && settledShares === totalShares;
              const unsettledShare = (s.split_shares ?? []).find((sh: any) => !sh.is_settled);

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
                        {isFullySettled
                          ? <span className="text-income inline-flex items-center gap-0.5"><CheckCircle2 className="h-3 w-3" /> All settled</span>
                          : `${settledShares}/${totalShares} settled`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-mono font-semibold text-split">{formatMoney(s.total_amount)}</p>
                      {!isFullySettled && unsettledShare && (
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

      <AddGroupDialog open={edit} onOpenChange={setEdit} edit={group} />
      <AddTransactionSheet open={addSplitOpen} onOpenChange={setAddSplitOpen} defaultTab="split" />

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