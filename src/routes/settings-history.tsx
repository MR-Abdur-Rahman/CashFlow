import { useQuery, useQueryClient } from "@tanstack/react-query";
import { transactionsQuery, incomingSplitsQuery, splitsQuery, splitBalancesQuery, peopleQuery } from "@/lib/queries";
import { settlementNetAfter } from "@/lib/balance";
import { SplitDirectRow, EditSplitSheet, EditTxSheet } from "./home";
import { SettlementRow } from "@/components/SettlementRow";
import { settlementDirection, shareRemaining } from "@/lib/settlement";
import { SettlementEditSheet } from "@/components/SettlementEditSheet";
import { formatMoney } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";
import { ArrowLeft, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Users, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SwipeRow } from "@/components/SwipeRow";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { canModifySplit, deleteSplit as runSplitDelete } from "@/lib/deleteSplit";
import { canDeleteSettlement, deleteSettlement as deleteSettlementRpc } from "@/lib/deleteSettlement";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { type Period, PERIODS, periodLabel, getPeriodRange, navigateAnchor, formatAnchorLabel } from "@/lib/period";

export default function HistoryPage() {
  const [searchParams] = useSearchParams();
  const { data: txns = [] } = useQuery(transactionsQuery());
  const { data: ownSplits = [] } = useQuery(splitsQuery());
  const { data: incomingSplits = [] } = useQuery(incomingSplitsQuery());
  // Settlements involving me (RLS-scoped). Display only — balances already account for them.
  const { data: settlements = [] } = useQuery({
    queryKey: ["history-settlements"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data } = await supabase
        .from("settlements")
        .select("*, person:person_id(name), creator:created_by(full_name), accounts:account_id(label, institution), split_shares:split_share_id(person_name, share_amount, person:people(linked_user_id)), splits:split_id(description, paid_by, created_by, creator:created_by(full_name), paid_by_person:paid_by_person_id(linked_user_id, name))")
        .order("created_at", { ascending: false });
      return (data ?? []).map((s: any) => ({ ...s, _uid: u.user!.id }));
    },
  });
  const { data: people = [] } = useQuery(peopleQuery());
  const [q, setQ] = useState("");
  const [type, setType] = useState<string>(searchParams.get("filter") ?? "all");
  // Search index for people: "name phone", keyed by contact id AND by their linked user id, so the
  // search box can match a split/settlement by the person's name or mobile number.
  const personSearch = useMemo(() => {
    const byId = new Map<string, string>();
    const byUid = new Map<string, string>();
    for (const p of people as any[]) {
      const s = [p.name, p.phone_number].filter(Boolean).join(" ").toLowerCase();
      byId.set(p.id, s);
      if (p.linked_user_id) byUid.set(p.linked_user_id, s);
    }
    return { byId, byUid };
  }, [people]);
  const [period, setPeriod] = useState<Period>("monthly");
  const [anchor, setAnchor] = useState(new Date());
  const [editTxn, setEditTxn] = useState<any | null>(null);
  const [deleteTxn, setDeleteTxn] = useState<any | null>(null);
  const [editSplit, setEditSplit] = useState<any | null>(null);
  const [deleteSplit, setDeleteSplit] = useState<any | null>(null);
  const [editSettlement, setEditSettlement] = useState<any | null>(null);
  const [deleteSettlement, setDeleteSettlement] = useState<any | null>(null);
  const qc = useQueryClient();

  const { from: periodFrom, to: periodTo } = useMemo(
    () => getPeriodRange(period, anchor),
    [period, anchor]
  );
  const fromStr = useMemo(() => format(periodFrom, "yyyy-MM-dd"), [periodFrom]);
  const toStr = useMemo(() => format(periodTo, "yyyy-MM-dd"), [periodTo]);

  // Non-split transactions only — own splits are rendered via SplitDirectRow (same as Home).
  const filteredTxns = useMemo(() => {
    return (txns as any[]).filter((t) => {
      if (t.is_split) return false;
      if (t.date < fromStr || t.date > toStr) return false;
      if (type === "split") return false;
      if (type !== "all" && t.type !== type) return false;
      if (!q) return true;
      const hay = [
        t.note,
        t.categories?.name,
        t.sub_categories?.name,
        t.accounts?.label,
        t.accounts?.institution,
        t.income_source_text,
        t.to_account?.label,
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q.toLowerCase());
    });
  }, [txns, q, type, fromStr, toStr]);

  // Own + incoming splits, deduped (incoming version wins) — same as Home page.
  const allSplits = useMemo(() => {
    const byId = new Map<string, any>();
    for (const s of ownSplits as any[]) byId.set(s.id, { ...s, _isIncoming: false });
    for (const s of incomingSplits as any[]) {
      byId.set(s.id, { ...s, _isIncoming: true, _myPersonId: s._myPersonId ?? null, _createdByUserId: s._createdByUserId ?? null });
    }
    return [...byId.values()];
  }, [ownSplits, incomingSplits]);

  const filteredSplits = useMemo(() => {
    // "all"/"split" → all splits. "expense" → only splits the current user PAID (their own expense):
    //   • own splits they created and paid ("me"), and
    //   • incoming splits where they were the payer and have confirmed (account_pending=false).
    // Neither creates a transaction row, so this is the single representation. Non-payer splits are
    // not expenses and are excluded under "expense".
    let base: any[];
    if (type === "all" || type === "split") base = allSplits;
    else if (type === "expense") base = allSplits.filter((s) => {
      const incomingPayer = s._isIncoming && s.paid_by_person_id != null
        && s.paid_by_person_id === s._myPersonId && s.account_pending === false;
      const ownPaid = !s._isIncoming && s.paid_by === "me" && s.category_id != null;
      return incomingPayer || ownPaid;
    });
    else return [];
    return base.filter((s) => {
      if (s.date < fromStr || s.date > toStr) return false;
      if (!q) return true;
      const hay = [
        s.description,
        s.creator?.full_name,
        s.people?.name,
        s.groups?.name,
        s.paid_by,
        s.categories?.name,
        s.accounts?.label,
        s.accounts?.institution,
        ...(s.split_shares ?? []).map((sh: any) => sh.person_name),
        // person name + phone for each involved contact (own shares, individual person, creator)
        ...(s.split_shares ?? []).map((sh: any) => personSearch.byId.get(sh.person_id)),
        personSearch.byId.get(s.person_id),
        personSearch.byUid.get(s.created_by),
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q.toLowerCase());
    });
  }, [allSplits, q, type, personSearch, fromStr, toStr]);

  const filteredSettlements = useMemo(() => {
    if (type !== "all" && type !== "settlement") return [];
    return (settlements as any[]).filter((s) => {
      const day = String(s.created_at ?? "").slice(0, 10);
      if (day < fromStr || day > toStr) return false;
      if (!q) return true;
      const hay = [
        s.description, s.splits?.description, s.person?.name, s.split_shares?.person_name, s.creator?.full_name, s.method,
        s.accounts?.label, s.accounts?.institution,
        // counterparty name + phone (whether I recorded it or they did)
        personSearch.byId.get(s.person_id),
        personSearch.byUid.get(s.created_by),
        personSearch.byUid.get(s.pending_for_user_id),
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q.toLowerCase());
    });
  }, [settlements, q, type, personSearch, fromStr, toStr]);

  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    const push = (date: string, item: any) => {
      if (!map.has(date)) map.set(date, []);
      map.get(date)!.push(item);
    };
    for (const t of filteredTxns) push(t.date, { ...t, _kind: "txn" });
    for (const s of filteredSplits) push(s.date, { ...s, _kind: "split" });
    for (const s of filteredSettlements) push(String(s.created_at ?? "").slice(0, 10), { ...s, _kind: "settlement" });
    // Sort within each date: time DESC, then created_at DESC (most recently created first).
    // Settlements have no `time` column, so derive their time from created_at to interleave correctly.
    const timeOf = (x: any) => x._kind === "settlement"
      ? String(x.created_at ?? "").slice(11, 19)
      : String(x.time ?? "00:00:00").slice(0, 8);
    for (const arr of map.values()) arr.sort((a, b) => {
      const at = timeOf(a), bt = timeOf(b);
      if (at !== bt) return bt.localeCompare(at);
      return String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""));
    });
    return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [filteredTxns, filteredSplits, filteredSettlements]);

  return (
    <div className="px-4 pt-4 pb-24 space-y-4">
      <Link to="/settings" className="inline-flex items-center text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4 mr-1" /> Settings
      </Link>
      <h1 className="text-xl font-semibold">History</h1>
      <Input placeholder="Search by person, phone, account, category, note..." value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="flex gap-2 text-xs flex-wrap">
        {["all", "income", "expense", "transfer", "split", "settlement"].map((t) => (
          <button key={t} onClick={() => setType(t)}
            className={`px-3 py-1.5 rounded-full capitalize ${type === t ? "bg-primary text-white" : "bg-secondary"}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Period filter bar */}
      <div className="flex items-center gap-2">
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
                  className={`capitalize py-3 text-base ${period === p ? "text-primary font-medium" : ""}`}>
                  {periodLabel(p)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {grouped.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-10">No results</p>
      )}
      {grouped.map(([date, items]) => (
        <div key={date}>
          <p className="text-xs uppercase text-muted-foreground mb-2 px-1 font-mono">{format(new Date(`${date}T00:00`), "MMM dd, yyyy")}</p>
          <div className="rounded-xl overflow-hidden divide-y divide-border border border-border">
            {items.map((item) =>
              item._kind === "split" ? (
                <SwipeRow key={`split-${item.id}`} onEdit={() => setEditSplit(item)} onDelete={() => setDeleteSplit(item)}
                  canEdit={canModifySplit(item)} canDelete={canModifySplit(item)}
                  editDeniedMessage="Only the creator or payer can edit this split"
                  deleteDeniedMessage="Only the creator or payer can delete this split">
                  <SplitDirectRow s={item} />
                </SwipeRow>
              ) : item._kind === "settlement" ? (
                <SwipeRow key={`set-${item.id}`} onEdit={() => setEditSettlement(item)} onDelete={() => setDeleteSettlement(item)}
                  canEdit={item.created_by === item._uid} canDelete={canDeleteSettlement(item, item._uid)}
                  editDeniedMessage="Only the creator can edit this settlement"
                  deleteDeniedMessage="Only the creator or payer can delete this settlement">
                  <HistorySettlementRow s={item} all={settlements as any[]} />
                </SwipeRow>
              ) : (
                <SwipeRow key={item.id} onEdit={() => setEditTxn(item)} onDelete={() => setDeleteTxn(item)}>
                  <Row t={item} />
                </SwipeRow>
              )
            )}
          </div>
        </div>
      ))}

      {editTxn && (
        <EditTxSheet txn={editTxn} open={!!editTxn} onOpenChange={(o) => { if (!o) setEditTxn(null); }} />
      )}

      {editSplit && (
        <EditSplitSheet split={editSplit} open={!!editSplit} onOpenChange={(o) => { if (!o) setEditSplit(null); }} />
      )}

      {editSettlement && (
        <SettlementEditSheet settlement={editSettlement} open={!!editSettlement} onOpenChange={(o) => { if (!o) setEditSettlement(null); }} />
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

      <AlertDialog open={!!deleteSplit} onOpenChange={(o) => { if (!o) setDeleteSplit(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={async () => {
                if (!deleteSplit) return;
                await runSplitDelete(deleteSplit.id, qc);
                setDeleteSplit(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTxn} onOpenChange={(o) => { if (!o) setDeleteTxn(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this transaction and update your account balance. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={async () => {
                if (!deleteTxn) return;
                const { error } = await supabase.from("transactions").delete().eq("id", deleteTxn.id);
                if (error) toast.error(error.message);
                else {
                  toast.success("Transaction deleted");
                  qc.invalidateQueries({ queryKey: ["transactions"] });
                  qc.invalidateQueries({ queryKey: ["accounts"] });
                  qc.invalidateQueries({ queryKey: ["splits"] });
                }
                setDeleteTxn(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Settlement history row — uses the shared SettlementRow with per-share remaining + viewer direction.
function HistorySettlementRow({ s, all }: { s: any; all: any[] }) {
  const { data: balanceData } = useQuery(splitBalancesQuery());
  const { iPaid, otherName } = settlementDirection(s, s._uid);
  const { remaining, fullySettled } = shareRemaining(s, all);
  const netAfter = settlementNetAfter(
    balanceData?.splits ?? [], balanceData?.settlements ?? [], s, balanceData?.currentUserId ?? null, balanceData?.myPersonIds ?? [],
  ) ?? undefined;
  return (
    <SettlementRow description={s.description} iPaid={iPaid} otherName={otherName} amount={Number(s.amount)}
      remaining={remaining} fullySettled={fullySettled} netAfter={netAfter} createdAt={s.created_at} />
  );
}

function Row({ t }: { t: any }) {
  const isIncome = t.type === "income";
  const isExpense = t.type === "expense";
  const isTransfer = t.type === "transfer";
  const isSplit = t.is_split;

  const color = isSplit ? "text-split" : isIncome ? "text-income" : isExpense ? "text-expense" : "text-transfer";
  const Icon = isSplit ? Users : isIncome ? ArrowDownLeft : isExpense ? ArrowUpRight : ArrowLeftRight;

  // Split transaction — show person/group context from joined split data
  if (isSplit && t.split) {
    const s = t.split;
    const oppositeLabel = s.type === "group" && s.groups?.name
      ? s.groups.name
      : s.type === "individual" && s.people?.name
      ? s.people.name
      : (s.split_shares ?? []).map((sh: any) => sh.person_name).filter(Boolean).join(", ") || s.description || "Split";
    const totalShares = (s.split_shares ?? []).reduce((sum: number, sh: any) => sum + Number(sh.share_amount), 0);
    const shareAmt = totalShares > 0 ? totalShares : t.amount;
    return (
      <div className="flex items-center gap-3 p-3 bg-card">
        <div className={`h-9 w-9 rounded-full bg-secondary flex items-center justify-center ${color}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm truncate">{oppositeLabel}</p>
          <p className="text-[10px] text-muted-foreground truncate">paid by {s.paid_by}</p>
        </div>
        <div className="text-right">
          <p className={`text-sm font-mono font-semibold ${color}`}>-{formatMoney(shareAmt)}</p>
          <p className="text-[10px] text-muted-foreground font-mono">{formatMoney(Number(s.total_amount))}</p>
        </div>
      </div>
    );
  }

  const sign = isIncome ? "+" : isTransfer ? "" : "-";
  const title = t.categories
    ? `${t.categories.icon ?? ""} ${t.categories.name}${t.sub_categories ? " · " + t.sub_categories.name : ""}`
    : isIncome ? (t.income_source_text ?? "Income")
    : isTransfer ? "Transfer"
    : isSplit ? "Split"
    : "Expense";
  const sub = isTransfer
    ? `${t.accounts?.label ?? ""} → ${t.to_account?.label ?? ""}`
    : isIncome
    ? (t.accounts ? [t.accounts.institution, t.accounts.label].filter(Boolean).join(" · ") : "")
    : t.accounts
    ? [t.accounts.institution, t.accounts.label].filter(Boolean).join(" · ")
    : "";
  return (
    <div className="flex items-center gap-3 p-3 bg-card">
      <div className={`h-9 w-9 rounded-full bg-secondary flex items-center justify-center ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate">{title}</p>
        <p className="text-[10px] text-muted-foreground truncate">{sub}{t.note ? ` · ${t.note}` : ""}</p>
      </div>
      <div className="text-right">
        <p className={`text-sm font-mono font-semibold ${color}`}>{sign}{formatMoney(t.amount)}</p>
        <p className="text-[10px] text-muted-foreground font-mono">{t.time?.slice(0, 5)}</p>
      </div>
    </div>
  );
}
