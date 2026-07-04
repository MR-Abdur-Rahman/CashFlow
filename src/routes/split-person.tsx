import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { personQuery, personSplitsQuery, peopleQuery, groupsQuery, accountsQuery, categoriesQuery, subCategoriesQuery } from "@/lib/queries";
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
import { type Period, PERIODS, getPeriodRange, navigateAnchor, formatAnchorLabel } from "@/lib/period";

export default function PersonDetail() {
  const { personId } = useParams<{ personId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: person } = useQuery(personQuery(personId!));
  const { data: splits = [] } = useQuery(personSplitsQuery(personId!));
  const [period, setPeriod] = useState<Period>("monthly");
  const [anchor, setAnchor] = useState(new Date());
  const [reminderOpen, setReminderOpen] = useState(false);
  const [addSplitOpen, setAddSplitOpen] = useState(false);
  const [settleOpen, setSettleOpen] = useState(false);
  const [deleteSplit, setDeleteSplit] = useState<any | null>(null);
  const [editSplit, setEditSplit] = useState<any | null>(null);
  const [editSettlement, setEditSettlement] = useState<any | null>(null);
  const [deleteSettlement, setDeleteSettlement] = useState<any | null>(null);

  // Bilateral net balance between current user and target person.
  // Positive = target owes me; negative = I owe target. Third-party-paid splits are skipped.
  const balance = useMemo(() => {
    let net = 0;
    for (const s of splits as any[]) {
      const shares = (s.split_shares ?? []) as any[];
      const settlements = (s.settlements ?? []) as any[];
      const myPersonIds: string[] = s._myPersonIds ?? [];
      const currentUserId: string | null = s._currentUserId ?? null;
      const targetLui: string | null = s._targetLinkedUserId ?? null;
      const targetPid: string = s._targetPersonId ?? personId!;
      const total = Number(s.total_amount);
      const sumShares = shares.reduce((a: number, sh: any) => a + Number(sh.share_amount), 0);
      const settledOf = (ss: any) => !ss ? 0 :
        settlements.filter((x: any) => x.split_share_id === ss.id).reduce((a: number, x: any) => a + Number(x.amount), 0);
      const payerAuthId: string | null = (() => {
        if (s.paid_by_person_id) {
          const ps = shares.find((ss: any) => ss.person_id === s.paid_by_person_id);
          if (ps?.person?.linked_user_id) return ps.person.linked_user_id;
        }
        if (s.paid_by === "me") return s.created_by;
        if (s.paid_by) {
          const m = shares.find((ss: any) => ss.person?.name === s.paid_by || ss.person_name === s.paid_by);
          if (m?.person?.linked_user_id) return m.person.linked_user_id;
        }
        return null;
      })();
      const myShareEntry = shares.find((ss: any) =>
        myPersonIds.includes(ss.person_id) || ss.person?.linked_user_id === currentUserId);
      const targetShareEntry = shares.find((ss: any) =>
        (targetLui && ss.person?.linked_user_id === targetLui) || ss.person_id === targetPid);

      // For an implicit creator share there is no split_share row to attach settlements to, so they
      // land on the OTHER party's share. On a bilateral split every settlement reduces the single
      // bilateral debt, so subtract ALL settlements on the split for the implicit branches.
      const allSettledOnSplit = settlements.reduce((a: number, x: any) => a + Number(x.amount ?? 0), 0);
      if (payerAuthId && payerAuthId === currentUserId) {
        // I paid → target owes me their share (or their implicit creator share)
        if (targetShareEntry) net += Number(targetShareEntry.share_amount) - settledOf(targetShareEntry);
        else if (targetLui && s.created_by === targetLui) net += (total - sumShares) - allSettledOnSplit;
      } else if (payerAuthId && targetLui && payerAuthId === targetLui) {
        // Target paid → I owe my share (or my implicit creator share)
        if (myShareEntry) net -= Number(myShareEntry.share_amount) - settledOf(myShareEntry);
        else if (s.created_by === currentUserId) net -= (total - sumShares) - allSettledOnSplit;
      }
      // Third party paid → skip (no direct bilateral debt)
    }
    return net;
  }, [splits, personId, person]);

  const unsettledItems = useMemo(() => {
    return (splits as any[]).flatMap((s) => {
      const targetPersonId = s._isIncoming ? s._myPersonId : personId;
      if (!targetPersonId) return [];
      const payerAuthId = getPayerAuthId(s);
      return (s.split_shares ?? [])
        .filter((sh: any) => sh.person_id === targetPersonId && !sh.is_settled)
        .filter((sh: any) => {
          // Malformed guard: in an INCOMING split the offered share is the viewer's OWN. If the
          // viewer was the payer, that share isn't a debt — don't offer it (prevents settling your
          // own share). Own-split proxy shares (used to settle an implicit creator debt) stay allowed.
          if (!s._isIncoming) return true;
          const sharePersonUid = sh.person?.linked_user_id;
          return !(payerAuthId && sharePersonUid && sharePersonUid === payerAuthId);
        })
        .map((sh: any) => {
          const paid = (s.settlements ?? []).filter((x: any) => x.split_share_id === sh.id)
            .reduce((a: number, x: any) => a + Number(x.amount), 0);
          return {
            shareId: sh.id,
            splitId: s.id,
            description: getSplitLabel(s),
            date: s.date,
            shareAmount: Number(sh.share_amount),
            paidAmount: paid,
            remaining: Number(sh.share_amount) - paid,
            // Incoming split → the offered share is the viewer's own (viewer owes); own split →
            // the target's share (they owe). Lets Settle Up settle only the owed direction.
            viewerOwes: !!s._isIncoming,
          };
        });
    }).filter((item) => item.remaining > 0.005);
  }, [splits, personId]);

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

  // Settlement rows between the two users — display only. These are already nested in the split
  // data; the balance math above already accounts for them (via settledOf), so we do NOT re-add them.
  // Direction comes from which share was settled: if it's mine, I paid the target; else they paid me.
  const filteredSettlements = useMemo(() => {
    // Each settlement row shows the RUNNING NET balance as of that settlement (viewer-relative,
    // + = target owes me). We start from the base net if there were no settlements (gross bilateral
    // debts), then walk settlements oldest-first: a debtor's payment moves the net by ±amount. The
    // newest settlement's net therefore equals the top balance card.
    let baseNet = 0;
    const events: { st: any; sign: number; iPaid: boolean; currentUserId: string | null }[] = [];
    for (const s of visibleSplits) {
      const myPersonIds: string[] = s._myPersonIds ?? [];
      const currentUserId: string | null = s._currentUserId ?? null;
      const targetLui: string | null = s._targetLinkedUserId ?? null;
      const targetPid: string = s._targetPersonId ?? personId!;
      const shares = (s.split_shares ?? []) as any[];
      const total = Number(s.total_amount);
      const sumShares = shares.reduce((a: number, sh: any) => a + Number(sh.share_amount ?? 0), 0);
      const payerAuthId = getPayerAuthId(s);
      const creditorIsMe = !!payerAuthId && payerAuthId === currentUserId;             // I paid → target owes me
      const creditorIsTarget = !!payerAuthId && !!targetLui && payerAuthId === targetLui; // target paid → I owe
      if (creditorIsMe) {
        const targetShareEntry = shares.find((ss: any) => (targetLui && ss.person?.linked_user_id === targetLui) || ss.person_id === targetPid);
        baseNet += targetShareEntry ? Number(targetShareEntry.share_amount) : (targetLui && s.created_by === targetLui ? (total - sumShares) : 0);
      } else if (creditorIsTarget) {
        const myShareEntry = shares.find((ss: any) => myPersonIds.includes(ss.person_id) || ss.person?.linked_user_id === currentUserId);
        baseNet -= myShareEntry ? Number(myShareEntry.share_amount) : (s.created_by === currentUserId ? (total - sumShares) : 0);
      }
      // A settlement is the debtor paying the creditor. Creditor = me → target paid me down (net −);
      // creditor = target → I paid them down (net +, and this row is "You → target").
      const sign = creditorIsMe ? -1 : creditorIsTarget ? 1 : 0;
      for (const st of (s.settlements ?? []) as any[]) {
        events.push({ st, sign, iPaid: creditorIsTarget, currentUserId });
      }
    }
    // Running net over ALL settlements oldest-first (independent of the period filter).
    const netAfterById = new Map<string, number>();
    let run = baseNet;
    for (const e of [...events].sort((a, b) => String(a.st.created_at ?? "").localeCompare(String(b.st.created_at ?? "")))) {
      run += e.sign * Number(e.st.amount ?? 0);
      netAfterById.set(e.st.id, run);
    }
    // Build the display rows (dedupe + period filter).
    const seen = new Set<string>();
    const out: any[] = [];
    for (const e of events) {
      const st = e.st;
      if (seen.has(st.id)) continue;
      seen.add(st.id);
      const day = String(st.created_at ?? "").slice(0, 10);
      if (day < fromStr || day > toStr) continue;
      out.push({
        ...st, _itemType: "settlement", _iPaid: e.iPaid,
        _netAfter: netAfterById.get(st.id) ?? 0,
        _currentUserId: e.currentUserId,
      });
    }
    return out;
  }, [visibleSplits, fromStr, toStr, personId]);

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
        {Math.abs(balance) > 0 && unsettledItems.length > 0 && (
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
                  {period} <ChevronDown className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36">
                {PERIODS.map((p) => (
                  <DropdownMenuItem key={p} onClick={() => { setPeriod(p); setAnchor(new Date()); }}
                    className={cn("capitalize py-3 text-base", period === p && "text-primary font-medium")}>
                    {p}
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

      {unsettledItems.length > 0 && (
        <SettleUpDialog
          open={settleOpen}
          onOpenChange={setSettleOpen}
          personName={person.name}
          personLinkedUserId={person.linked_user_id}
          netBalance={balance}
          unsettledItems={unsettledItems}
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

// ─── Helper: get display label for a split ────────────────────────────────
function getSplitLabel(s: any, creatorName?: string): string {
  if (s._isIncoming) return creatorName || s.description || "Split";
  if (s.type === "group" && s.groups?.name) return s.groups.name;
  if (s.type === "individual" && s.people?.name) return s.people.name;
  const names = (s.split_shares ?? []).map((sh: any) => sh.person_name).filter(Boolean);
  if (names.length > 0) return names.join(", ");
  return s.description || "Split";
}
