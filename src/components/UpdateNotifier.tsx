import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Replaces the old on-screen "Update available" banner. Same detection as before — polls /version.json
// (emitted per build by vite.config.ts) and compares its buildId to the running bundle's __BUILD_ID__ —
// but instead of showing a banner it inserts a one-time "app_update" NOTIFICATION, so the update
// surfaces through the normal notification system (home bell + Notification History) like everything
// else. Tapping that notification opens the shared Check-Updates dialog.
//
// Dedup: a localStorage key per buildId short-circuits repeated polls, and we skip inserting when an
// unread app_update already exists — so at most one pending update notification at a time.
//
// TEMPORARY: pre-bundling, every update type is just a new web bundle that a reload picks up, so a
// single "app_update" + reload correctly reflects reality. Once the app is bundled into the APK,
// patch/minor/major will need distinct handling — revisit then (see project_bundled_conversion_plan).
export function UpdateNotifier() {
  const qc = useQueryClient();

  useEffect(() => {
    if (!import.meta.env.PROD) return; // no version.json in dev
    let stopped = false;
    // Re-entrancy guard: mount/interval/focus/visibilitychange can fire check() near-simultaneously,
    // and the localStorage + unread-notification guards sit behind async awaits (a TOCTOU race), so two
    // overlapping runs could each insert. Serialize so only one runs at a time → exactly one insert.
    let running = false;

    async function check() {
      if (running) return;
      running = true;
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) return;
        const { buildId } = await res.json();
        if (stopped || !buildId || buildId === __BUILD_ID__) return;

        const key = `cf_update_notified_${buildId}`;
        if (localStorage.getItem(key)) return; // already handled this build on this device

        const { data: u } = await supabase.auth.getUser();
        if (!u.user) return;

        // One pending update notification at a time (don't stack across builds).
        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("user_id", u.user.id)
          .eq("type", "app_update")
          .eq("is_read", false)
          .limit(1);
        if (!existing?.length) {
          const { error } = await supabase.from("notifications").insert({
            user_id: u.user.id,
            type: "app_update",
            title: "Update available",
            message: "A new version of CashFlow is ready. Tap to update.",
          });
          if (error) return;
          qc.invalidateQueries({ queryKey: ["notifications"] });
        }
        localStorage.setItem(key, "1");
      } catch {
        // offline or transient — retry next tick
      } finally {
        running = false;
      }
    }

    check();
    const interval = setInterval(check, 60_000);
    const onFocus = () => check();
    const onVisible = () => document.visibilityState === "visible" && check();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [qc]);

  return null;
}
