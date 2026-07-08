import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";

// WhatsApp-style App Info: bare back arrow (no title), centered icon/name/version, footer copyright.
// The version comes ONLY from the native build (App.getInfo) — never hardcoded or read from a web
// file — so it stays fixed per APK even as the web content updates. On the web there's no native
// version, so it shows a dash.
export default function AppInfoPage() {
  const [version, setVersion] = useState<string | null>(null);
  const [build, setBuild] = useState<number | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    CapApp.getInfo()
      .then((info) => setVersion(info.version))
      .catch(() => setVersion(null));
  }, []);

  useEffect(() => {
    // Live patch/build number — written to public/build-version.json by version-bump.yml on every
    // push. Best-effort: if it's missing (very first load) or the fetch fails, we show the native
    // version with no build suffix.
    fetch(`/build-version.json?t=${Date.now()}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && typeof d.patch === "number") setBuild(d.patch);
      })
      .catch(() => {});
  }, []);

  // "Version 1.2.0 (build 4)" on native; the build suffix is dropped if the file isn't available.
  const label = version ? `Version ${version}${build != null ? ` (build ${build})` : ""}` : "—";

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

      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 pb-24 text-center">
        <img src="/favicon.svg" alt="CashFlow" className="h-20 w-20" />
        <p className="text-xl font-semibold text-foreground">CashFlow</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>

      <p className="pb-8 text-center text-xs text-muted-foreground">© 2026 CashFlow</p>
    </div>
  );
}
