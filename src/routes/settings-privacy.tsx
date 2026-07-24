import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Trash2, KeyRound } from "lucide-react";
import { SettingsHeader } from "@/components/SettingsRows";
import { PhoneVisibilitySettings } from "@/components/PhoneVisibilitySettings";
import { ProfileVisibilitySettings } from "@/components/ProfileVisibilitySettings";
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog";
import { DeleteAccountDialog } from "@/components/DeleteAccountDialog";

export default function PrivacyPage() {
  const [userId, setUserId] = useState<string | undefined>();
  const [email, setEmail] = useState<string | undefined>();
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id);
      setEmail(data.user?.email ?? undefined);
    });
  }, []);

  const [changePwOpen, setChangePwOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <div className="px-4 pt-6 pb-24 space-y-6">
      <SettingsHeader title="Privacy" />

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-muted-foreground px-1">Profile</p>
        <ProfileVisibilitySettings userId={userId} />
      </div>

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-muted-foreground px-1">Phone number</p>
        <PhoneVisibilitySettings userId={userId} />
      </div>

      {/* Change password — single tappable row, opens the 2-step dialog. */}
      <button
        type="button"
        onClick={() => setChangePwOpen(true)}
        className="flex w-full items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left active:bg-secondary/40"
      >
        <KeyRound className="h-5 w-5 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Change password</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Update the password you use to log in
          </p>
        </div>
      </button>

      {/* Delete account — same row format, opens the 2-step (confirm → password) dialog. */}
      <button
        type="button"
        onClick={() => setDeleteOpen(true)}
        className="flex w-full items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left active:bg-secondary/40"
      >
        <Trash2 className="h-5 w-5 text-expense shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-expense">Delete account</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Permanently delete your account and data
          </p>
        </div>
      </button>

      <ChangePasswordDialog open={changePwOpen} onOpenChange={setChangePwOpen} email={email} />
      <DeleteAccountDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        email={email}
        userId={userId}
      />
    </div>
  );
}
