import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { groupQuery, groupSplitsQuery } from "@/lib/queries";
import { ArrowLeft, Archive, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShareList } from "@/components/ShareList";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";
import { AddGroupDialog } from "@/components/AddGroupDialog";
import { Link, useParams, useNavigate } from "react-router-dom";

export default function GroupDetail() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: group } = useQuery(groupQuery(groupId!));
  const { data: splits = [] } = useQuery(groupSplitsQuery(groupId!));
  const [edit, setEdit] = useState(false);

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

  if (!group) return <div className="p-6">Person not found</div>;

  return (
    <div className="px-4 pt-4 pb-24 space-y-5">
      <Link to="/split" className="inline-flex items-center text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4 mr-1" /> Split
      </Link>
      <div>
        <h1 className="text-xl font-semibold">{group.name}</h1>
        <p className="text-xs text-muted-foreground">{(group as any).group_members?.length ?? 0} members</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Button size="sm" variant="outline" onClick={() => setEdit(true)}>
          <Pencil className="h-3 w-3 mr-1" /> Edit
        </Button>
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
    </div>
  );
}