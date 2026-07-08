import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { getCurrentVersion, getLatestVersion, minorOf, type LatestVersion } from "@/lib/appVersion";
import { UpdateAvailableDialog } from "@/components/UpdateAvailableDialog";

// Native-only: on app open, prompts to update when the installed APK's MINOR version is behind the
// latest published at /app-version.json. Only the minor (second) digit matters — a new APK is needed
// only on a minor bump; patch differences are ignored entirely.
const DISMISSED_MINOR_KEY = "cashflow_update_dismissed_minor";
// Written by PermissionsOnboarding when its flow is finished. We wait for it so this popup never
// overlaps the permissions dialog (see the X-button fix note below).
const PERMISSIONS_SEEN_KEY = "cashflow_permissions_v2";

export function NativeUpdateModal() {
  const [open, setOpen] = useState(false);
  const [latest, setLatest] = useState<LatestVersion | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    // X-button bug fix: two concurrently-open modal Radix dialogs cross-dismiss — clicking this
    // popup's X registers as an "outside interaction" for the permissions dialog and closes it too.
    // There is no shared modal state; the cause is the overlap. So we don't open until the
    // permissions onboarding has finished (it runs once per device on first launch); by the next
    // open this popup is the only app-level dialog and its X closes nothing else.
    if (!localStorage.getItem(PERMISSIONS_SEEN_KEY)) return;

    (async () => {
      const [current, data] = await Promise.all([getCurrentVersion(), getLatestVersion()]);
      if (!data?.version || !current) return;

      const latestMinor = minorOf(data.version);
      // Show ONLY when the installed minor is behind the latest minor. Patch is irrelevant.
      if (latestMinor <= minorOf(current)) return;

      // "Don't show again" persists the dismissed minor; reappear only when a newer minor ships.
      const dismissedMinor = Number(localStorage.getItem(DISMISSED_MINOR_KEY) ?? "-1");
      if (latestMinor <= dismissedMinor) return;

      setLatest(data);
      setOpen(true);
    })();
  }, []);

  return (
    <UpdateAvailableDialog
      open={open}
      onOpenChange={setOpen}
      latest={latest}
      allowDontShowAgain
      onSkip={(dontShow) => {
        // Skip + "Don't show again" → remember the dismissed minor. Skip alone → persist nothing,
        // so the popup returns next app open.
        if (dontShow && latest) {
          localStorage.setItem(DISMISSED_MINOR_KEY, String(minorOf(latest.version)));
        }
      }}
    />
  );
}
