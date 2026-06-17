import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { groupQuery, groupSplitsQuery } from "@/lib/queries";
import { ArrowLeft, Archive, Pencil, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShareList } from "@/components/ShareList";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";
import { AddGroupDialog } from "@/components/AddGroupDialog";
import { AddTransactionSheet } from "@/components/AddTransactionSheet";
import { Link, useParams, useNavigate } from "react-router-dom";
import { formatMoney } from "@/lib/format";

export default function GroupDetail() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: group } = useQuery(groupQuery(groupId!));
  const { data: splits = [] } = useQuery(groupSplitsQuery(groupId!));
  const [edit, setEdit] = useState(false);
  const [addSplitOpen, setAddSplitOpen] = useState(false);

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["groups"] });
      toast.success("Group deleted");
      navigate(-1);
    },
    onError: (e) => toast.error(e.message),
  });

  // Calculate net balance per member
  const memberBalances = (group as any)?.group_members?.map((m: any) => {
    let owed = 0;
    for (const s of splits as any[]) {
      for (const sh of (s.split_shares ?? [])) {
        if (sh.person_id !== m.person_id) continue;
        const settled = (s.settlements ?? []).filter((x: any) => x.split_share_id === sh.id).reduce((a: number, x: any) => a + Number(x.amount), 0);
        owed += Number(sh.share_amount) - settled;
      }
    }
    return { name: m.people?.name ?? "?", balance: owed };
  }) ?? [];

  if (!group) return <div className="p-6">Group not found</div>;

  return (
    <div className="px-4 pt-4 pb-24 space-y-5">
      <Link to="/split" className="inline-flex items-center text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4 mr-1" /> Split
      </Link>

      <div>
        <h1 className="text-xl font-semibold">{group.name}</h1>
        <p className="text-xs text-muted-foreground">{(group as any).group_members?.length ?? 0} members</p>
      </div>

      {/* Member balances */}
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

      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={() => setAddSplitOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Add Split
        </Button>
        <Button size="sm" variant="outline" onClick={() => setEdit(true)}>
          <Pencil className="h-3 w-3 mr-1" /> Edit
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" variant="outline" onClick={() => archive.mutate()}>
          <Archive className="h-3 w-3 mr-1" /> {group.is_archived ? "Unarchive" : "Archive"}
        </Button>
        <Button size="sm" variant="outline" className="text-expense" onClick={() => { if (confirm("Delete group?")) del.mutate(); }}>
          <Trash2 className="h-3 w-3 mr-1" /> Delete
        </Button>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2 px-1">Splits</p>
        <ShareList splits={splits} />
      </div>

      <AddGroupDialog open={edit} onOpenChange={setEdit} edit={group} />
      <AddTransactionSheet open={addSplitOpen} onOpenChange={setAddSplitOpen} defaultTab="split" />
    </div>
  );
}