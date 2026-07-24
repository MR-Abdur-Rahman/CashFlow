import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { Button } from "@/components/ui/button";
import { UpdateAvailableDialog } from "@/components/UpdateAvailableDialog";
import { getLatestVersion, type LatestVersion } from "@/lib/appVersion";

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

  // Unified update check for ALL types (patch/minor/major). TEMPORARY: pre-bundling, every update is
  // just a new web bundle, so "is an update available?" == "does /version.json's buildId differ from the
  // running bundle?" (the same signal the old patch banner used). Once bundled into the APK, minor/major
  // will need APK-download handling instead — revisit then (see project_bundled_conversion_plan).
  async function checkForUpdates() {
    if (checking) return;
    setChecking(true);
    try {
      const [ver, data] = await Promise.all([
        fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        getLatestVersion(),
      ]);
      const updateAvailable =
        typeof __BUILD_ID__ !== "undefined" && !!ver?.buildId && ver.buildId !== __BUILD_ID__;
      if (updateAvailable) {
        // Fall back to a notes-less entry if app-version.json is missing so the dialog still shows.
        setLatest(data ?? { version: webVersion ?? version ?? "", releaseNotes: [] });
        setDlgOpen(true);
      } else {
        toast("You're on the latest version");
      }
    } finally {
      setChecking(false);
    }
  }

  // Opened from the "Update available" notification (…/app-info?update=1) — auto-run the same check so
  // the shared dialog appears without a second tap.
  const [params] = useSearchParams();
  const autoRan = useRef(false);
  useEffect(() => {
    if (params.get("update") === "1" && !autoRan.current) {
      autoRan.current = true;
      void checkForUpdates();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

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
