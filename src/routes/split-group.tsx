import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { groupQuery, groupSplitsQuery, accountsQuery, categoriesQuery, subCategoriesQuery, peopleQuery, groupsQuery } from "@/lib/queries";
import { ArrowLeft, Archive, Pencil, Trash2, Plus, Users, CheckCircle2, ChevronLeft, ChevronRight, ChevronDown, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SettleUpDialog } from "@/components/SettleUpDialog";
import { SwipeRow } from "@/components/SwipeRow";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState, useMemo, useEffect } from "react";
import { AddGroupDialog } from "@/components/AddGroupDialog";
import { AddPersonDialog } from "@/components/AddPersonDialog";
import { AddTransactionSheet } from "@/components/AddTransactionSheet";
import { Link, useParams, useNavigate } from "react-router-dom";
import { formatMoney } from "@/lib/format";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfYear, endOfYear, subMonths, addMonths, subWeeks, addWeeks, subYears, addYears } from "date-fns";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ─── Helper: get display label for a split ────────────────────────────────
function getSplitLabel(s: any): string {
  if (s.type === "group" && s.groups?.name) return s.groups.name;
  if (s.type === "individual" && s.people?.name) return s.people.name;
  const names = (s.split_shares ?? []).map((sh: any) => sh.person_name).filter(Boolean);
  if (names.length > 0) return names.join(", ");
  return s.description || "Split";
}

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

export default function GroupDetail() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: group } = useQuery(groupQuery(groupId!));
  const { data: splits = [] } = useQuery(groupSplitsQuery(groupId!));
  const [edit, setEdit] = useState(false);
  const [addSplitOpen, setAddSplitOpen] = useState(false);
  const [period, setPeriod] = useState<Period>("monthly");
  const [anchor, setAnchor] = useState(new Date());
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["groups"] }); toast.success("Group deleted"); navigate(-1); },
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

  if (!group) return <div className="p-6">Group not found</div>;

  // Detect legacy mixed groups (both local and linked members) — splits misbehave for these.
  const memberPeople = ((group as any).group_members ?? []).map((m: any) => m.people).filter(Boolean);
  const hasLinkedMember = memberPeople.some((p: any) => !!p.linked_user_id);
  const hasLocalMember = memberPeople.some((p: any) => !p.linked_user_id);
  const isMixedGroup = hasLinkedMember && hasLocalMember;

  return (
    <div className="px-4 pt-4 pb-24 space-y-5">
      <Link to="/split" className="inline-flex items-center text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4 mr-1" /> Split
      </Link>

      <div>
        <h1 className="text-xl font-semibold">{group.name}</h1>
        <p className="text-xs text-muted-foreground">{(group as any).group_members?.length ?? 0} members</p>
      </div>

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

      {isMixedGroup && (
        <div className="rounded-xl border border-[#F59E0B]/40 bg-[#F59E0B]/10 px-3 py-2.5 text-xs text-[#F59E0B]">
          This group has both local and linked members. Splits may not work correctly.
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" disabled={isMixedGroup} onClick={() => setAddSplitOpen(true)}><Plus className="h-4 w-4 mr-2" /> Add Split</Button>
        <Button variant="outline" onClick={() => setEdit(true)}><Pencil className="h-4 w-4 mr-2" /> Edit</Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={() => archive.mutate()}>
          <Archive className="h-4 w-4 mr-2" /> {group.is_archived ? "Unarchive" : "Archive"}
        </Button>
        <Button variant="outline" className="text-expense" onClick={() => { if (confirm("Delete group?")) del.mutate(); }}>
          <Trash2 className="h-4 w-4 mr-2" /> Delete
        </Button>
      </div>

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
          <div className="surface-card p-6 text-center text-sm text-muted-foreground">
            {(splits as any[]).length === 0 ? "No splits yet" : "No splits this period"}
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden border border-border divide-y divide-border">
            {filteredSplits.map((s: any) => {
              const totalShares = (s.split_shares ?? []).length;
              const settledShares = (s.split_shares ?? []).filter((sh: any) => sh.is_settled).length;
              const isFullySettled = totalShares > 0 && settledShares === totalShares;
              const unsettledShare = (s.split_shares ?? []).find((sh: any) => !sh.is_settled);
              const label = getSplitLabel(s);
              return (
                <SwipeRow key={s.id} onEdit={() => setEditSplit(s)} onDelete={() => setDeleteSplit(s)}
                  canEdit={!s._isIncoming} canDelete={!s._isIncoming}
                  editDeniedMessage="Only the creator can edit this split"
                  deleteDeniedMessage="Only the creator can delete this split">
                  <div className="flex items-center gap-3 px-4 py-3 bg-card">
                    <div className="h-9 w-9 rounded-full bg-split/20 flex items-center justify-center text-split shrink-0">
                      <Users className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{label}</p>
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

      {editSplit && (
        <EditSplitSheet split={editSplit} open={!!editSplit} onOpenChange={(o) => { if (!o) setEditSplit(null); }} />
      )}
    </div>
  );
}

// ─── Full Edit Split Sheet ─────────────────────────────────────────────────
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

  useEffect(() => { if (accounts.length > 0 && !accountId) setAccountId((accounts[0] as any).id); }, [accounts]);
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
              <p className="text-xs text-muted-foreground mt-1 font-mono">LKR</p>
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
              onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <CategoryPickerSheet open={catPickerOpen} onOpenChange={setCatPickerOpen}
        onSelect={(cId, cName, cIcon, sId, sName) => { setCategoryId(cId); setCategoryName(cName); setCategoryIcon(cIcon); setSubCatId(sId ?? ""); setSubCatName(sName ?? ""); }} />
      <SimplePersonPicker open={personPickerOpen} onOpenChange={setPersonPickerOpen}
        onSelect={(id, name) => { setPersonId(id); setPersonName(name); }} />
      <MultiPersonPicker open={multiPickerOpen} onOpenChange={setMultiPickerOpen}
        selected={multiPeople} onConfirm={setMultiPeople} />
      <SimpleGroupPicker open={groupPickerOpen} onOpenChange={setGroupPickerOpen}
        onSelect={(id, name) => { setGroupId(id); setGroupName(name); }} />
    </>
  );
}

// ─── Category Picker ───────────────────────────────────────────────────────
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
  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="bg-card border-border rounded-t-3xl p-0 h-[75dvh] flex flex-col">
          <SheetTitle className="sr-only">Select Person</SheetTitle>
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border">
            <span className="text-base font-semibold">Person</span>
            <div className="flex items-center gap-3">
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
