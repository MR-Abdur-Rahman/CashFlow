import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { peopleQuery } from "@/lib/queries";
import { contactDisplay } from "@/lib/people";
import { EntityAvatarUpload } from "./EntityAvatarUpload";
import { toast } from "sonner";

export function AddGroupDialog({
  open,
  onOpenChange,
  edit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  edit?: any;
}) {
  const qc = useQueryClient();
  const { data: people = [] } = useQuery(peopleQuery());
  const [name, setName] = useState("");
  const [members, setMembers] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setName(edit?.name ?? "");
      setMembers(edit?.group_members?.map((m: any) => m.person_id) ?? []);
    }
  }, [open, edit]);

  // Lock member list to one type (linked vs local) once a member is chosen, to prevent mixing.
  const selectedPeople = (people as any[]).filter((p) => members.includes(p.id));
  const lockMode: "linked" | "local" | null =
    selectedPeople.length > 0 ? (selectedPeople[0].linked_user_id ? "linked" : "local") : null;
  const visiblePeople =
    lockMode === null
      ? (people as any[])
      : (people as any[]).filter(
          (p) =>
            members.includes(p.id) ||
            (lockMode === "linked" ? !!p.linked_user_id : !p.linked_user_id),
        );

  const mutation = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      let groupId = edit?.id;
      if (groupId) {
        const { error } = await supabase.from("groups").update({ name }).eq("id", groupId);
        if (error) throw error;
        await supabase.from("group_members").delete().eq("group_id", groupId);
      } else {
        const { data, error } = await supabase
          .from("groups")
          .insert({ name, created_by: u.user.id })
          .select("id")
          .single();
        if (error) throw error;
        groupId = data.id;
      }
      if (members.length) {
        const { error } = await supabase
          .from("group_members")
          .insert(members.map((person_id) => ({ group_id: groupId, person_id })));
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["groups"] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{edit ? "Edit group" : "Create group"}</DialogTitle>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const hasLinked = selectedPeople.some((p) => !!p.linked_user_id);
            const hasLocal = selectedPeople.some((p) => !p.linked_user_id);
            if (hasLinked && hasLocal) {
              toast.error("Groups cannot have both local and linked members");
              return;
            }
            mutation.mutate();
          }}
          className="space-y-4"
        >
          {edit?.id && (
            <EntityAvatarUpload
              table="groups"
              id={edit.id}
              folder="groups"
              currentUrl={edit.avatar_url}
              name={name}
              invalidateKey={["groups"]}
            />
          )}
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Roomies"
            />
          </div>
          <div className="space-y-2">
            <Label>Members</Label>
            <div className="max-h-60 overflow-y-auto rounded-lg border border-border divide-y divide-border">
              {people.length === 0 && (
                <p className="p-3 text-sm text-muted-foreground">Add people first</p>
              )}
              {visiblePeople.map((p) => (
                <label key={p.id} className="flex items-center gap-3 p-3 cursor-pointer">
                  <Checkbox
                    checked={members.includes(p.id)}
                    onCheckedChange={(c) =>
                      setMembers((s) => (c ? [...s, p.id] : s.filter((x) => x !== p.id)))
                    }
                  />
                  <span className="text-sm">{contactDisplay(p).name}</span>
                </label>
              ))}
            </div>
            {lockMode !== null && (
              <p className="text-xs text-muted-foreground">
                {lockMode === "linked"
                  ? "Only linked CashFlow users can be added"
                  : "Only local contacts can be added"}
              </p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            Save
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
