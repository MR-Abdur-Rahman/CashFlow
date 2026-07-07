import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { SettingsHeader, Section, ToggleRow } from "@/components/SettingsRows";
import { TimePicker } from "@/components/TimePicker";

export default function NotificationSettingsPage() {
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | undefined>();
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id));
  }, []);

  const [pendingToggle, setPendingToggle] = useState<{
    key: string[];
    newValue: boolean;
    label: string;
    description: string;
  } | null>(null);

  // Notification preferences (separate table). Create a default row on first access.
  const { data: prefs } = useQuery({
    queryKey: ["notification_preferences", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return null;
      const { data: existing } = await (supabase as any)
        .from("notification_preferences")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (existing) return existing;
      const { data: created, error } = await (supabase as any)
        .from("notification_preferences")
        .insert({ user_id: userId })
        .select("*")
        .single();
      if (error) {
        const { data: refetched } = await (supabase as any)
          .from("notification_preferences")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();
        return refetched;
      }
      return created;
    },
  });

  const updatePrefs = useMutation({
    mutationFn: async (patch: Record<string, any>) => {
      if (!userId) throw new Error("Not signed in");
      const { error } = await (supabase as any)
        .from("notification_preferences")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notification_preferences"] }),
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="px-4 pt-6 pb-24 space-y-6">
      <SettingsHeader title="Notifications" />

      <Section label="Notifications">
        <ToggleRow
          label="Split Notification"
          checked={prefs?.split_notifications ?? false}
          onChange={(v) => updatePrefs.mutate({ split_notifications: v })}
        />
        <ToggleRow
          label="Settlement Notification"
          checked={prefs?.settlement_reminders ?? false}
          onChange={(v) => updatePrefs.mutate({ settlement_reminders: v })}
        />
        <ToggleRow
          label="Daily expense reminder"
          checked={prefs?.daily_expense_reminder ?? true}
          onChange={(v) => updatePrefs.mutate({ daily_expense_reminder: v })}
        />
        {prefs?.daily_expense_reminder && (
          <div className="p-4 flex items-center justify-between border-t border-border">
            <Label className="text-sm">Reminder time</Label>
            <TimePicker
              value={String(prefs?.daily_expense_reminder_time ?? "08:00").slice(0, 5)}
              onChange={(v) => updatePrefs.mutate({ daily_expense_reminder_time: v })}
            />
          </div>
        )}
      </Section>

      <Section label="Toast messages">
        {(
          [
            {
              cols: ["toast_split_added", "toast_split_deleted"],
              label: "Split",
              description: "someone adds, edits or deletes a split with you",
            },
            {
              cols: ["toast_settlement_cash", "toast_settlement_bank", "toast_settlement_ewallet"],
              label: "Settlement",
              description: "someone adds, edits or deletes a settlement with you",
            },
            {
              cols: ["toast_account_selection"],
              label: "Account selection",
              description: "a split or settlement needs you to pick an account",
            },
          ] as { cols: string[]; label: string; description: string }[]
        ).map(({ cols, label, description }) => (
          <div key={label} className="flex items-center justify-between p-4">
            <span className="text-sm">{label}</span>
            <Switch
              checked={cols.every((c) => !!prefs?.[c])}
              onCheckedChange={(newValue) =>
                setPendingToggle({ key: cols, newValue, label, description })
              }
            />
          </div>
        ))}
      </Section>

      {/* Toast preference confirmation dialog */}
      <Dialog
        open={!!pendingToggle}
        onOpenChange={(o) => {
          if (!o) setPendingToggle(null);
        }}
      >
        <DialogContent>
          <DialogTitle>{pendingToggle?.label}</DialogTitle>
          <DialogDescription>
            {pendingToggle?.newValue
              ? `ON: You'll see a toast popup when ${pendingToggle.description}.`
              : "OFF: Notification saved silently in bell icon."}
          </DialogDescription>
          <div className="flex justify-end mt-2">
            <Button
              onClick={() => {
                if (!pendingToggle || !userId) return;
                updatePrefs.mutate(
                  Object.fromEntries(pendingToggle.key.map((k) => [k, pendingToggle.newValue])),
                );
                setPendingToggle(null);
              }}
            >
              OK
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
