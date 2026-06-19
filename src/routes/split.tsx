import { useRealtimeSplits } from "@/hooks/useRealtimeSplits";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { peopleQuery, groupsQuery, splitsQuery } from "@/lib/queries";
import { Users, Plus, ChevronRight, Archive, QrCode, Trash2, Pencil } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AddPersonDialog } from "@/components/AddPersonDialog";
import { AddGroupDialog } from "@/components/AddGroupDialog";
import { QrScannerDialog } from "@/components/QrScannerDialog";
import { SettleUpDialog } from "@/components/SettleUpDialog";
import { formatMoney } from "@/lib/format";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SwipeRow } from "@/components/SwipeRow";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SplitPage() {
  useRealtimeSplits();
  const { data: people = [] } = useQuery(peopleQuery());
  const { data: groups = [] } = useQuery(groupsQuery());
  const { data: splits = [] } = useQuery(splitsQuery());
  const qc = useQueryClient();
  const [addPerson, setAddPerson] = useState(false);
  const [addGroup, setAddGroup] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanned, setScanned] = useState<{ name?: string; phone?: string } | undefined>();
  const [deleteSplit, setDeleteSplit] = useState<any | null>(null);
  const [editSplit, setEditSplit] = useState<any | null>(null);
  const [settleItem, setSettleItem] = useState<{ share: any; split: any } | null>(null);

  function handleScan(text: string) {
    let obj: any;
    try { obj = JSON.parse(text); } catch { return toast.error("Not a valid QR code"); }
    if (obj?.app !== "cashflow") return toast.error("That doesn't look like a CashFlow QR");
    const name = typeof obj.name === "string" ? obj.name.trim().slice(0, 80) : "";
    const phoneRaw = typeof obj.phone === "string" ? obj.phone.trim() : "";
    const phone = phoneRaw && /^\+?[0-9 ()-]{6,20}$/.test(phoneRaw) ? phoneRaw : undefined;
    if (!name && !phone) return toast.error("QR is missing name and phone");
    setScanned({ name: name || undefined, phone });
    setAddPerson(true);
    toast.success("QR scanned — review and save");
  }

  function personBalance(personId: string) {
    let owed = 0;
    for (const s of splits as any[]) {
      for (const sh of (s.split_shares ?? [])) {
        if (sh.person_id !== personId) continue;
        const settled = (s.settlements ?? []).filter((x: any) => x.split_share_id === sh.id)
          .reduce((a: number, x: any) => a + Number(x.amount), 0);
        owed += Number(sh.share_amount) - settled;
      }
    }
    return owed;
  }

  // Find first unsettled share for a split
  function firstUnsettledShare(s: any) {
    return (s.split_shares ?? []).find((sh: any) => !sh.is_settled);
  }

  return (
    <div className="px-4 pt-6 space-y-5 pb-24">
      <h1 className="text-xl font-semibold">Split</h1>

      {/* People Section */}
      <Section
        title="People"
        action={
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={() => setScanOpen(true)}>
              <QrCode className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setScanned(undefined); setAddPerson(true); }}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        }
      >
        {people.length === 0 ? <Empty text="No people yet" /> : (
          <div className="divide-y divide-border">
            {(people as any[]).map((p) => {
              const bal = personBalance(p.id);
              return (
                <Link key={p.id} to={`/split/person/${p.id}`}
                  className="flex items-center gap-3 p-4 active:bg-secondary/40">
                  <Avatar name={p.name} />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{p.name}{p.linked_user_id && " 🔗"}</p>
                    <p className="text-xs text-muted-foreground">{p.phone_number ?? "no phone"}</p>
                  </div>
                  {bal !== 0 && (
                    <span className={`text-sm font-mono font-semibold ${bal > 0 ? "text-income" : "text-expense"}`}>
                      {bal > 0 ? "+" : ""}{formatMoney(bal)}
                    </span>
                  )}
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              );
            })}
          </div>
        )}
      </Section>

      {/* Groups Section */}
      <Section
        title="Groups"
        action={
          <Button size="sm" variant="ghost" onClick={() => setAddGroup(true)}>
            <Plus className="h-4 w-4" />
          </Button>
        }
      >
        {groups.length === 0 ? <Empty text="No groups yet" /> : (
          <div className="divide-y divide-border">
            {(groups as any[]).map((g) => (
              <Link key={g.id} to={`/split/group/${g.id}`}
                className="flex items-center gap-3 p-4 active:bg-secondary/40">
                <div className="h-10 w-10 rounded-full bg-split/20 flex items-center justify-center text-split">
                  <Users className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium flex items-center gap-2">
                    {g.name} {g.is_archived && <Archive className="h-3 w-3 text-muted-foreground" />}
                  </p>
                  <p className="text-xs text-muted-foreground">{g.group_members?.length ?? 0} members</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        )}
      </Section>

      {/* History Section */}
      <Section title="History">
        {(splits as any[]).length === 0 ? <Empty text="No splits yet" /> : (
          <div className="divide-y divide-border rounded-xl overflow-hidden">
            {(splits as any[]).map((s) => {
              const unsettled = firstUnsettledShare(s);
              const totalShares = (s.split_shares ?? []).length;
              const settledShares = (s.split_shares ?? []).filter((sh: any) => sh.is_settled).length;
              const isFullySettled = totalShares > 0 && settledShares === totalShares;

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
                      <p className="text-xs text-muted-foreground font-mono">
                        {s.date} · paid by {s.paid_by}
                        {isFullySettled ? " · ✓ settled" : unsettled ? ` · ${settledShares}/${totalShares} settled` : ""}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-mono font-semibold text-split">{formatMoney(s.total_amount)}</p>
                      {!isFullySettled && unsettled && (
                        <button type="button"
                          onClick={(e) => { e.stopPropagation(); e.preventDefault(); setSettleItem({ share: unsettled, split: s }); }}
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
      </Section>

      <AddPersonDialog open={addPerson} onOpenChange={setAddPerson} initial={scanned} />
      <AddGroupDialog open={addGroup} onOpenChange={setAddGroup} />
      <QrScannerDialog open={scanOpen} onOpenChange={setScanOpen} onScan={handleScan} />

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

      {/* Settle up */}
      {settleItem && (
        <SettleUpDialog open={!!settleItem} onOpenChange={(o) => { if (!o) setSettleItem(null); }}
          share={settleItem.share} split={settleItem.split} />
      )}
    </div>
  );
}

// ─── Edit Split Sheet ──────────────────────────────────────────────────────
function EditSplitSheet({ split, open, onOpenChange }: { split: any; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [description, setDescription] = useState(split.description ?? "");
  const [note, setNote] = useState(split.note ?? "");
  const [date, setDate] = useState(split.date ?? "");

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("splits").update({
        description: description || null,
        date,
      }).eq("id", split.id);
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
      <SheetContent side="bottom" className="bg-card border-border rounded-t-3xl p-0 h-[60dvh] flex flex-col">
        <SheetTitle className="sr-only">Edit Split</SheetTitle>
        <div className="flex items-center gap-3 px-5 pt-5 pb-3 border-b border-border">
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

function Avatar({ name }: { name: string }) {
  return (
    <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold">
      {name[0]?.toUpperCase()}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground text-center py-8">{text}</p>;
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2 px-1">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{title}</p>
        {action}
      </div>
      <div className="surface-card overflow-hidden">{children}</div>
    </div>
  );
}