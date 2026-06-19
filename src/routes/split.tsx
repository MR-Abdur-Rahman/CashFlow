import { useRealtimeSplits } from "@/hooks/useRealtimeSplits";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { peopleQuery, groupsQuery, splitsQuery, incomingSplitsQuery, accountsQuery, categoriesQuery, subCategoriesQuery } from "@/lib/queries";
import { Users, Plus, ChevronRight, Archive, QrCode, X, Check, ChevronLeft, ChevronDown } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
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
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subWeeks, addWeeks, subMonths, addMonths, subYears, addYears } from "date-fns";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Period = "weekly" | "monthly" | "annually";
type StatusFilter = "all" | "unsettled" | "settled";

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

// ─── Helper: get display label for a split ────────────────────────────────
// For own splits: show who you split WITH (not yourself)
// For group: show group name
// For multi-person: show all share names joined
function getSplitLabel(s: any): string {
  if (s.type === "group" && s.groups?.name) return s.groups.name;
  // Individual split — show the person you split with
  if (s.type === "individual" && s.people?.name) return s.people.name;
  // Multi-person — show all names from split_shares
  const names = (s.split_shares ?? []).map((sh: any) => sh.person_name).filter(Boolean);
  if (names.length > 0) return names.join(", ");
  return s.description || "Split";
}

export default function SplitPage() {
  useRealtimeSplits();
  const { data: people = [] } = useQuery(peopleQuery());
  const { data: groups = [] } = useQuery(groupsQuery());
  const { data: splits = [] } = useQuery(splitsQuery());
  const { data: incomingSplits = [] } = useQuery(incomingSplitsQuery());
  const qc = useQueryClient();
  const [addPerson, setAddPerson] = useState(false);
  const [addGroup, setAddGroup] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanned, setScanned] = useState<{ name?: string; phone?: string } | undefined>();
  const [deleteSplit, setDeleteSplit] = useState<any | null>(null);
  const [editSplit, setEditSplit] = useState<any | null>(null);
  const [settleItem, setSettleItem] = useState<{ share: any; split: any } | null>(null);

  // History filters
  const [period, setPeriod] = useState<Period>("monthly");
  const [anchor, setAnchor] = useState(new Date());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const { from, to } = getPeriodRange(period, anchor);
  const dateFrom = format(from, "yyyy-MM-dd");
  const dateTo = format(to, "yyyy-MM-dd");

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

    // Own splits — person owes me
    for (const s of splits as any[]) {
      for (const sh of (s.split_shares ?? [])) {
        if (sh.person_id !== personId) continue;
        const settled = (s.settlements ?? []).filter((x: any) => x.split_share_id === sh.id)
          .reduce((a: number, x: any) => a + Number(x.amount), 0);
        owed += Number(sh.share_amount) - settled;
      }
    }

    // Incoming splits — I owe them (negative)
    // Match by linked_user_id: person.linked_user_id = creator of incoming split
    const person = (people as any[]).find((p) => p.id === personId);
    if (person?.linked_user_id) {
      for (const s of incomingSplits as any[]) {
        if (s._createdByUserId !== person.linked_user_id) continue;
        const myPersonId = s._myPersonId;
        if (!myPersonId) continue;
        for (const sh of (s.split_shares ?? [])) {
          if (sh.person_id !== myPersonId) continue;
          const settled = (s.settlements ?? []).filter((x: any) => x.split_share_id === sh.id)
            .reduce((a: number, x: any) => a + Number(x.amount), 0);
          owed -= Number(sh.share_amount) - settled;
        }
      }
    }

    return owed;
  }

  function firstUnsettledShare(s: any) {
    return (s.split_shares ?? []).find((sh: any) => !sh.is_settled);
  }

  // Filter splits by period and status
  const filteredSplits = useMemo(() => {
    return (splits as any[]).filter((s) => {
      if (s.date < dateFrom || s.date > dateTo) return false;
      const totalShares = (s.split_shares ?? []).length;
      const settledShares = (s.split_shares ?? []).filter((sh: any) => sh.is_settled).length;
      const isFullySettled = totalShares > 0 && settledShares === totalShares;
      if (statusFilter === "settled" && !isFullySettled) return false;
      if (statusFilter === "unsettled" && isFullySettled) return false;
      return true;
    });
  }, [splits, dateFrom, dateTo, statusFilter]);

  return (
    <div className="px-4 pt-6 space-y-5 pb-24">
      <h1 className="text-xl font-semibold">Split</h1>

      {/* People Section */}
      <Section title="People" action={
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => setScanOpen(true)}><QrCode className="h-4 w-4" /></Button>
          <Button size="sm" variant="ghost" onClick={() => { setScanned(undefined); setAddPerson(true); }}><Plus className="h-4 w-4" /></Button>
        </div>
      }>
        {people.length === 0 ? <Empty text="No people yet" /> : (
          <div className="divide-y divide-border">
            {(people as any[]).map((p) => {
              const bal = personBalance(p.id);
              return (
                <Link key={p.id} to={`/split/person/${p.id}`} className="flex items-center gap-3 p-4 active:bg-secondary/40">
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
      <Section title="Groups" action={
        <Button size="sm" variant="ghost" onClick={() => setAddGroup(true)}><Plus className="h-4 w-4" /></Button>
      }>
        {groups.length === 0 ? <Empty text="No groups yet" /> : (
          <div className="divide-y divide-border">
            {(groups as any[]).map((g) => (
              <Link key={g.id} to={`/split/group/${g.id}`} className="flex items-center gap-3 p-4 active:bg-secondary/40">
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
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">History</p>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-2 mb-3">
          <button type="button"
            onClick={() => setAnchor(navigateAnchor(period, anchor, -1))}
            className="h-8 w-8 flex items-center justify-center rounded-full bg-secondary text-foreground shrink-0">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold shrink-0">{formatAnchorLabel(period, anchor)}</span>
          <button type="button"
            onClick={() => setAnchor(navigateAnchor(period, anchor, 1))}
            className="h-8 w-8 flex items-center justify-center rounded-full bg-secondary text-foreground shrink-0">
            <ChevronRight className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-2 ml-auto shrink-0">
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

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 bg-secondary text-foreground text-sm font-medium px-3 py-1.5 rounded-xl">
                  {statusFilter === "all" ? "All" : statusFilter === "unsettled" ? "Pending" : "Settled"}
                  <ChevronDown className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36">
                {(["all", "unsettled", "settled"] as StatusFilter[]).map((s) => (
                  <DropdownMenuItem key={s} onClick={() => setStatusFilter(s)}
                    className={cn("py-3 text-base", statusFilter === s && "text-primary font-medium")}>
                    {s === "all" ? "All" : s === "unsettled" ? "Pending" : "Settled"}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
          {filteredSplits.length === 0 ? <Empty text="No splits for this period" /> : (
            <div className="divide-y divide-border">
              {filteredSplits.map((s) => {
                const unsettled = firstUnsettledShare(s);
                const totalShares = (s.split_shares ?? []).length;
                const settledShares = (s.split_shares ?? []).filter((sh: any) => sh.is_settled).length;
                const isFullySettled = totalShares > 0 && settledShares === totalShares;
                const label = getSplitLabel(s);

                return (
                  <SwipeRow key={s.id} onEdit={() => setEditSplit(s)} onDelete={() => setDeleteSplit(s)}>
                    <div className="flex items-center gap-3 px-4 py-3 bg-card">
                      <div className="h-9 w-9 rounded-full bg-split/20 flex items-center justify-center text-split shrink-0">
                        <Users className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{label}</p>
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
        </div>
      </div>

      <AddPersonDialog open={addPerson} onOpenChange={setAddPerson} initial={scanned} />
      <AddGroupDialog open={addGroup} onOpenChange={setAddGroup} />
      <QrScannerDialog open={scanOpen} onOpenChange={setScanOpen} onScan={handleScan} />

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
        <EditSplitSheet split={editSplit} open={!!editSplit} onOpenChange={(o) => { if (!o) setEditSplit(null); }} />
      )}

      {settleItem && (
        <SettleUpDialog open={!!settleItem} onOpenChange={(o) => { if (!o) setSettleItem(null); }}
          share={settleItem.share} split={settleItem.split} />
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
      const { error } = await supabase.from("splits").update({
        total_amount: total,
        type: target === "group" ? "group" : "individual",
        person_id: target === "person" && personId ? personId : null,
        group_id: target === "group" && groupId ? groupId : null,
        paid_by: paidByName,
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
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{title}</p>
        {action}
      </div>
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">{children}</div>
    </div>
  );
}
