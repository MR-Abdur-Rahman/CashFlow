import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

// Native-only: on app open, compares the version baked into this APK (App.getInfo) against the
// latest version published at /app-version.json. On a mismatch (and if the user hasn't permanently
// dismissed that exact version) it prompts to update. Separate from UpdatePrompt (which is the web
// reload check) — this one is about installing a newer APK.
const DISMISS_KEY = "cashflow_dismissed_update_version";
type Latest = { version: string; releaseNotes: string[] };

export function NativeUpdateModal() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"update" | "notes">("update");
  const [dontShow, setDontShow] = useState(false);
  const [latest, setLatest] = useState<Latest | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    (async () => {
      try {
        const info = await CapApp.getInfo();
        const res = await fetch(`/app-version.json?t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as Latest;
        const dismissed = localStorage.getItem(DISMISS_KEY);
        if (data.version && data.version !== info.version && dismissed !== data.version) {
          setLatest(data);
          setStep("update");
          setOpen(true);
        }
      } catch {
        /* offline / file missing — nothing to do */
      }
    })();
  }, []);

  function skip() {
    if (dontShow && latest) localStorage.setItem(DISMISS_KEY, latest.version);
    setOpen(false);
  }

  if (!latest) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && skip()}>
      <DialogContent className="max-w-xs">
        {step === "update" ? (
          <>
            <DialogTitle>Update Available</DialogTitle>
            <DialogDescription>
              A newer version of CashFlow ({latest.version}) is available.
            </DialogDescription>
            <label className="mt-1 flex items-center gap-2 text-sm">
              <Checkbox checked={dontShow} onCheckedChange={(v) => setDontShow(!!v)} /> Don't show
              again
            </label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button variant="ghost" onClick={skip}>
                Skip
              </Button>
              <Button onClick={() => setStep("notes")}>Update</Button>
            </div>
          </>
        ) : (
          <>
            <DialogTitle>What's new</DialogTitle>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {latest.releaseNotes?.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
            <Button className="mt-2 w-full" disabled>
              Continue
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
