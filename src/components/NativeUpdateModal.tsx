import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Capacitor } from "@capacitor/core";
import { getCurrentVersion, getLatestVersion, minorOf, type LatestVersion } from "@/lib/appVersion";
import { scheduledTransactionsQuery } from "@/lib/queries";
import { isDue, type Scheduled } from "@/lib/scheduled";
import { UpdateAvailableDialog } from "@/components/UpdateAvailableDialog";

// Native-only: on app open, prompts to update when the installed APK's MINOR version is behind the
// latest published at /app-version.json. Only the minor (second) digit matters — a new APK is needed
// only on a minor bump; patch differences are ignored entirely.
const DISMISSED_MINOR_KEY = "cashflow_update_dismissed_minor";
// Written by PermissionsOnboarding when its flow is finished. We wait for it so this popup never
// overlaps the permissions dialog (see the X-button fix note below).
const PERMISSIONS_SEEN_KEY = "cashflow_permissions_v2";

// `retrySignal` increments (from App) each time ScheduledDuePrompt closes, so the update check can
// re-run in the SAME session once that prompt is dismissed — instead of giving up until next launch.
export function NativeUpdateModal({ retrySignal = 0 }: { retrySignal?: number }) {
  const [open, setOpen] = useState(false);
  const [latest, setLatest] = useState<LatestVersion | null>(null);
  const checkRanRef = useRef(false);
  // Same query ScheduledDuePrompt uses to decide whether IT auto-opens.
  const { data: scheduledList = [], isPending: schedPending } = useQuery(scheduledTransactionsQuery());

  useEffect(() => {
    if (checkRanRef.current) return; // open at most once per session
    if (!Capacitor.isNativePlatform()) return;
    // X-button bug fix: two concurrently-open modal Radix dialogs cross-dismiss — clicking this
    // popup's X registers as an "outside interaction" for the other dialog and closes it too. There
    // is no shared modal state; the cause is the overlap. So we don't open while another app-level
    // dialog is showing:
    //  - the permissions onboarding (once-per-device localStorage flag), and
    //  - the ScheduledDuePrompt (open while any schedule isDue AND it hasn't been dismissed yet this
    //    session — retrySignal stays 0 until it closes, then we proceed right after dismissal).
    if (!localStorage.getItem(PERMISSIONS_SEEN_KEY)) return;
    // Wait for the scheduled data to load before deciding.
    if (schedPending) return;
    if ((scheduledList as Scheduled[]).some((s) => isDue(s)) && retrySignal === 0) return;
    checkRanRef.current = true;

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
  }, [schedPending, scheduledList, retrySignal]);

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
