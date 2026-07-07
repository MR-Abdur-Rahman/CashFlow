import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatMoney } from "@/lib/format";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { profileQuery } from "@/lib/queries";

// Build the default reminder text. Direction flips with `iOwe`: when the viewer is the debtor the
// message is a "settling up" note instead of a "you owe me" nudge. Lists every related description.
function defaultMessage(name: string, amount: number, iOwe: boolean, descriptions: string[]) {
  const list = descriptions.length ? ` for ${descriptions.join(", ")}` : "";
  return iOwe
    ? `Hi ${name}, just a note that I owe you ${formatMoney(amount)}${list}. I'll settle up soon!`
    : `Hi ${name}, friendly reminder you owe ${formatMoney(amount)}${list}. Thanks!`;
}

export function SendReminderDialog({
  open,
  onOpenChange,
  person,
  splitId,
  splitShareId,
  amount,
  iOwe = false,
  descriptions = [],
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  person: {
    id: string;
    name: string;
    phone_number?: string | null;
    linked_user_id?: string | null;
  };
  splitId?: string;
  splitShareId?: string;
  amount: number;
  iOwe?: boolean;
  descriptions?: string[];
}) {
  const qc = useQueryClient();
  const [uid, setUid] = useState<string | undefined>();
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id));
  }, []);
  const { data: profile } = useQuery(profileQuery(uid));
  const method = ((profile as any)?.reminder_method ?? "cashflow") as "cashflow" | "whatsapp";

  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  // Reset the draft to the direction-aware default whenever the dialog (re)opens.
  useEffect(() => {
    if (open) setMessage(defaultMessage(person.name, amount, iOwe, descriptions));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // settlement_reminders.split_id is NOT NULL, so we only log against a concrete split.
  async function log(channel: "in_app" | "whatsapp") {
    if (!splitId || !uid) return;
    await supabase.from("settlement_reminders").insert({
      user_id: uid,
      split_id: splitId,
      split_share_id: splitShareId ?? null,
      person_id: person.id,
      channel,
      message,
    });
    qc.invalidateQueries({ queryKey: ["reminders"] });
  }

  const canSend = method === "whatsapp" ? !!person.phone_number : !!person.linked_user_id;
  const unavailableHint =
    method === "whatsapp"
      ? "This contact has no phone number for WhatsApp — change the method in Preferences or add a number."
      : "This contact isn't a linked CashFlow user — switch to WhatsApp in Preferences.";

  async function send() {
    if (!canSend) return toast.error(unavailableHint);
    setBusy(true);
    try {
      if (method === "whatsapp") {
        await log("whatsapp");
        const phone = person.phone_number!.replace(/[^\d]/g, "");
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank");
      } else {
        const { error } = await supabase.from("notifications").insert({
          user_id: person.linked_user_id,
          type: "reminder",
          title: "Payment reminder",
          message,
          related_split_id: splitId ?? null,
        });
        if (error) throw error;
        await log("in_app");
        toast.success("Reminder sent");
      }
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Send reminder</DialogTitle>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Message</Label>
            <Textarea rows={5} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          <Button className="w-full" disabled={busy || !canSend} onClick={send}>
            <Send className="h-4 w-4 mr-2" />
            {method === "whatsapp" ? "Send via WhatsApp" : "Send"}
          </Button>
          {!canSend && <p className="text-xs text-muted-foreground">{unavailableHint}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
