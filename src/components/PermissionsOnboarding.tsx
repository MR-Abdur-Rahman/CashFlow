import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Bell, Camera, Users } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { Contacts } from "@capacitor-community/contacts";
import { cn } from "@/lib/utils";

// One-at-a-time permission prompts, shown once per device to any signed-in user (new + existing;
// gated by a localStorage flag since browser permissions are per-device). On the native app a third
// step requests real Contacts access; on the web only Notifications + Camera are grantable.
export const PERMISSIONS_SEEN_KEY = "cashflow_permissions_v2";

// `onComplete` fires when the flow is dismissed/finished, OR immediately on mount if permissions were
// already granted on this device — letting callers (e.g. the post-setup /welcome handoff) chain the
// next step. The App-chrome instance passes nothing, so it's a no-op there (unchanged behavior).
export function PermissionsOnboarding({ onComplete }: { onComplete?: () => void } = {}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);

  const steps = useMemo(() => {
    type Step = { key: "notifications" | "camera" | "contacts"; icon: typeof Bell; title: string; desc: string };
    const base: Step[] = [
      {
        key: "notifications",
        icon: Bell,
        title: "Notifications",
        desc: "Get alerts for splits, settlements and payment reminders.",
      },
      {
        key: "camera",
        icon: Camera,
        title: "Camera",
        desc: "Scan a friend's QR code to connect instantly.",
      },
    ];
    if (Capacitor.isNativePlatform()) {
      base.push({
        key: "contacts",
        icon: Users,
        title: "Contacts",
        desc: "Invite friends straight from your phone's contacts.",
      });
    }
    return base;
  }, []);

  useEffect(() => {
    if (!localStorage.getItem(PERMISSIONS_SEEN_KEY)) setOpen(true);
    else onComplete?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function finish() {
    localStorage.setItem(PERMISSIONS_SEEN_KEY, "1");
    setOpen(false);
    onComplete?.();
  }
  function next() {
    if (step < steps.length - 1) setStep((s) => s + 1);
    else finish();
  }

  async function allow() {
    setBusy(true);
    try {
      const key = steps[step].key;
      if (key === "notifications" && "Notification" in window) {
        await Notification.requestPermission();
      } else if (key === "camera" && navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach((t) => t.stop()); // prime the grant, then release the camera
      } else if (key === "contacts") {
        await Contacts.requestPermissions();
      }
    } catch {
      /* denied / unsupported — move on either way */
    } finally {
      setBusy(false);
      next();
    }
  }

  const current = steps[step];
  const Icon = current.icon;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && finish()}>
      <DialogContent className="max-w-xs text-center">
        {/* Progress dots */}
        <div className="flex justify-center gap-1.5">
          {steps.map((s, i) => (
            <span
              key={s.key}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === step ? "w-5 bg-primary" : "w-1.5 bg-border",
              )}
            />
          ))}
        </div>

        <div className="mx-auto mt-2 grid h-16 w-16 place-items-center rounded-full bg-primary/10 text-primary">
          <Icon className="h-8 w-8" />
        </div>

        <DialogTitle className="text-center">{current.title}</DialogTitle>
        <DialogDescription className="text-center">{current.desc}</DialogDescription>

        <div className="mt-1 space-y-2">
          <Button className="w-full" disabled={busy} onClick={allow}>
            Allow
          </Button>
          <Button variant="ghost" className="w-full" disabled={busy} onClick={next}>
            Not now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
