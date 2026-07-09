import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { Button } from "@/components/ui/button";
import { UpdateAvailableDialog } from "@/components/UpdateAvailableDialog";
import { getCurrentVersion, getLatestVersion, minorOf, type LatestVersion } from "@/lib/appVersion";

// WhatsApp-style App Info: bare back arrow (no title), centered icon/name/version, footer copyright.
// The version comes ONLY from the native build (App.getInfo) — never hardcoded or read from a web
// file — so it stays fixed per APK even as the web content updates. On the web there's no native
// version, so it shows a dash.
export default function AppInfoPage() {
  const native = Capacitor.isNativePlatform();
  const [version, setVersion] = useState<string | null>(null);
  const [webVersion, setWebVersion] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [latest, setLatest] = useState<LatestVersion | null>(null);
  const [dlgOpen, setDlgOpen] = useState(false);

  useEffect(() => {
    if (!native) return;
    CapApp.getInfo()
      .then((info) => setVersion(info.version))
      .catch(() => setVersion(null));
  }, [native]);

  // Same behavior as the old Tutorial & Update "Check for updates" row: minor-only comparison; opens
  // the update dialog when behind, else a toast.
  async function checkForUpdates() {
    if (checking) return;
    if (!native) return toast("The web app is always up to date");
    setChecking(true);
    try {
      const [cur, data] = await Promise.all([getCurrentVersion(), getLatestVersion()]);
      if (data?.version && cur && minorOf(data.version) > minorOf(cur)) {
        setLatest(data);
        setDlgOpen(true);
      } else if (data?.version) {
        toast("You're on the latest version");
      } else {
        toast.error("Couldn't check for updates");
      }
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    // Full combined version — written to public/build-version.json by version-bump.yml on every push
    // (major.minor from the last APK release + live patch, e.g. "1.2.7"). Best-effort: if it's
    // missing (very first load) or the fetch fails, we fall back to the native version below.
    fetch(`/build-version.json?t=${Date.now()}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && typeof d.version === "string") setWebVersion(d.version);
      })
      .catch(() => {});
  }, []);

  // Prefer the live combined version ("1.2.7"); fall back to the native version, then a dash.
  const shown = webVersion ?? version;
  const label = shown ? `Version ${shown}` : "—";

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--background)" }}>
      <div className="p-4">
        <Link
          to="/settings/help"
          aria-label="Back"
          className="-ml-1 inline-flex p-1 text-muted-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <img src="/favicon.svg" alt="CashFlow" className="h-20 w-20" />
        <p className="text-xl font-semibold text-foreground">CashFlow</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>

      <div className="px-6 pb-32">
        <Button className="w-full" disabled={checking} onClick={checkForUpdates}>
          {checking ? "Checking…" : "Check Updates"}
        </Button>
      </div>

      <p className="pb-8 text-center text-xs text-muted-foreground">© 2026 CashFlow</p>

      <UpdateAvailableDialog open={dlgOpen} onOpenChange={setDlgOpen} latest={latest} />
    </div>
  );
}
