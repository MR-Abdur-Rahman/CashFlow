import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Bell, Camera } from "lucide-react";
import { cn } from "@/lib/utils";

// One-at-a-time permission prompts, shown once per device to any signed-in user (new + existing;
// gated by a localStorage flag since browser permissions are per-device). Only the permissions a web
// app can actually request are here — Notifications and Camera. SMS/Contacts are handled elsewhere
// (Contacts via the on-demand Contact Picker; SMS deferred until an SMS provider is purchased).
const SEEN_KEY = "cashflow_permissions_v2";

const STEPS = [
  {
    key: "notifications" as const,
    icon: Bell,
    title: "Notifications",
    desc: "Get alerts for splits, settlements and payment reminders.",
  },
  {
    key: "camera" as const,
    icon: Camera,
    title: "Camera",
    desc: "Scan a friend's QR code to connect instantly.",
  },
];

export function PermissionsOnboarding() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(SEEN_KEY)) setOpen(true);
  }, []);

  function finish() {
    localStorage.setItem(SEEN_KEY, "1");
    setOpen(false);
  }
  function next() {
    if (step < STEPS.length - 1) setStep((s) => s + 1);
    else finish();
  }

  async function allow() {
    setBusy(true);
    try {
      const key = STEPS[step].key;
      if (key === "notifications" && "Notification" in window) {
        await Notification.requestPermission();
      } else if (key === "camera" && navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach((t) => t.stop()); // prime the grant, then release the camera
      }
    } catch {
      /* denied / unsupported — move on either way */
    } finally {
      setBusy(false);
      next();
    }
  }

  const current = STEPS[step];
  const Icon = current.icon;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && finish()}>
      <DialogContent className="max-w-xs text-center">
        {/* Progress dots */}
        <div className="flex justify-center gap-1.5">
          {STEPS.map((s, i) => (
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
