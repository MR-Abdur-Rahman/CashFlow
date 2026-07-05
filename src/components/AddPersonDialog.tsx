import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { EntityAvatarUpload } from "./EntityAvatarUpload";

export function AddPersonDialog({
  open,
  onOpenChange,
  edit,
  initial,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  edit?: any;
  initial?: { name?: string; phone?: string };
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(edit?.name ?? initial?.name ?? "");
  const [phone, setPhone] = useState(edit?.phone_number ?? initial?.phone ?? "");
  const [nickname, setNickname] = useState(edit?.nickname ?? "");
  const isLinked = !!edit?.linked_user_id;

  useEffect(() => {
    if (open) {
      setName(edit?.name ?? initial?.name ?? "");
      setPhone(edit?.phone_number ?? initial?.phone ?? "");
      setNickname(edit?.nickname ?? "");
    }
  }, [open, edit, initial]);

  const mutation = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const payload = {
        name,
        phone_number: phone || null,
        nickname: nickname.trim() || null,
        user_id: u.user.id,
      };
      if (edit?.id) {
        const { error } = await supabase.from("people").update(payload).eq("id", edit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("people").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["people"] });
      onOpenChange(false);
      setName("");
      setPhone("");
      setNickname("");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{edit ? "Edit person" : "Add person"}</DialogTitle>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
          className="space-y-4"
        >
          {edit?.id && !isLinked && (
            <EntityAvatarUpload
              table="people"
              id={edit.id}
              folder="people"
              currentUrl={edit.avatar_url}
              name={nickname || name}
              invalidateKey={["people"]}
            />
          )}
          {isLinked && (
            <p className="text-xs text-muted-foreground">
              Photo &amp; name sync from their CashFlow profile. Set a nickname to show a different
              name — only you see it.
            </p>
          )}
          {!isLinked && (
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Nickname (optional)</Label>
            <Input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Shown only to you"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Phone (optional)</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+94..." />
          </div>
          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            Save
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
