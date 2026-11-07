import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { EntityAvatarUpload } from "./EntityAvatarUpload";
import { PhoneInput, type PhoneInputValue } from "@/components/PhoneInput";
import { sanitizeAmountInput, round2 } from "@/lib/customSplit";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format";

type Direction = "they_owe_me" | "i_owe_them";

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

  // Opening balance (pre-CashFlow debt). Amount stays a STRING so an empty box means "not
  // entered" rather than 0, and direction starts unset so the user must choose a side.
  const [openAmount, setOpenAmount] = useState("");
  const [openDir, setOpenDir] = useState<Direction | null>(null);

  // Existing opening balance for the person being edited, plus whether it is still editable.
  // Once a settlement exists against this person the opening balance is part of a settled
  // history, so changing it would silently rewrite what the settlement was measured against.
  const { data: existingOpening } = useQuery({
    queryKey: ["person-opening", edit?.id ?? null],
    enabled: !!edit?.id && open,
    queryFn: async () => {
      const { data: row } = await supabase
        .from("person_opening_balances")
        .select("amount, direction")
        .eq("person_id", edit.id)
        .maybeSingle();
      const { count } = await supabase
        .from("settlements")
        .select("*", { count: "exact", head: true })
        .eq("person_id", edit.id);
      return {
        amount: row ? Number((row as any).amount) : null,
        direction: (row as any)?.direction as Direction | undefined,
        locked: !!count && count > 0,
      };
    },
  });

  useEffect(() => {
    if (open) {
      setName(edit?.name ?? initial?.name ?? "");
      setPhoneSeed(edit?.phone_number ?? initial?.phone ?? null);
      setNickname(edit?.nickname ?? "");
      // Opening balance is per-person, so clear it on EVERY open. Without this it survives a
      // close-without-saving: the seeding effect below bails when there is no fetched row, and in
      // create mode the query is disabled forever — so a previous person's amount would stay in
      // the form and be saved onto a brand-new contact as a debt nobody entered.
      setOpenAmount("");
      setOpenDir(null);
    }
  }, [open, edit, initial]);

  // Seed the opening-balance fields from the fetched row (edit mode only).
  useEffect(() => {
    if (!open || !existingOpening) return;
    setOpenAmount(existingOpening.amount != null ? String(existingOpening.amount) : "");
    setOpenDir(existingOpening.direction ?? null);
  }, [open, existingOpening]);

  const openingLocked = !!existingOpening?.locked;
  const amountNum = round2(Number(openAmount) || 0);
  const amountEntered = openAmount.trim() !== "" && amountNum > 0;
  // Valid when left empty, or when a positive amount has a direction chosen.
  const openingValid = openAmount.trim() === "" ? true : amountNum > 0 && openDir !== null;
  const openingError =
    openAmount.trim() === ""
      ? null
      : amountNum <= 0
        ? "Enter an amount greater than 0"
        : openDir === null
          ? "Choose who owes whom"
          : null;

  const mutation = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      // Optional: empty is fine, but a non-empty number must have validated to E.164.
      if (!phone.valid) throw new Error("Enter a valid phone number, or leave it empty");
      if (!openingValid) throw new Error(openingError ?? "Fix the opening balance");
      const payload = {
        name,
        phone_number: phone.e164,
        nickname: nickname.trim() || null,
        user_id: u.user.id,
      };

      if (edit?.id) {
        const { error } = await supabase.from("people").update(payload).eq("id", edit.id);
        if (error) throw error;
        // Opening balance edits only reach here when unlocked (the UI is read-only otherwise).
        if (!openingLocked && !isLinked) {
          if (amountEntered && openDir) {
            const { error: oErr } = await supabase.from("person_opening_balances").upsert({
              person_id: edit.id,
              user_id: u.user.id,
              amount: amountNum,
              direction: openDir,
              updated_at: new Date().toISOString(),
            });
            if (oErr) throw oErr;
          } else {
            // Cleared — remove the row entirely (no zero rows by design).
            const { error: dErr } = await supabase
              .from("person_opening_balances")
              .delete()
              .eq("person_id", edit.id);
            if (dErr) throw dErr;
          }
        }
        return;
      }

      // CREATE: insert the person first (we need its id), then the opening row. If the second
      // insert fails, roll the person back so there is no half-saved contact.
      const { data: created, error } = await supabase
        .from("people")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;

      if (amountEntered && openDir) {
        const { error: oErr } = await supabase.from("person_opening_balances").insert({
          person_id: created.id,
          user_id: u.user.id,
          amount: amountNum,
          direction: openDir,
        });
        if (oErr) {
          await supabase.from("people").delete().eq("id", created.id);
          throw new Error(`Could not save the opening balance: ${oErr.message}`);
        }
      }
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["people"] });
      // The bilateral net reads opening balances from splitBalancesQuery, so refresh it too.
      qc.invalidateQueries({ queryKey: ["splits"] });
      qc.invalidateQueries({ queryKey: ["person-opening"] });
      onOpenChange(false);
      setName("");
      setPhoneSeed(null);
      setNickname("");
      setOpenAmount("");
      setOpenDir(null);
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

          {/* Opening balance — a debt that predates CashFlow. Local contacts only: it is a
              one-sided private note, so it never applies to a linked CashFlow user. */}
          {!isLinked && (
            <div className="space-y-1.5">
              <Label>Opening balance (optional)</Label>
              {openingLocked ? (
                <>
                  <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/60 px-3 py-2.5">
                    <span className="text-sm text-muted-foreground">
                      {existingOpening?.direction === "i_owe_them" ? "You owed them" : "They owed you"}
                    </span>
                    <span className="font-mono text-sm font-semibold">
                      {formatMoney(existingOpening?.amount ?? 0)}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Locked because you have settled up with this person.
                  </p>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-mono shrink-0">LKR</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={openAmount}
                      onChange={(e) => setOpenAmount(sanitizeAmountInput(e.target.value))}
                      className="min-w-0 flex-1 rounded-lg border border-border bg-secondary px-3 py-2.5 text-right font-mono text-sm outline-none focus:border-primary"
                    />
                  </div>
                  {/* No default selection: the user must say which way the debt runs. */}
                  <div className="flex gap-2 rounded-lg bg-secondary p-1">
                    {(
                      [
                        { v: "they_owe_me", label: "They owe me" },
                        { v: "i_owe_them", label: "I owe them" },
                      ] as const
                    ).map((o) => (
                      <button
                        type="button"
                        key={o.v}
                        onClick={() => setOpenDir(o.v)}
                        className={cn(
                          "flex-1 rounded-md py-1.5 text-xs font-medium",
                          openDir === o.v
                            ? "bg-primary text-white"
                            : "text-muted-foreground",
                        )}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                  {openingError ? (
                    <p className="text-[11px] text-expense">{openingError}</p>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">
                      A debt from before you used CashFlow. It counts towards your balance but
                      doesn't touch any account.
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={mutation.isPending || !phone.valid || !openingValid}
          >
            Save
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
