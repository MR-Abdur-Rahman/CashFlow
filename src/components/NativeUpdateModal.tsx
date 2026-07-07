import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { getCurrentVersion, getLatestVersion, type LatestVersion } from "@/lib/appVersion";
import { UpdateAvailableDialog } from "@/components/UpdateAvailableDialog";

// Native-only: on app open, compares the version baked into this APK against the latest published at
// /app-version.json. On a mismatch (and if the user hasn't permanently dismissed that exact version)
// it prompts to update. The Tutorial & Update page offers the same prompt via a manual check.
export const DISMISS_KEY = "cashflow_dismissed_update_version";

export function NativeUpdateModal() {
  const [open, setOpen] = useState(false);
  const [latest, setLatest] = useState<LatestVersion | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    (async () => {
      const [current, data] = await Promise.all([getCurrentVersion(), getLatestVersion()]);
      if (!data?.version || !current) return;
      const dismissed = localStorage.getItem(DISMISS_KEY);
      if (data.version !== current && dismissed !== data.version) {
        setLatest(data);
        setOpen(true);
      }
    })();
  }, []);

  return (
    <UpdateAvailableDialog
      open={open}
      onOpenChange={setOpen}
      latest={latest}
      allowDontShowAgain
      onSkip={(dontShow) => {
        if (dontShow && latest) localStorage.setItem(DISMISS_KEY, latest.version);
      }}
    />
  );
}
