import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { personQuery, personSplitsQuery, peopleQuery, groupsQuery, accountsQuery, categoriesQuery, subCategoriesQuery } from "@/lib/queries";
import { ArrowLeft, Bell, Plus, ChevronLeft, ChevronRight, ChevronDown, QrCode, X, Check } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { SendReminderDialog } from "@/components/SendReminderDialog";
import { AddTransactionSheet } from "@/components/AddTransactionSheet";
import { SettleUpDialog } from "@/components/SettleUpDialog";
import { SwipeRow } from "@/components/SwipeRow";
import { SplitDirectRow } from "./home";
import { SettlementRow } from "@/components/SettlementRow";
import { SettlementEditSheet } from "@/components/SettlementEditSheet";
import { notifyToast } from "@/lib/notify";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState, useMemo, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
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
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfYear, endOfYear, subMonths, addMonths, subWeeks, addWeeks, subYears, addYears } from "date-fns";

type Period = "weekly" | "monthly" | "annually";
function getPeriodRange(period: Period, anchor: Date) {
  if (period === "weekly") return { from: startOfWeek(anchor, { weekStartsOn: 1 }), to: endOfWeek(anchor, { weekStartsOn: 1 }) };
  if (period === "monthly") return { from: startOfMonth(anchor), to: endOfMonth(anchor) };
  return { from: startOfYear(anchor), to: endOfYear(anchor) };
}
function navigateAnchor(period: Period, anchor: Date, dir: -1 | 1): Date {
  if (period === "weekly") return dir === -1 ? subWeeks(anchor, 1) : addWeeks(anchor, 1);
  if (period === "monthly") return dir === -1 ? subMonths(anchor, 1) : addMonths(anchor, 1);
  return dir === -1 ? subYears(anchor, 1) : addYears(anchor, 1);
}
function formatAnchorLabel(period: Period, anchor: Date) {
  if (period === "weekly") return `${format(startOfWeek(anchor, { weekStartsOn: 1 }), "MMM d")} – ${format(endOfWeek(anchor, { weekStartsOn: 1 }), "MMM d, yyyy")}`;
  if (period === "monthly") return format(anchor, "MMM yyyy");
  return format(anchor, "yyyy");
}

export default function PersonDetail() {
  const { personId } = useParams<{ personId: string }>();
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
    const seen = new Set<string>();
    const out: any[] = [];
    for (const s of visibleSplits) {
      const myPersonIds: string[] = s._myPersonIds ?? [];
      const currentUserId: string | null = s._currentUserId ?? null;
      const targetLui: string | null = s._targetLinkedUserId ?? null;
      const targetPid: string = s._targetPersonId ?? personId!;
      const shares = (s.split_shares ?? []) as any[];
      const total = Number(s.total_amount);
      const sumShares = shares.reduce((a: number, sh: any) => a + Number(sh.share_amount ?? 0), 0);
      // Direction comes from who paid the SPLIT, not which share the settlement is attached to
      // (the debtor may be the creator, who has no explicit share). Viewer is the debtor unless
      // they paid.
      const payerAuthId = getPayerAuthId(s);
      const iPaid = !!payerAuthId && payerAuthId !== currentUserId;
      // The debtor's debt = their explicit share, or the implicit creator share (total - sumShares).
      const debtorShare = iPaid
        ? shares.find((sh: any) => myPersonIds.includes(sh.person_id) || sh.person?.linked_user_id === currentUserId)
        : shares.find((sh: any) => (targetLui && sh.person?.linked_user_id === targetLui) || sh.person_id === targetPid);
      const debtAmount = debtorShare ? Number(debtorShare.share_amount) : (total - sumShares);
      // Remaining is computed at the SPLIT level (all settlements on this bilateral split), so it is
      // correct even when the debt is an implicit creator share with no own split_share row.
      const splitSettlements = [...(s.settlements ?? [])]
        .sort((a: any, b: any) => String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")));
      for (const st of (s.settlements ?? []) as any[]) {
        if (seen.has(st.id)) continue;
        seen.add(st.id);
        const day = String(st.created_at ?? "").slice(0, 10);
        if (day < fromStr || day > toStr) continue;
        const cidx = splitSettlements.findIndex((x: any) => x.id === st.id);
        const cumulative = splitSettlements.slice(0, cidx + 1).reduce((sum: number, x: any) => sum + Number(x.amount ?? 0), 0);
        const remaining = Math.max(0, debtAmount - cumulative);
        out.push({
          ...st, _itemType: "settlement", _iPaid: iPaid,
          _remaining: remaining, _fullySettled: debtAmount > 0 && remaining <= 0,
          _currentUserId: currentUserId,
        });
      }
    }
    return out;
  }, [visibleSplits, fromStr, toStr, personId]);

  const combinedItems = useMemo(() => {
    const items = [
      ...filteredSplits.map((s: any) => ({ ...s, _itemType: "split" as const })),
      ...filteredSettlements,
    ];
    // Sort all items (splits + settlements) by full timestamp DESC. Splits use date+time;
    // settlements use created_at (they have no date/time column).
    const sortKey = (x: any) => x._itemType === "split"
      ? `${x.date}T${x.time ?? "00:00:00"}`
      : String(x.created_at ?? "");
    return items.sort((a, b) => sortKey(b).localeCompare(sortKey(a)));
  }, [filteredSplits, filteredSettlements]);

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
                {(["weekly", "monthly", "annually"] as Period[]).map((p) => (
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
                canEdit={item.created_by === item._currentUserId} canDelete={item.created_by === item._currentUserId}
                editDeniedMessage="Only the creator can edit this settlement"
                deleteDeniedMessage="Only the creator can delete this settlement">
                <SettlementRow description={item.description} iPaid={item._iPaid} otherName={person.name} amount={Number(item.amount)} remaining={item._remaining} fullySettled={item._fullySettled} createdAt={item.created_at} />
              </SwipeRow>
            ) : (
              <SwipeRow key={item.id} onEdit={() => setEditSplit(item)} onDelete={() => setDeleteSplit(item)}
                canEdit={!item._isIncoming} canDelete={!item._isIncoming}
                editDeniedMessage="Only the creator can edit this split"
                deleteDeniedMessage="Only the creator can delete this split">
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
              const { data: u } = await supabase.auth.getUser();
              if (!u.user) return;

              const isCreator = deleteSplit.created_by === u.user.id;

              if (!isCreator) {
                toast.error("Only the creator can delete this split");
                const { data: myProfile } = await supabase
                  .from("profiles").select("full_name").eq("id", u.user.id).maybeSingle();
                await supabase.from("notifications").insert({
                  user_id: deleteSplit.created_by,
                  type: "delete_attempt",
                  title: "Delete attempt",
                  message: `${myProfile?.full_name ?? "Someone"} tried to delete: ${deleteSplit.description || "Split"}`,
                  related_split_id: deleteSplit.id,
                  is_read: false,
                });
                setDeleteSplit(null);
                return;
              }

              // split_deleted notifications are now sent by the DB trigger
              // (trigger_notify_split_deleted, gated by each recipient's split_notifications pref).
              const { error } = await supabase.from("splits").delete().eq("id", deleteSplit.id);
              if (error) toast.error(error.message);
              else {
                notifyToast("split_deleted", "Split deleted");
                qc.invalidateQueries({ queryKey: ["splits"] });
                qc.invalidateQueries({ queryKey: ["transactions"] });
                qc.invalidateQueries({ queryKey: ["accounts"] });
              }
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
              const { error } = await supabase.from("settlements").delete().eq("id", deleteSettlement.id);
              if (error) toast.error(error.message);
              else {
                notifyToast("settlement_created", "Settlement deleted");
                qc.invalidateQueries({ queryKey: ["splits"] });
                qc.invalidateQueries({ queryKey: ["settlements"] });
                qc.invalidateQueries({ queryKey: ["accounts"] });
              }
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

// ─── Full Edit Split Sheet ────────────────────────────────────────────────
function EditSplitSheet({ split, open, onOpenChange }: { split: any; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const { data: accounts = [] } = useQuery(accountsQuery());
  const { data: cats = [] } = useQuery(categoriesQuery("expense"));
  const { data: people = [] } = useQuery(peopleQuery());
  const { data: groups = [] } = useQuery(groupsQuery());

  const [amount, setAmount] = useState(String(split.total_amount ?? ""));
  const [target, setTarget] = useState<"person" | "multi" | "group">(
    split.type === "group" ? "group" : (split.split_shares ?? []).length > 1 ? "multi" : "person"
  );
  const [personId, setPersonId] = useState(split.person_id ?? "");
  const [personName, setPersonName] = useState(split.people?.name ?? "");
  const [multiPeople, setMultiPeople] = useState<{ id: string; name: string }[]>(() => {
    if (split.type !== "group" && (split.split_shares ?? []).length > 0) {
      return (split.split_shares ?? []).map((sh: any) => ({ id: sh.person_id ?? "", name: sh.person_name ?? "" })).filter((p: any) => p.id);
    }
    return [];
  });
  const [groupId, setGroupId] = useState(split.group_id ?? "");
  const [groupName, setGroupName] = useState(split.groups?.name ?? "");
  const [whoPaid, setWhoPaid] = useState<"me" | "other">(split.paid_by === "me" ? "me" : "other");
  const [otherPayerId, setOtherPayerId] = useState("");
  const [accountId, setAccountId] = useState(split.account_id ?? "");
  const [splitType, setSplitType] = useState<"equal" | "custom">(split.split_type ?? "equal");
  const [categoryId, setCategoryId] = useState(split.category_id ?? "");
  const [categoryName, setCategoryName] = useState("");
  const [categoryIcon, setCategoryIcon] = useState("");
  const [subCatId, setSubCatId] = useState(split.sub_category_id ?? "");
  const [subCatName, setSubCatName] = useState("");
  const [date, setDate] = useState(split.date ?? format(new Date(), "yyyy-MM-dd"));
  const [time, setTime] = useState(split.time?.slice(0, 5) ?? format(new Date(), "HH:mm"));
  const [note, setNote] = useState(split.description ?? "");
  const [catPickerOpen, setCatPickerOpen] = useState(false);
  const [personPickerOpen, setPersonPickerOpen] = useState(false);
  const [multiPickerOpen, setMultiPickerOpen] = useState(false);
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);

  useEffect(() => { if (accounts[0]?.id && !accountId) setAccountId(accounts[0].id); }, [accounts]);
  useEffect(() => {
    if (categoryId && cats.length > 0) {
      const cat = (cats as any[]).find((c) => c.id === categoryId);
      if (cat) { setCategoryName(cat.name); setCategoryIcon(cat.icon ?? ""); }
    }
  }, [categoryId, cats]);

  const { data: subs = [] } = useQuery(subCategoriesQuery(categoryId || null));

  const participants = useMemo(() => {
    if (target === "person" && personId) return [{ id: personId, name: personName }];
    if (target === "multi") return multiPeople;
    if (target === "group") {
      const g = (groups as any[]).find((x) => x.id === groupId);
      return (g?.group_members ?? []).map((m: any) => ({ id: m.person_id, name: m.people?.name ?? "?" }));
    }
    return [];
  }, [target, personId, personName, multiPeople, groupId, groups]);

  const total = Number(amount);
  const equalShare = participants.length > 0 ? total / (participants.length + 1) : 0;
  const currencySymbol = (window as any).__currencySymbol ?? "LKR";

  const mutation = useMutation({
    mutationFn: async () => {
      const paidByName = whoPaid === "me" ? "me"
        : target === "person" ? personName
        : participants.find((p) => p.id === otherPayerId)?.name ?? "other";
      const paidByPersonId: string | null = whoPaid === "me" ? null
        : target === "person" ? personId || null
        : otherPayerId || null;
      const { error } = await supabase.from("splits").update({
        total_amount: total,
        type: target === "group" ? "group" : "individual",
        person_id: target === "person" && personId ? personId : null,
        group_id: target === "group" && groupId ? groupId : null,
        paid_by: paidByName,
        paid_by_person_id: paidByPersonId,
        split_type: splitType,
        category_id: categoryId || null,
        sub_category_id: subCatId || null,
        account_id: whoPaid === "me" && accountId ? accountId : null,
        date, time, description: note || null,
      }).eq("id", split.id);
      if (error) throw error;
    },
    onSuccess: () => {
      notifyToast("split_added", "Split updated");
      qc.invalidateQueries({ queryKey: ["splits"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="bg-card border-border rounded-t-3xl p-0 h-[88dvh] flex flex-col">
          <SheetTitle className="sr-only">Edit Split</SheetTitle>
          <div className="px-5 pt-5 pb-3 border-b border-border">
            <span className="text-base font-semibold">Edit Split</span>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            <div className="text-center py-2">
              <input inputMode="decimal" value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                className="w-full bg-transparent text-center text-5xl font-mono font-semibold outline-none text-split" />
              <p className="text-xs text-muted-foreground mt-1 font-mono">{currencySymbol}</p>
            </div>

            <div className="space-y-1.5">
              <Label>Split with</Label>
              <div className="flex gap-2 rounded-lg bg-secondary p-1">
                {(["person", "multi", "group"] as const).map((m) => (
                  <button type="button" key={m} onClick={() => setTarget(m)}
                    className={cn("flex-1 rounded-md py-1.5 text-xs font-medium capitalize", target === m && "bg-primary text-white")}>
                    {m === "multi" ? "People" : m}
                  </button>
                ))}
              </div>
              {target === "person" && (
                <button type="button" onClick={() => setPersonPickerOpen(true)}
                  className="w-full flex items-center justify-between px-3 py-2.5 bg-secondary rounded-lg text-sm">
                  <span className={personName ? "text-foreground" : "text-muted-foreground"}>{personName || "Select person"}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
              {target === "multi" && (
                <button type="button" onClick={() => setMultiPickerOpen(true)}
                  className="w-full flex items-center justify-between px-3 py-2.5 bg-secondary rounded-lg text-sm">
                  <span className={multiPeople.length > 0 ? "text-foreground" : "text-muted-foreground"}>
                    {multiPeople.length > 0 ? multiPeople.map((p) => p.name).join(", ") : "Select people"}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
              {target === "group" && (
                <button type="button" onClick={() => setGroupPickerOpen(true)}
                  className="w-full flex items-center justify-between px-3 py-2.5 bg-secondary rounded-lg text-sm">
                  <span className={groupName ? "text-foreground" : "text-muted-foreground"}>{groupName || "Select group"}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Who paid?</Label>
              <div className="flex gap-2 rounded-lg bg-secondary p-1">
                {(["me", "other"] as const).map((m) => (
                  <button type="button" key={m} onClick={() => { setWhoPaid(m); setOtherPayerId(""); }}
                    className={cn("flex-1 rounded-md py-1.5 text-sm", whoPaid === m && "bg-primary text-white")}>
                    {m === "me" ? "You paid" : "Other paid"}
                  </button>
                ))}
              </div>
              {whoPaid === "other" && target === "person" && personName && (
                <p className="text-xs text-muted-foreground px-1">{personName} paid</p>
              )}
              {whoPaid === "other" && (target === "multi" || target === "group") && participants.length > 0 && (
                <Select value={otherPayerId} onValueChange={setOtherPayerId}>
                  <SelectTrigger><SelectValue placeholder="Select who paid" /></SelectTrigger>
                  <SelectContent>{participants.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              )}
            </div>

            {whoPaid === "me" && (
              <div className="space-y-1.5">
                <Label>Paid from</Label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{(accounts as any[]).map((a) => <SelectItem key={a.id} value={a.id}>{[a.institution, a.label].filter(Boolean).join(" · ")}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Split type</Label>
              <div className="flex gap-2 rounded-lg bg-secondary p-1">
                {(["equal", "custom"] as const).map((m) => (
                  <button type="button" key={m} onClick={() => setSplitType(m)}
                    className={cn("flex-1 rounded-md py-1.5 text-sm capitalize", splitType === m && "bg-primary text-white")}>{m}</button>
                ))}
              </div>
              {splitType === "equal" && participants.length > 0 && (
                <p className="text-xs text-muted-foreground">Each person pays: {formatMoney(equalShare)}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Category</Label>
              <button type="button" onClick={() => setCatPickerOpen(true)}
                className="w-full flex items-center justify-between px-3 py-2.5 bg-secondary rounded-lg text-sm">
                <span className={categoryId ? "text-foreground" : "text-muted-foreground"}>
                  {categoryId ? `${categoryIcon} ${categoryName}${subCatName ? " · " + subCatName : ""}` : "Select category (optional)"}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground outline-none" />
              </div>
              <div className="space-y-1.5">
                <Label>Time</Label>
                <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground outline-none" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Note</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
            </div>
          </div>

          <div className="p-4 border-t border-border">
            <Button className="w-full bg-[oklch(0.40_0.13_70)] hover:bg-[oklch(0.45_0.13_70)] text-white"
              onClick={() => {
                const amt = Number(amount);
                if (!amount || isNaN(amt) || amt <= 0) {
                  toast.error("Please enter a valid amount greater than 0");
                  return;
                }
                mutation.mutate();
              }} disabled={mutation.isPending}>
              {mutation.isPending ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <CategoryPickerSheet open={catPickerOpen} onOpenChange={setCatPickerOpen}
        onSelect={(cId, cName, cIcon, sId, sName) => {
          setCategoryId(cId); setCategoryName(cName); setCategoryIcon(cIcon);
          setSubCatId(sId ?? ""); setSubCatName(sName ?? "");
        }} />
      <SimplePersonPicker open={personPickerOpen} onOpenChange={setPersonPickerOpen}
        onSelect={(id, name) => { setPersonId(id); setPersonName(name); }} />
      <MultiPersonPicker open={multiPickerOpen} onOpenChange={setMultiPickerOpen}
        selected={multiPeople} onConfirm={setMultiPeople} />
      <SimpleGroupPicker open={groupPickerOpen} onOpenChange={setGroupPickerOpen}
        onSelect={(id, name) => { setGroupId(id); setGroupName(name); }} />
    </>
  );
}

function CategoryPickerSheet({ open, onOpenChange, onSelect }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  onSelect: (catId: string, catName: string, catIcon: string, subId?: string, subName?: string) => void;
}) {
  const { data: cats = [] } = useQuery(categoriesQuery("expense"));
  const [activeCatId, setActiveCatId] = useState("");
  const { data: subs = [] } = useQuery(subCategoriesQuery(activeCatId || null));
  useEffect(() => { if (cats.length > 0 && !activeCatId) setActiveCatId((cats[0] as any).id); }, [cats]);
  const activeCat = (cats as any[]).find((c) => c.id === activeCatId);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="bg-card border-border rounded-t-3xl p-0 h-[75dvh] flex flex-col">
        <SheetTitle className="sr-only">Select Category</SheetTitle>
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border">
          <span className="text-base font-semibold">Category</span>
          <button type="button" onClick={() => onOpenChange(false)} className="text-muted-foreground"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex flex-1 min-h-0">
          <div className="w-[45%] border-r border-border overflow-y-auto">
            {(cats as any[]).map((c) => (
              <button key={c.id} type="button" onClick={() => setActiveCatId(c.id)}
                className={cn("w-full flex items-center justify-between px-4 py-4 text-left text-sm border-b border-border",
                  activeCatId === c.id ? "bg-primary/10 text-primary font-medium" : "bg-card text-foreground")}>
                <span className="truncate">{c.icon} {c.name}</span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 ml-1 text-muted-foreground" />
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto">
            {activeCat && (
              <button type="button" onClick={() => { onSelect(activeCat.id, activeCat.name, activeCat.icon ?? ""); onOpenChange(false); }}
                className="w-full px-4 py-4 text-left text-sm border-b border-border text-primary font-medium bg-primary/5">
                {activeCat.icon} {activeCat.name} only
              </button>
            )}
            {(subs as any[]).map((s) => (
              <button key={s.id} type="button"
                onClick={() => { onSelect(activeCat!.id, activeCat!.name, activeCat!.icon ?? "", s.id, s.name); onOpenChange(false); }}
                className="w-full px-4 py-4 text-left text-sm border-b border-border bg-card hover:bg-secondary/40 text-foreground">
                {s.name}
              </button>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SimplePersonPicker({ open, onOpenChange, onSelect }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  onSelect: (id: string, name: string) => void;
}) {
  const { data: people = [] } = useQuery(peopleQuery());
  const [addOpen, setAddOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="bg-card border-border rounded-t-3xl p-0 h-[75dvh] flex flex-col">
          <SheetTitle className="sr-only">Select Person</SheetTitle>
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border">
            <span className="text-base font-semibold">Person</span>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setQrOpen(true)} className="text-muted-foreground"><QrCode className="h-5 w-5" /></button>
              <button type="button" onClick={() => setAddOpen(true)} className="text-muted-foreground"><Plus className="h-5 w-5" /></button>
              <button type="button" onClick={() => onOpenChange(false)} className="text-muted-foreground"><X className="h-5 w-5" /></button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {(people as any[]).map((p) => (
              <div key={p.id} onClick={() => { onSelect(p.id, p.name); onOpenChange(false); }}
                className="flex items-center gap-3 px-5 py-4 bg-card cursor-pointer active:bg-secondary/40">
                <div className="flex-1">
                  <p className="text-sm font-medium">{p.name}</p>
                  {p.phone_number && <p className="text-xs text-muted-foreground">{p.phone_number}</p>}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
      <AddPersonDialog open={addOpen} onOpenChange={setAddOpen} />
      <QrScannerDialog open={qrOpen} onOpenChange={setQrOpen} onResult={() => {}} />
    </>
  );
}

function MultiPersonPicker({ open, onOpenChange, selected, onConfirm }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  selected: { id: string; name: string }[];
  onConfirm: (people: { id: string; name: string }[]) => void;
}) {
  const { data: people = [] } = useQuery(peopleQuery());
  const [checked, setChecked] = useState<Set<string>>(new Set(selected.map((p) => p.id)));
  const [addOpen, setAddOpen] = useState(false);
  useEffect(() => { if (open) setChecked(new Set(selected.map((p) => p.id))); }, [open]);
  function toggle(id: string) { setChecked((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
  function confirm() { onConfirm((people as any[]).filter((p) => checked.has(p.id)).map((p) => ({ id: p.id, name: p.name }))); onOpenChange(false); }
  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="bg-card border-border rounded-t-3xl p-0 h-[75dvh] flex flex-col">
          <SheetTitle className="sr-only">Select People</SheetTitle>
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border">
            <span className="text-base font-semibold">Select People</span>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setAddOpen(true)} className="text-muted-foreground"><Plus className="h-5 w-5" /></button>
              <button type="button" onClick={() => onOpenChange(false)} className="text-muted-foreground"><X className="h-5 w-5" /></button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {(people as any[]).map((p) => (
              <div key={p.id} onClick={() => toggle(p.id)}
                className="flex items-center gap-3 px-5 py-4 bg-card cursor-pointer active:bg-secondary/40">
                <div className={cn("h-5 w-5 rounded border-2 flex items-center justify-center shrink-0",
                  checked.has(p.id) ? "bg-primary border-primary" : "border-border")}>
                  {checked.has(p.id) && <Check className="h-3 w-3 text-white" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{p.name}</p>
                  {p.phone_number && <p className="text-xs text-muted-foreground">{p.phone_number}</p>}
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-border">
            <Button className="w-full bg-primary text-white" onClick={confirm} disabled={checked.size === 0}>
              Confirm ({checked.size} selected)
            </Button>
          </div>
        </SheetContent>
      </Sheet>
      <AddPersonDialog open={addOpen} onOpenChange={setAddOpen} />
    </>
  );
}

function SimpleGroupPicker({ open, onOpenChange, onSelect }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  onSelect: (id: string, name: string) => void;
}) {
  const { data: groups = [] } = useQuery(groupsQuery());
  const [addOpen, setAddOpen] = useState(false);
  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="bg-card border-border rounded-t-3xl p-0 h-[75dvh] flex flex-col">
          <SheetTitle className="sr-only">Select Group</SheetTitle>
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border">
            <span className="text-base font-semibold">Group</span>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setAddOpen(true)} className="text-muted-foreground"><Plus className="h-5 w-5" /></button>
              <button type="button" onClick={() => onOpenChange(false)} className="text-muted-foreground"><X className="h-5 w-5" /></button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {(groups as any[]).map((g) => (
              <div key={g.id} onClick={() => { onSelect(g.id, g.name); onOpenChange(false); }}
                className="flex items-center gap-3 px-5 py-4 bg-card cursor-pointer active:bg-secondary/40">
                <div className="flex-1">
                  <p className="text-sm font-medium">{g.name}</p>
                  <p className="text-xs text-muted-foreground">{g.group_members?.length ?? 0} members</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
      <AddGroupDialog open={addOpen} onOpenChange={setAddOpen} />
    </>
  );
}