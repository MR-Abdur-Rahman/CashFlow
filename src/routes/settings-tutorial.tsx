import { useEffect, useState } from "react";
import { toast } from "sonner";
import { GraduationCap, RefreshCw } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { SettingsHeader, Section, Row } from "@/components/SettingsRows";
import { UpdateAvailableDialog } from "@/components/UpdateAvailableDialog";
import { getCurrentVersion, getLatestVersion, minorOf, type LatestVersion } from "@/lib/appVersion";

export default function TutorialUpdatePage() {
  const native = Capacitor.isNativePlatform();
  const [current, setCurrent] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [latest, setLatest] = useState<LatestVersion | null>(null);
  const [dlgOpen, setDlgOpen] = useState(false);

  useEffect(() => {
    getCurrentVersion().then(setCurrent);
  }, []);

  async function checkForUpdates() {
    if (checking) return;
    if (!native) return toast("The web app is always up to date");
    setChecking(true);
    try {
      const [cur, data] = await Promise.all([getCurrentVersion(), getLatestVersion()]);
      setCurrent(cur);
      // Minor-only comparison (matches NativeUpdateModal) — a new APK is needed only on a minor bump;
      // patch differences don't count.
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

  return (
    <div className="px-4 pt-6 pb-24 space-y-6">
      <SettingsHeader title="Tutorial & Update" back="/settings" />

      <Section label="Tutorial">
        <Row
          icon={<GraduationCap className="h-4 w-4" />}
          label="How to use CashFlow"
          onClick={() => toast("Coming soon")}
        />
      </Section>

      <Section label="Update">
        <div className="flex items-center justify-between p-4">
          <span className="text-sm">Current version</span>
          <span className="text-sm text-muted-foreground font-mono">{current ?? "—"}</span>
        </div>
        <Row
          icon={<RefreshCw className="h-4 w-4" />}
          label={checking ? "Checking…" : "Check for updates"}
          onClick={checkForUpdates}
        />
      </Section>

      <UpdateAvailableDialog open={dlgOpen} onOpenChange={setDlgOpen} latest={latest} />
    </div>
  );
}
