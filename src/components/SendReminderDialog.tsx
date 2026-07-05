import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MessageCircle, Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatMoney } from "@/lib/format";
import { useQueryClient } from "@tanstack/react-query";

export function SendReminderDialog({
  open,
  onOpenChange,
  person,
  splitId,
  splitShareId,
  amount,
  description,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  person: { id: string; name: string; phone_number?: string | null };
  splitId: string;
  splitShareId?: string;
  amount: number;
  description?: string;
}) {
  const qc = useQueryClient();
  const [message, setMessage] = useState(
    `Hi ${person.name}, friendly reminder you owe ${formatMoney(amount)}${description ? ` for "${description}"` : ""}. Thanks!`,
  );
  const [busy, setBusy] = useState(false);

  async function log(channel: "in_app" | "whatsapp" | "sms") {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw new Error("Not signed in");
    await supabase.from("settlement_reminders").insert({
      user_id: u.user.id,
      split_id: splitId,
      split_share_id: splitShareId ?? null,
      person_id: person.id,
      channel,
      message,
    });
    qc.invalidateQueries({ queryKey: ["reminders"] });
  }

  async function sendInApp() {
    setBusy(true);
    try {
      await log("in_app");
      toast.success("Reminder logged");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function sendWhatsApp() {
    if (!person.phone_number) return toast.error("No phone number on this person");
    setBusy(true);
    try {
      await log("whatsapp");
      const phone = person.phone_number.replace(/[^\d]/g, "");
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank");
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
            <Textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" disabled={busy} onClick={sendInApp}>
              <Bell className="h-4 w-4 mr-2" /> Log only
            </Button>
            <Button
              disabled={busy || !person.phone_number}
              onClick={sendWhatsApp}
              className="bg-[oklch(0.55_0.15_145)]"
            >
              <MessageCircle className="h-4 w-4 mr-2" /> WhatsApp
            </Button>
          </div>
          {!person.phone_number && (
            <p className="text-xs text-muted-foreground">
              Add a phone number to this person to send via WhatsApp.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
