import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { personQuery, personSplitsQuery, peopleQuery, groupsQuery, accountsQuery, categoriesQuery, subCategoriesQuery, splitBalancesQuery } from "@/lib/queries";
import { settlementNetAfter, bilateralBalance } from "@/lib/balance";
import { ArrowLeft, Bell, Plus, ChevronLeft, ChevronRight, ChevronDown, QrCode, X, Check } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { SendReminderDialog } from "@/components/SendReminderDialog";
import { AddTransactionSheet } from "@/components/AddTransactionSheet";
import { SettleUpDialog } from "@/components/SettleUpDialog";
import { SwipeRow } from "@/components/SwipeRow";
import { SplitDirectRow, EditSplitSheet } from "./home";
import { SettlementRow } from "@/components/SettlementRow";
import { SettlementEditSheet } from "@/components/SettlementEditSheet";
import { notifyToast } from "@/lib/notify";
import { canModifySplit, deleteSplit as runSplitDelete } from "@/lib/deleteSplit";
import { canDeleteSettlement, deleteSettlement as deleteSettlementRpc } from "@/lib/deleteSettlement";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AddPersonDialog } from "@/components/AddPersonDialog";
import { AddGroupDialog } from "@/components/AddGroupDialog";
import { QrScannerDialog } from "@/components/QrScannerDialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { type Period, PERIODS, periodLabel, getPeriodRange, navigateAnchor, formatAnchorLabel } from "@/lib/period";

export default function PersonDetail() {
  const { personId } = useParams<{ personId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: person } = useQuery(personQuery(personId!));
  const { data: splits = [] } = useQuery(personSplitsQuery(personId!));
  // Full own+incoming splits — used to compute each settlement row's running net (shared with all pages).
  const { data: balanceData } = useQuery(splitBalancesQuery());
  const allSplits = balanceData?.splits ?? [];
  const allSettlements = balanceData?.settlements ?? [];
  const meId = balanceData?.currentUserId ?? null;
  const myPids = balanceData?.myPersonIds ?? [];
  const [period, setPeriod] = useState<Period>("monthly");
  const [anchor, setAnchor] = useState(new Date());
  const [reminderOpen, setReminderOpen] = useState(false);
  const [addSplitOpen, setAddSplitOpen] = useState(false);
  const [settleOpen, setSettleOpen] = useState(false);
  const [deleteSplit, setDeleteSplit] = useState<any | null>(null);
  const [editSplit, setEditSplit] = useState<any | null>(null);
  const [editSettlement, setEditSettlement] = useState<any | null>(null);
  const [deleteSettlement, setDeleteSettlement] = useState<any | null>(null);

  // Bilateral net "bin" balance between current user and target person (shared bin formula:
  // gross split debts − signed settlements). Positive = target owes me; negative = I owe target.
  const balance = useMemo(
    () => bilateralBalance(
      allSplits, allSettlements,
      { id: personId!, linked_user_id: person?.linked_user_id ?? null },
      meId, myPids,
    ),
    [allSplits, allSettlements, personId, person, meId, myPids],
  );

  const { from: periodFrom, to: periodTo } = useMemo(
    () => getPeriodRange(period, anchor),
    [period, anchor]
  );
  const fromStr = useMemo(() => format(periodFrom, "yyyy-MM-dd"), [periodFrom]);
  const toStr = useMemo(() => format(periodTo, "yyyy-MM-dd"), [periodTo]);

  // Only show rows where the PAYER is one of the two people being viewed (current user or target).
  // Third-party-paid splits are hidden from the list (balance already skips them internally).
  const visibleSplits = useMemo(() =>
    (splits as any[]).filter((s) => {
      const payerAuthId = getPayerAuthId(s);
      if (!payerAuthId) return true; // can't determine payer → show
      const targetLui = s._targetLinkedUserId;
      return payerAuthId === s._currentUserId || (!!targetLui && payerAuthId === targetLui);
    }),
    [splits]
  );

  const filteredSplits = useMemo(() =>
    visibleSplits.filter((s) => s.date >= fromStr && s.date <= toStr),
    [visibleSplits, fromStr, toStr]
  );

  // Settlement rows between the two users (bin model: settlements are person-to-person, matched by
  // counterparty — not nested in splits). Each row shows the RUNNING NET as of that settlement (via
  // the shared settlementNetAfter helper, so every page matches). Newest row = the top balance card.
  const filteredSettlements = useMemo(() => {
    const targetLui: string | null = person?.linked_user_id ?? null;
    const out: any[] = [];
    for (const st of allSettlements as any[]) {
      const settler = st.created_by;
      const cpUid = st.person?.linked_user_id ?? null;
      const settlerIsMe = settler === meId;
      const betweenUs = settlerIsMe
        ? (st.person_id === personId || (!!targetLui && cpUid === targetLui))
        : (!!targetLui && settler === targetLui && cpUid === meId);
      if (!betweenUs) continue;
      const day = String(st.created_at ?? "").slice(0, 10);
      if (day < fromStr || day > toStr) continue;
      // "You → target": I paid the target when I'm the debtor (the target is the creditor).
      const iPaid = settlerIsMe ? !st.settler_is_creditor : !!st.settler_is_creditor;
      out.push({
        ...st, _itemType: "settlement", _iPaid: iPaid,
        _netAfter: settlementNetAfter(allSplits, allSettlements, st, meId, myPids) ?? 0,
        _currentUserId: meId,
      });
    }
    return out;
  }, [allSettlements, allSplits, meId, myPids, personId, person, fromStr, toStr]);

  const combinedItems = useMemo(() => {
    const items = [
      ...filteredSplits.map((s: any) => ({ ...s, _itemType: "split" as const })),
      ...filteredSettlements,
    ];
    // Sort all items (splits + settlements) by numeric timestamp DESC. String compare mixed local
    // split date+time with UTC settlement created_at; getTime() normalizes both to epoch ms.
    const getTime = (x: any) => x._itemType === "settlement"
      ? new Date(x.created_at).getTime()
      : new Date(`${x.date || "1970-01-01"}T${x.time || "00:00:00"}`).getTime();
    return items.sort((a, b) => getTime(b) - getTime(a));
  }, [filteredSplits, filteredSettlements]);

  if (!person) return <div className="p-6">Person not found</div>;

  return (
    <div className="px-4 pt-4 pb-24 space-y-5">
      <button onClick={() => navigate(-1)} className="inline-flex items-center text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back
      </button>

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
        {Math.abs(balance) > 0.005 && (
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
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3 px-1">History</p>

        {/* Period filter bar */}
        <div className="flex items-center gap-2 mb-3">
          <button onClick={() => setAnchor((a) => navigateAnchor(period, a, -1))} className="p-1 rounded-md hover:bg-secondary">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold">{formatAnchorLabel(period, anchor)}</span>
          <button onClick={() => setAnchor((a) => navigateAnchor(period, a, 1))} className="p-1 rounded-md hover:bg-secondary">
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 bg-primary text-white text-sm font-medium px-3 py-1.5 rounded-xl capitalize">
                  {periodLabel(period)} <ChevronDown className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36">
                {PERIODS.map((p) => (
                  <DropdownMenuItem key={p} onClick={() => { setPeriod(p); setAnchor(new Date()); }}
                    className={cn("capitalize py-3 text-base", period === p && "text-primary font-medium")}>
                    {periodLabel(p)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {combinedItems.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            {(splits as any[]).length === 0 ? "No splits yet" : "Nothing this period"}
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden border border-border divide-y divide-border">
            {combinedItems.map((item: any) => item._itemType === "settlement" ? (
              <SwipeRow key={`set-${item.id}`} onEdit={() => setEditSettlement(item)} onDelete={() => setDeleteSettlement(item)}
                canEdit={item.created_by === item._currentUserId} canDelete={canDeleteSettlement(item, item._currentUserId)}
                editDeniedMessage="Only the creator can edit this settlement"
                deleteDeniedMessage="Only the creator or payer can delete this settlement">
                <SettlementRow description={item.description} iPaid={item._iPaid} otherName={person.name} amount={Number(item.amount)} netAfter={item._netAfter} createdAt={item.created_at} />
              </SwipeRow>
            ) : (
              <SwipeRow key={item.id} onEdit={() => setEditSplit(item)} onDelete={() => setDeleteSplit(item)}
                canEdit={canModifySplit(item)} canDelete={canModifySplit(item)}
                editDeniedMessage="Only the creator or payer can edit this split"
                deleteDeniedMessage="Only the creator or payer can delete this split">
                <SplitDirectRow s={item} lentOweOverride={bilateralRowAmount(item)} />
              </SwipeRow>
            ))}
          </div>
        )}
      </div>

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

      {Math.abs(balance) > 0.005 && (
        <SettleUpDialog
          open={settleOpen}
          onOpenChange={setSettleOpen}
          personId={personId}
          personName={person.name}
          personLinkedUserId={person.linked_user_id}
          netBalance={balance}
        />
      )}

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
              // The delete_split RPC enforces creator-or-payer permission, blocks
              // deletion when settlements exist, restores balance, and notifies
              // all other participants — all server-side.
              await runSplitDelete(deleteSplit.id, qc);
              setDeleteSplit(null);
            }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {editSettlement && (
        <SettlementEditSheet
          settlement={editSettlement}
          open={!!editSettlement}
          onOpenChange={(o) => { if (!o) setEditSettlement(null); }}
        />
      )}

      <AlertDialog open={!!deleteSettlement} onOpenChange={(o) => { if (!o) setDeleteSettlement(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete settlement?</AlertDialogTitle>
            <AlertDialogDescription>This re-opens the debt between you two. Cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white" onClick={async () => {
              if (!deleteSettlement) return;
              await deleteSettlementRpc(deleteSettlement.id, qc);
              setDeleteSettlement(null);
            }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {editSplit && (
        <EditSplitSheet
          split={editSplit}
          open={!!editSplit}
          onOpenChange={(o) => { if (!o) setEditSplit(null); }}
        />
      )}
    </div>
  );
}

// ─── Helper: resolve a split's payer to an auth user id ───────────────────
function getPayerAuthId(split: any): string | null {
  if (split.paid_by_person_id) {
    const ps = (split.split_shares ?? []).find((ss: any) => ss.person_id === split.paid_by_person_id);
    if (ps?.person?.linked_user_id) return ps.person.linked_user_id;
  }
  if (split.paid_by === "me") return split.created_by; // "me" always means the creator
  if (split.paid_by) {
    const m = (split.split_shares ?? []).find((ss: any) => ss.person?.name === split.paid_by || ss.person_name === split.paid_by);
    if (m?.person?.linked_user_id) return m.person.linked_user_id;
  }
  return null;
}

// ─── Helper: bilateral lent/owe amount for a People/Group row on the person page ───
// Returns the TARGET person's (or current user's) specific share — not the whole-split total.
// Individual rows return undefined (already correct: only two people involved).
function bilateralRowAmount(s: any): number | undefined {
  const shares = (s.split_shares ?? []) as any[];
  const isGroup = s.type === "group";
  const isIndividual = !isGroup && shares.length <= 1;
  if (isIndividual) return undefined;

  const total = Number(s.total_amount);
  const sumShares = shares.reduce((a: number, sh: any) => a + Number(sh.share_amount), 0);
  const currentUserId: string | null = s._currentUserId ?? null;
  const targetLui: string | null = s._targetLinkedUserId ?? null;
  const targetPid: string | undefined = s._targetPersonId;
  const myPersonIds: string[] = s._myPersonIds ?? [];
  const payer = getPayerAuthId(s);

  const targetShareEntry = shares.find((ss: any) =>
    (targetLui && ss.person?.linked_user_id === targetLui) || ss.person_id === targetPid);
  const myShareEntry = shares.find((ss: any) =>
    myPersonIds.includes(ss.person_id) || ss.person?.linked_user_id === currentUserId);

  if (payer && payer === currentUserId) {
    if (targetShareEntry) return Number(targetShareEntry.share_amount);
    if (targetLui && s.created_by === targetLui) return total - sumShares;
  } else if (payer && targetLui && payer === targetLui) {
    if (myShareEntry) return Number(myShareEntry.share_amount);
    if (s.created_by === currentUserId) return total - sumShares;
  }
  return undefined; // can't determine → fall back to default whole-split amount
}
