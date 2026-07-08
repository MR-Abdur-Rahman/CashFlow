import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { getCurrentVersion, getLatestVersion, minorOf } from "@/lib/appVersion";

// Polls /version.json (emitted per build by vite.config.ts) and, when the deployed build id differs
// from the one baked into this running bundle, shows a prompt to reload into the new version.
// The app isn't installed/launched, so users can otherwise sit on a stale cached bundle indefinitely.
export function UpdatePrompt() {
  const [available, setAvailable] = useState(false);
  // APK gate: on native, a web reload only helps users already on the latest APK. Users whose APK
  // minor is behind need a new APK, so we hide this banner for them (inverse of NativeUpdateModal's
  // "show the update popup when behind"). On web there's no APK — keep the banner ungated.
  const [apkOk, setApkOk] = useState<boolean | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      setApkOk(true); // web: no APK concept, keep existing behavior
      return;
    }
    (async () => {
      const [current, latest] = await Promise.all([getCurrentVersion(), getLatestVersion()]);
      // Only show when we can confirm the installed minor is NOT behind the latest minor.
      if (!current || !latest?.version) return setApkOk(false);
      setApkOk(minorOf(current) >= minorOf(latest.version));
    })();
  }, []);

  useEffect(() => {
    if (!import.meta.env.PROD) return; // no version.json in dev
    let stopped = false;

    async function check() {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) return;
        const { buildId } = await res.json();
        if (!stopped && buildId && buildId !== __BUILD_ID__) setAvailable(true);
      } catch {
        // offline or transient — try again next tick
      }
    }

    check();
    const interval = setInterval(check, 60_000);
    const onVisible = () => document.visibilityState === "visible" && check();
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearInterval(interval);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (!available || !apkOk) return null;

  return (
    <div
      className="fixed inset-x-0 z-[60] flex justify-center px-4"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 84px)" }}
    >
      <div className="w-full max-w-[398px] flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-lg">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Update available</p>
          <p className="text-xs text-muted-foreground mt-0.5">A new version of CashFlow is ready.</p>
        </div>
        <Button size="sm" className="shrink-0" onClick={() => window.location.reload()}>
          <RefreshCw className="h-4 w-4 mr-2" /> Update
        </Button>
      </div>
    </div>
  );
}
