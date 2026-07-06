import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { profileQuery } from "@/lib/queries";
import { UserAvatar } from "@/components/UserAvatar";
import { PhotoPreviewDialog } from "@/components/PhotoPreviewDialog";
import { User, Phone, Mail, Pencil } from "lucide-react";
import { SettingsHeader } from "@/components/SettingsRows";
import { Link } from "react-router-dom";

export default function AccountPage() {
  const [userId, setUserId] = useState<string | undefined>();
  const [email, setEmail] = useState<string | undefined>();
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id);
      setEmail(data.user?.email ?? undefined);
    });
  }, []);
  const { data: profile } = useQuery(profileQuery(userId));
  const fullName = profile?.full_name ?? "";
  const phone = profile?.phone_number ?? "";
  const google = profile?.google_email ?? email ?? "—";
  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <div className="px-4 pt-4 pb-24 space-y-6">
      {/* Header with Edit button top-right */}
      <div className="flex items-center justify-between">
        <SettingsHeader title="Account" />
        <Link
          to="/settings/account/edit"
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-primary active:bg-secondary/40"
        >
          <Pencil className="h-4 w-4" /> Edit
        </Link>
      </div>

      {/* Avatar — read-only, tap to preview */}
      <div className="flex flex-col items-center">
        <button type="button" aria-label="View photo" onClick={() => setPreviewOpen(true)}>
          <UserAvatar url={profile?.avatar_url} name={fullName || email} size={120} />
        </button>
      </div>
      <PhotoPreviewDialog
        url={profile?.avatar_url}
        name={fullName || email || "You"}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
      />

      {/* Read-only info rows (edit via the Edit button) */}
      <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden shadow-sm">
        {[
          { icon: User, label: "Full name", value: fullName || "Add your name" },
          { icon: Phone, label: "Phone number", value: phone || "Add a phone number" },
          { icon: Mail, label: "Google account", value: google },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-center gap-4 px-4 py-3">
            <Icon className="h-6 w-6 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-base text-foreground mt-0.5 truncate">{value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
