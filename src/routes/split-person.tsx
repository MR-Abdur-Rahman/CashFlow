import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { personQuery, personSplitsQuery, peopleQuery, groupsQuery, accountsQuery, categoriesQuery, subCategoriesQuery } from "@/lib/queries";
import { ArrowLeft, Bell, Plus, Users, CheckCircle2, ChevronLeft, ChevronRight, ChevronDown, QrCode, X, Check } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { SendReminderDialog } from "@/components/SendReminderDialog";
import { AddTransactionSheet } from "@/components/AddTransactionSheet";
import { SettleUpDialog } from "@/components/SettleUpDialog";
import { SwipeRow } from "@/components/SwipeRow";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState, useMemo, useEffect, Fragment } from "react";
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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("monthly");
  const [anchor, setAnchor] = useState(new Date());
  const [reminderOpen, setReminderOpen] = useState(false);
  const [addSplitOpen, setAddSplitOpen] = useState(false);
  const [settleOpen, setSettleOpen] = useState(false);
  const [deleteSplit, setDeleteSplit] = useState<any | null>(null);
  const [editSplit, setEditSplit] = useState<any | null>(null);
  const [settleItem, setSettleItem] = useState<{ share: any; split: any } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
  }, []);

  const totals = (splits as any[]).reduce((acc, s) => {
    const targetPersonId = s._isIncoming ? s._myPersonId : personId;
    if (!targetPersonId) return acc;

    if (s._isIncoming) {
      const myShareRecord = (s.split_shares ?? []).find((sh: any) => sh.person_id === targetPersonId);
      if (!myShareRecord) return acc;
      const settled = (s.settlements ?? []).filter((x: any) => x.split_share_id === myShareRecord.id)
        .reduce((a: number, x: any) => a + Number(x.amount), 0);

      // For incoming: paid_by="me" = creator paid → I owe; paid_by_person_id===mine → I paid → they owe me
      const isCreatorPaid = s.paid_by === "me";
      const iMePaid = s.paid_by_person_id != null
        ? s.paid_by_person_id === targetPersonId
        : !isCreatorPaid;

      if (iMePaid) {
        // I paid → creator owes me their implicit share
        const totalSharesSum = (s.split_shares ?? []).reduce((sum: number, sh: any) => sum + Number(sh.share_amount), 0);
        acc.owed += Number(s.total_amount) - totalSharesSum;
      } else {
        // Creator paid → I owe my share
        acc.iOwe += Number(myShareRecord.share_amount) - settled;
      }
    } else {
      for (const sh of (s.split_shares ?? [])) {
        if (sh.person_id !== targetPersonId) continue;
        const settled = (s.settlements ?? []).filter((x: any) => x.split_share_id === sh.id)
          .reduce((a: number, x: any) => a + Number(x.amount), 0);
        acc.owed += Number(sh.share_amount);
        acc.paid += settled;
      }
    }
    return acc;
  }, { owed: 0, paid: 0, iOwe: 0 });

  const balance = (totals.owed - totals.paid) - totals.iOwe;

  const unsettledItems = useMemo(() => {
    return (splits as any[]).flatMap((s) => {
      const targetPersonId = s._isIncoming ? s._myPersonId : personId;
      if (!targetPersonId) return [];
      return (s.split_shares ?? [])
        .filter((sh: any) => sh.person_id === targetPersonId && !sh.is_settled)
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

  const filteredSplits = useMemo(() =>
    (splits as any[]).filter((s) => s.date >= fromStr && s.date <= toStr),
    [splits, fromStr, toStr]
  );

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
        {unsettledItems.length > 0 && (
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

        {filteredSplits.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            {(splits as any[]).length === 0 ? "No splits yet" : "No splits this period"}
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden border border-border divide-y divide-border">
            {filteredSplits.map((s: any) => {
              const targetPersonId = s._isIncoming ? s._myPersonId : personId;
              const myShares = (s.split_shares ?? []).filter((sh: any) => sh.person_id === targetPersonId);
              const myTotal = myShares.reduce((a: number, sh: any) => a + Number(sh.share_amount), 0);
              const totalSettled = myShares.reduce((acc: number, sh: any) =>
                acc + (s.settlements ?? []).filter((x: any) => x.split_share_id === sh.id)
                  .reduce((a: number, x: any) => a + Number(x.amount), 0), 0);
              const remaining = myTotal - totalSettled;
              const isSettled = remaining <= 0.005;
              const unsettledShare = myShares.find((sh: any) => !sh.is_settled);
              const label = getSplitLabel(s, person?.name);

              const shareSettlements = myShares.flatMap((sh: any) =>
                (s.settlements ?? []).filter((st: any) => st.split_share_id === sh.id)
              ).sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

              let runningPaid = 0;
              const settlementRows = shareSettlements.map((st: any) => {
                runningPaid += Number(st.amount);
                const bal = myTotal - runningPaid;
                const done = bal <= 0.005;
                const settlerName = st.created_by === currentUserId ? "You" : (person?.name ?? "");
                return { st, bal, done, settlerName };
              });

              return (
                <Fragment key={s.id}>
                  <SwipeRow onEdit={() => setEditSplit(s)} onDelete={() => setDeleteSplit(s)}>
                    <div className="flex items-center gap-3 px-4 py-3 bg-card">
                      <div className="h-9 w-9 rounded-full bg-split/20 flex items-center justify-center text-split shrink-0">
                        <Users className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{label}</p>
                        <p className="text-xs text-muted-foreground">paid by {s.paid_by}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-mono font-semibold text-split">{formatMoney(myTotal)}</p>
                        <p className="text-xs text-muted-foreground font-mono">{formatMoney(s.total_amount)}</p>
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
                  {settlementRows.map(({ st, bal, done, settlerName }) => (
                    <div key={st.id} className="flex items-center gap-3 px-4 py-2 bg-secondary/30 pl-16">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground">{settlerName}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-mono font-semibold text-income">+{formatMoney(Number(st.amount))}</p>
                        {done
                          ? <p className="text-xs text-income inline-flex items-center gap-0.5"><CheckCircle2 className="h-3 w-3" /> Settled</p>
                          : <p className="text-xs text-muted-foreground font-mono">{formatMoney(bal)} remaining</p>
                        }
                      </div>
                    </div>
                  ))}
                </Fragment>
              );
            })}
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

      {settleItem && (
        <SettleUpDialog
          open={!!settleItem}
          onOpenChange={(o) => { if (!o) setSettleItem(null); }}
          share={settleItem.share}
          split={settleItem.split}
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

              // Notify linked participants BEFORE deleting (so FK is valid)
              const personIds = (deleteSplit.split_shares ?? []).map((sh: any) => sh.person_id).filter(Boolean);
              if (personIds.length > 0) {
                const { data: linked } = await supabase
                  .from("people").select("linked_user_id")
                  .in("id", personIds).not("linked_user_id", "is", null);
                if (linked && linked.length > 0) {
                  const { data: creatorProfile } = await supabase
                    .from("profiles").select("full_name").eq("id", u.user.id).maybeSingle();
                  const creatorName = creatorProfile?.full_name ?? "Someone";
                  await supabase.from("notifications").insert(
                    linked.map((p: any) => ({
                      user_id: p.linked_user_id,
                      type: "split_deleted",
                      title: "Split deleted",
                      message: `${creatorName} deleted the split: ${deleteSplit.description || "Split"}`,
                      related_split_id: deleteSplit.id,
                      is_read: false,
                    }))
                  );
                }
              }

              const { error } = await supabase.from("splits").delete().eq("id", deleteSplit.id);
              if (error) toast.error(error.message);
              else {
                toast.success("Split deleted");
                qc.invalidateQueries({ queryKey: ["splits"] });
                qc.invalidateQueries({ queryKey: ["transactions"] });
                qc.invalidateQueries({ queryKey: ["accounts"] });
              }
              setDeleteSplit(null);
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
      toast.success("Split updated");
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