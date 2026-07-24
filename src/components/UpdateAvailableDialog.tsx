import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { LatestVersion } from "@/lib/appVersion";

// Two-step update prompt shared by the auto check (NativeUpdateModal) and the manual check
// (Tutorial & Update page): "Update Available" → "What's new" (release notes) → a greyed Continue
// (no download page yet). `allowDontShowAgain` shows the dismiss checkbox for the auto flow.
export function UpdateAvailableDialog({
  open,
  onOpenChange,
  latest,
  allowDontShowAgain = false,
  onSkip,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  latest: LatestVersion | null;
  allowDontShowAgain?: boolean;
  onSkip?: (dontShow: boolean) => void;
}) {
  const [step, setStep] = useState<"update" | "notes">("update");
  const [dontShow, setDontShow] = useState(false);

  useEffect(() => {
    if (open) {
      setStep("update");
      setDontShow(false);
    }
  }, [open]);

  function skip() {
    onSkip?.(dontShow);
    onOpenChange(false);
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
            {allowDontShowAgain && (
              <label className="mt-1 flex items-center gap-2 text-sm">
                <Checkbox checked={dontShow} onCheckedChange={(v) => setDontShow(!!v)} /> Don't show
                again
              </label>
            )}
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
            {/* Centered two-button row (Skip / Continue), matching the app's confirm-dialog style. */}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button variant="ghost" onClick={skip}>
                Skip
              </Button>
              {/* TEMPORARY: pre-bundling, every update type (patch/minor/major) is just a new web bundle,
                  so reloading applies it — which is correct for ALL of them right now. Once the app is
                  bundled into the APK, patch/minor/major will need different handling (downloading a new
                  APK instead of a simple reload) and this unified reload-on-Continue MUST be revisited.
                  See project_bundled_conversion_plan. */}
              <Button onClick={() => window.location.reload()}>Continue</Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
