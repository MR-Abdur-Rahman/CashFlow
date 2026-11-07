import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { EntityAvatarUpload } from "./EntityAvatarUpload";
import { PhoneInput, type PhoneInputValue } from "@/components/PhoneInput";

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
  // Seed value for PhoneInput (it parses legacy or E.164 itself); `phone` holds the canonical
  // E.164 the component resolves, which is what gets saved. Phone stays optional here.
  const [phoneSeed, setPhoneSeed] = useState<string | null>(
    edit?.phone_number ?? initial?.phone ?? null,
  );
  const [phone, setPhone] = useState<PhoneInputValue>({ e164: null, valid: true });
  const [nickname, setNickname] = useState(edit?.nickname ?? "");
  const isLinked = !!edit?.linked_user_id;

  useEffect(() => {
    if (open) {
      setName(edit?.name ?? initial?.name ?? "");
      setPhoneSeed(edit?.phone_number ?? initial?.phone ?? null);
      setNickname(edit?.nickname ?? "");
    }
  }, [open, edit, initial]);

  const mutation = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      // Optional: empty is fine, but a non-empty number must have validated to E.164.
      if (!phone.valid) throw new Error("Enter a valid phone number, or leave it empty");
      const payload = {
        name,
        phone_number: phone.e164,
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
      setPhoneSeed(null);
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
          {!isLinked && (
            <div className="space-y-1.5">
              <Label>Phone (optional)</Label>
              <PhoneInput
                value={phoneSeed}
                onChange={setPhone}
                optional
                placeholder="Phone number (optional)"
              />
            </div>
          )}
          <Button
            type="submit"
            className="w-full"
            disabled={mutation.isPending || !phone.valid}
          >
            Save
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
