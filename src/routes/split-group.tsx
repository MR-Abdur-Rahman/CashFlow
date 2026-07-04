import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { groupQuery, groupSplitsQuery, accountsQuery, categoriesQuery, subCategoriesQuery, peopleQuery, groupsQuery } from "@/lib/queries";
import { ArrowLeft, Archive, Pencil, Trash2, Plus, Users, CheckCircle2, ChevronLeft, ChevronRight, ChevronDown, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SettleUpDialog } from "@/components/SettleUpDialog";
import { SwipeRow } from "@/components/SwipeRow";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { notifyToast } from "@/lib/notify";
import { canModifySplit, deleteSplit as runSplitDelete } from "@/lib/deleteSplit";
import { useState, useMemo, useEffect } from "react";
import { AddGroupDialog } from "@/components/AddGroupDialog";
import { AddPersonDialog } from "@/components/AddPersonDialog";
import { AddTransactionSheet } from "@/components/AddTransactionSheet";
import { Link, useParams, useNavigate } from "react-router-dom";
import { formatMoney } from "@/lib/format";
import { EditSplitSheet } from "./home";
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
                  canEdit={canModifySplit(s)} canDelete={canModifySplit(s)}
                  editDeniedMessage="Only the creator or payer can edit this split"
                  deleteDeniedMessage="Only the creator or payer can delete this split">
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
              await runSplitDelete(deleteSplit.id, qc);
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
