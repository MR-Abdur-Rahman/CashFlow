import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { SettingsHeader } from "@/components/SettingsRows";
import { UserAvatar } from "@/components/UserAvatar";
import { SwipeRow } from "@/components/SwipeRow";
import { supabase } from "@/integrations/supabase/client";
import { listAccounts, removeAccount, type StoredAccount } from "@/lib/accountStore";
import { switchToAccount } from "@/lib/accountSwitch";

export default function SwitchAccountPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [currentId, setCurrentId] = useState<string | undefined>();
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentId(data.user?.id));
  }, []);

  // Its own cache entry rather than component state, so removing a row can just invalidate.
  const { data: accounts = [], refetch } = useQuery({
    queryKey: ["remembered-accounts"],
    queryFn: () => listAccounts(),
    staleTime: 0,
  });

  async function onSwitch(a: StoredAccount) {
    if (a.user_id === currentId || busyId) return;
    setBusyId(a.user_id);
    const result = await switchToAccount(a.user_id, qc);
    setBusyId(null);
    if (result.ok) {
      navigate("/home", { replace: true });
      return;
    }
    toast.error(result.message);
    // "expired" drops the record inside switchToAccount, so the list must re-read.
    if (result.reason === "expired" || result.reason === "not-found") refetch();
  }

  async function onRemove(a: StoredAccount) {
    // Local forget ONLY. Deliberately no supabase.auth.signOut() here: the default global scope
    // would revoke that user's sessions on their other devices, and even a local sign-out is wrong
    // for an account that isn't the active one.
    await removeAccount(a.user_id);
    await refetch();
    toast.success(`Removed ${a.full_name ?? a.email ?? "account"}`);
  }

  return (
    <div className="px-4 pt-6 pb-24 space-y-6">
      <SettingsHeader title="Switch account" />

      <p className="px-1 text-xs text-muted-foreground">
        Accounts you've signed into on this device. Switching is instant — no password needed.
      </p>

      {accounts.length === 0 ? (
        <p className="px-1 text-sm text-muted-foreground">
          No other accounts remembered yet. Add one below.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card divide-y divide-border shadow-sm">
          {accounts.map((a) => {
            const isCurrent = a.user_id === currentId;
            return (
              <SwipeRow
                key={a.user_id}
                onDelete={() => onRemove(a)}
                // The active account can't be switched to, and shouldn't be forgotten from under
                // itself — leave it swipe-less and tap-less.
                canDelete={!isCurrent}
                deleteDeniedMessage="You're signed into this account"
                onClick={isCurrent ? undefined : () => onSwitch(a)}
              >
                <div className="flex items-center gap-3 bg-card p-4">
                  <UserAvatar url={a.avatar_url} name={a.full_name ?? a.email} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {a.full_name ?? "Unnamed account"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{a.email ?? "—"}</p>
                  </div>
                  {busyId === a.user_id ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                  ) : isCurrent ? (
                    <span className="flex shrink-0 items-center gap-1 text-xs text-income">
                      <Check className="h-4 w-4" /> Active
                    </span>
                  ) : null}
                </div>
              </SwipeRow>
            );
          })}
        </div>
      )}

      {/* ?add=1 keeps the sign-in screen from bouncing straight back to /home — both the route
          guard in App.tsx and auth.tsx's own effect redirect when a session already exists. */}
      <button
        type="button"
        onClick={() => navigate("/auth?add=1")}
        className="flex w-full items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left active:bg-secondary/40"
      >
        <Plus className="h-5 w-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Add account</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Sign into another profile — this one stays remembered
          </p>
        </div>
      </button>
    </div>
  );
}
