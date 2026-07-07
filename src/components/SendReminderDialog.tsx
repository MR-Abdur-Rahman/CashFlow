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
  // Debtor-side note lists no split descriptions — only the creditor's reminder itemizes them.
  if (iOwe) {
    return `Hi ${name}, just a note that I owe you ${formatMoney(amount)}. I'll settle up soon!`;
  }
  const list = descriptions.length ? ` for ${descriptions.join(", ")}` : "";
  return `Hi ${name}, friendly reminder you owe ${formatMoney(amount)}${list}. Thanks!`;
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
  const methods = ((profile as any)?.reminder_methods ?? ["cashflow"]) as string[];

  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  // Reset the draft to the direction-aware default whenever the dialog (re)opens.
  useEffect(() => {
    if (open) setMessage(defaultMessage(person.name, amount, iOwe, descriptions));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // settlement_reminders.split_id is NOT NULL, so we only log against a concrete split.
  async function log(channel: "in_app" | "whatsapp" | "telegram") {
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

  // CashFlow is independent; at most one external channel is paired with it (SMS not deliverable yet).
  const doCashflow = methods.includes("cashflow") && !!person.linked_user_id;
  const doWhatsApp = methods.includes("whatsapp") && !!person.phone_number;
  const doTelegram = methods.includes("telegram");
  const canSend = doCashflow || doWhatsApp || doTelegram;
  const unavailableHint = methods.includes("whatsapp")
    ? "This contact has no phone number for WhatsApp — add one, or pick CashFlow in Preferences."
    : methods.includes("sms")
      ? "SMS reminders aren't available yet — pick another channel in Preferences."
      : "This contact isn't a linked CashFlow user — enable an outside channel in Preferences.";

  async function send() {
    if (!canSend) return toast.error(unavailableHint);
    // Open external apps first so they stay inside the click gesture (avoids popup blocking).
    if (doWhatsApp) {
      const phone = person.phone_number!.replace(/[^\d]/g, "");
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank");
    } else if (doTelegram) {
      window.open(`https://t.me/share/url?url=${encodeURIComponent(message)}`, "_blank");
    }
    setBusy(true);
    try {
      if (doCashflow) {
        const { error } = await supabase.from("notifications").insert({
          user_id: person.linked_user_id,
          type: "reminder",
          title: "Payment reminder",
          message,
          related_split_id: splitId ?? null,
        });
        if (error) throw error;
      }
      if (doWhatsApp) await log("whatsapp");
      else if (doTelegram) await log("telegram");
      if (doCashflow) await log("in_app");
      toast.success("Reminder sent");
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
            <Send className="h-4 w-4 mr-2" /> Send
          </Button>
          {!canSend && <p className="text-xs text-muted-foreground">{unavailableHint}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
