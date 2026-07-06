import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { groupQuery, splitBalancesQuery, peopleQuery } from "@/lib/queries";
import { bilateralBalance } from "@/lib/balance";
import { contactDisplay } from "@/lib/people";
import { ArrowLeft, Plus, Users, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { SwipeRow } from "@/components/SwipeRow";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { canModifySplit, deleteSplit as runSplitDelete } from "@/lib/deleteSplit";
import { useState, useMemo } from "react";
import { AddGroupDialog } from "@/components/AddGroupDialog";
import { AddTransactionSheet } from "@/components/AddTransactionSheet";
import { Link, useParams, useNavigate } from "react-router-dom";
import { formatMoney } from "@/lib/format";
import { EditSplitSheet, SplitDirectRow } from "./home";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import {
  type Period,
  PERIODS,
  periodLabel,
  getPeriodRange,
  navigateAnchor,
  formatAnchorLabel,
} from "@/lib/period";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function GroupDetail() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: group } = useQuery(groupQuery(groupId!));
  const { data: balanceData } = useQuery(splitBalancesQuery());
  const { data: myContacts = [] } = useQuery(peopleQuery());
  const allSplits = balanceData?.splits ?? [];
  const allSettlements = balanceData?.settlements ?? [];
  const currentUserId = balanceData?.currentUserId ?? null;
  const myPersonIds = balanceData?.myPersonIds ?? [];
  const [edit, setEdit] = useState(false);
  const [addSplitOpen, setAddSplitOpen] = useState(false);
  const [period, setPeriod] = useState<Period>("monthly");
  const [anchor, setAnchor] = useState(new Date());
  const [deleteSplit, setDeleteSplit] = useState<any | null>(null);
  const [editSplit, setEditSplit] = useState<any | null>(null);

  // Archive/delete handlers kept for future re-wiring; their trigger buttons were removed from the UI.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const archive = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("groups")
        .update({ is_archived: !group?.is_archived })
        .eq("id", groupId!);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["groups"] });
      toast.success("Updated");
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  // Roster shown from THE VIEWER's perspective: each linked member (self excluded) is resolved to
  // the viewer's OWN contact (created by the group auto-sync), so the name/avatar and the bilateral
  // net are view-specific. Members are keyed by member_user_id (readable by every member), not the
  // creator's private people rows.
  const memberBalances = useMemo(() => {
    const g = group as any;
    // Roster = the group CREATOR + the linked members, minus the viewer. (The creator lives in
    // groups.created_by, not group_members, so include them explicitly — otherwise a member's view
    // is missing the creator.)
    const uids: (string | null)[] = [
      g?.created_by ?? null,
      ...((g?.group_members ?? []) as any[]).map(
        (m: any) => m.member_user_id ?? m.people?.linked_user_id ?? null,
      ),
    ];
    const seen = new Set<string>();
    const out: { id: string; name: string; avatarUrl: string | null; balance: number }[] = [];
    for (const uid of uids) {
      if (!uid || uid === currentUserId || seen.has(uid)) continue;
      seen.add(uid);
      const contact = (myContacts as any[]).find((c) => c.linked_user_id === uid);
      const d = contactDisplay(contact ?? { linked_user_id: uid, name: "Member" });
      out.push({
        id: (contact?.id ?? uid) as string,
        name: d.name,
        avatarUrl: d.avatarUrl,
        balance: bilateralBalance(
          allSplits as any[],
          allSettlements as any[],
          { id: contact?.id, linked_user_id: uid },
          currentUserId,
          myPersonIds,
        ),
      });
    }
    return out;
  }, [group, myContacts, allSplits, allSettlements, currentUserId, myPersonIds]);

  const { from: periodFrom, to: periodTo } = useMemo(
    () => getPeriodRange(period, anchor),
    [period, anchor],
  );
  const fromStr = useMemo(() => format(periodFrom, "yyyy-MM-dd"), [periodFrom]);
  const toStr = useMemo(() => format(periodTo, "yyyy-MM-dd"), [periodTo]);

  // Group splits the viewer is involved in, enriched with the per-split fields SplitDirectRow
  // needs (_myPersonId, group name) so the rows render exactly like the person page.
  const groupSplits = useMemo(() => {
    const mine = new Set(myPersonIds);
    return (allSplits as any[])
      .filter((s) => s.group_id === groupId)
      .map((s) => {
        const myShare = (s.split_shares ?? []).find(
          (sh: any) => mine.has(sh.person_id) || sh.person?.linked_user_id === currentUserId,
        );
        return {
          ...s,
          _myPersonId: myShare?.person_id ?? null,
          groups: s.groups ?? { name: (group as any)?.name },
        };
      });
  }, [allSplits, groupId, myPersonIds, currentUserId, group]);

  const filteredSplits = useMemo(
    () => groupSplits.filter((s) => s.date >= fromStr && s.date <= toStr),
    [groupSplits, fromStr, toStr],
  );

  if (!group) return <div className="p-6">Group not found</div>;

  // Detect legacy mixed groups (both local and linked members) — splits misbehave for these.
  const memberPeople = ((group as any).group_members ?? [])
    .map((m: any) => m.people)
    .filter(Boolean);
  const hasLinkedMember = memberPeople.some((p: any) => !!p.linked_user_id);
  const hasLocalMember = memberPeople.some((p: any) => !p.linked_user_id);
  const isMixedGroup = hasLinkedMember && hasLocalMember;

  return (
    <div className="px-4 pt-4 pb-24 space-y-5">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center text-sm text-muted-foreground"
      >
        <ArrowLeft className="h-4 w-4 mr-1" /> Back
      </button>

      <div className="flex items-center gap-3">
        {(group as any).avatar_url ? (
          <UserAvatar url={(group as any).avatar_url} name={group.name} size={48} />
        ) : (
          <div className="h-12 w-12 rounded-full bg-split/20 flex items-center justify-center text-split shrink-0">
            <Users className="h-6 w-6" />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-xl font-semibold truncate">{group.name}</h1>
          <p className="text-xs text-muted-foreground">
            {(group as any).group_members?.length ?? 0} members
          </p>
        </div>
      </div>

      {memberBalances.length > 0 && (
        <div className="surface-card p-0 overflow-hidden divide-y divide-border">
          {memberBalances.map((m) => (
            <Link
              key={m.id}
              to={`/split/person/${m.id}`}
              className="flex items-center gap-3 px-4 py-3 text-sm active:bg-secondary/40"
            >
              <UserAvatar url={m.avatarUrl} name={m.name} size={36} />
              <span className="font-medium flex-1 truncate">{m.name}</span>
              <div className="flex items-center gap-1">
                {Math.abs(m.balance) >= 0.005 ? (
                  <span
                    className="font-mono font-semibold"
                    style={{ color: m.balance > 0 ? "#22C55E" : "#EF4444" }}
                  >
                    {m.balance > 0 ? "+" : "-"}
                    {formatMoney(Math.abs(m.balance))}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">settled</span>
                )}
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
      )}

      {isMixedGroup && (
        <div className="rounded-xl border border-[#F59E0B]/40 bg-[#F59E0B]/10 px-3 py-2.5 text-xs text-[#F59E0B]">
          This group has both local and linked members. Splits may not work correctly.
        </div>
      )}

      <Button
        variant="outline"
        className="w-full"
        disabled={isMixedGroup}
        onClick={() => setAddSplitOpen(true)}
      >
        <Plus className="h-4 w-4 mr-2" /> Add Split
      </Button>

      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3 px-1">History</p>

        {/* Period filter bar */}
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => setAnchor((a) => navigateAnchor(period, a, -1))}
            className="p-1 rounded-md hover:bg-secondary"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold">{formatAnchorLabel(period, anchor)}</span>
          <button
            onClick={() => setAnchor((a) => navigateAnchor(period, a, 1))}
            className="p-1 rounded-md hover:bg-secondary"
          >
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
                  <DropdownMenuItem
                    key={p}
                    onClick={() => {
                      setPeriod(p);
                      setAnchor(new Date());
                    }}
                    className={cn(
                      "capitalize py-3 text-base",
                      period === p && "text-primary font-medium",
                    )}
                  >
                    {periodLabel(p)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {filteredSplits.length === 0 ? (
          <div className="surface-card p-6 text-center text-sm text-muted-foreground">
            {groupSplits.length === 0 ? "No splits yet" : "No splits this period"}
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden border border-border divide-y divide-border">
            {filteredSplits.map((s: any) => (
              <SwipeRow
                key={s.id}
                onEdit={() => setEditSplit(s)}
                onDelete={() => setDeleteSplit(s)}
                canEdit={canModifySplit(s)}
                canDelete={canModifySplit(s)}
                editDeniedMessage="Only the creator or payer can edit this split"
                deleteDeniedMessage="Only the creator or payer can delete this split"
              >
                <SplitDirectRow s={s} />
              </SwipeRow>
            ))}
          </div>
        )}
      </div>

      <AddGroupDialog open={edit} onOpenChange={setEdit} edit={group} />
      <AddTransactionSheet open={addSplitOpen} onOpenChange={setAddSplitOpen} defaultTab="split" />

      <AlertDialog
        open={!!deleteSplit}
        onOpenChange={(o) => {
          if (!o) setDeleteSplit(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete split?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the split and all its shares. Cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white"
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

      {editSplit && (
        <EditSplitSheet
          split={editSplit}
          open={!!editSplit}
          onOpenChange={(o) => {
            if (!o) setEditSplit(null);
          }}
        />
      )}
    </div>
  );
}
