import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Bell, Camera, Users, MessageSquare, Check, X } from "lucide-react";

// Shown once per device to any signed-in user (new sign-ups and existing users alike — gated by a
// localStorage flag, since browser permissions are per-device anyway).
//
// Only Notifications and Camera are grantable in a web app. Contacts and SMS have no standing web
// permission and aren't used by CashFlow (in-app People list + email verification), so they're shown
// for transparency but marked as not needed.
const SEEN_KEY = "cashflow_permissions_v1";

type PermState = "default" | "granted" | "denied" | "unsupported";

function statusLabel(s: PermState) {
  if (s === "granted") return "Allowed";
  if (s === "denied") return "Blocked";
  if (s === "unsupported") return "Not available";
  return null;
}

export function PermissionsOnboarding() {
  const [open, setOpen] = useState(false);
  const [notif, setNotif] = useState<PermState>("default");
  const [camera, setCamera] = useState<PermState>("default");

  useEffect(() => {
    if (localStorage.getItem(SEEN_KEY)) return;
    setNotif(!("Notification" in window) ? "unsupported" : (Notification.permission as PermState));
    (async () => {
      try {
        const status = await (navigator as any).permissions?.query({ name: "camera" });
        if (status) setCamera(status.state === "prompt" ? "default" : (status.state as PermState));
      } catch {
        /* Permissions API / camera name unsupported — leave as default */
      }
    })();
    setOpen(true);
  }, []);

  async function askNotifications() {
    if (!("Notification" in window)) return setNotif("unsupported");
    try {
      setNotif((await Notification.requestPermission()) as PermState);
    } catch {
      setNotif("denied");
    }
  }

  async function askCamera() {
    if (!navigator.mediaDevices?.getUserMedia) return setCamera("unsupported");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((t) => t.stop()); // prime the grant, don't keep it on
      setCamera("granted");
    } catch {
      setCamera("denied");
    }
  }

  function dismiss() {
    localStorage.setItem(SEEN_KEY, "1");
    setOpen(false);
  }

  const rows = [
    {
      icon: Bell,
      title: "Notifications",
      desc: "Split, settlement and reminder alerts",
      state: notif,
      onAllow: askNotifications,
    },
    {
      icon: Camera,
      title: "Camera",
      desc: "Scan a friend's QR code to connect",
      state: camera,
      onAllow: askCamera,
    },
  ] as const;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && dismiss()}>
      <DialogContent className="max-w-sm">
        <DialogTitle>Set up permissions</DialogTitle>
        <DialogDescription>Allow these so CashFlow works at its best.</DialogDescription>

        <div className="space-y-2">
          {rows.map(({ icon: Icon, title, desc, state, onAllow }) => {
            const label = statusLabel(state);
            return (
              <div key={title} className="flex items-center gap-3 rounded-xl border border-border p-3">
                <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{title}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
                {state === "granted" ? (
                  <span className="flex items-center gap-1 text-xs text-income shrink-0">
                    <Check className="h-4 w-4" /> Allowed
                  </span>
                ) : label ? (
                  <span className="text-xs text-muted-foreground shrink-0">{label}</span>
                ) : (
                  <Button size="sm" variant="secondary" className="shrink-0" onClick={onAllow}>
                    Allow
                  </Button>
                )}
              </div>
            );
          })}

          {/* Not available in a web app — shown for transparency. */}
          {[
            { icon: Users, title: "Contacts", desc: "CashFlow uses your in-app People list" },
            { icon: MessageSquare, title: "SMS", desc: "CashFlow verifies with email, not SMS" },
          ].map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="flex items-center gap-3 rounded-xl border border-border p-3 opacity-60"
            >
              <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{title}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
              <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                <X className="h-3.5 w-3.5" /> Not needed
              </span>
            </div>
          ))}
        </div>

        <Button className="w-full mt-1" onClick={dismiss}>
          Done
        </Button>
      </DialogContent>
    </Dialog>
  );
}
