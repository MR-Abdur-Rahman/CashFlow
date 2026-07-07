import { useEffect, useRef, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Html5Qrcode } from "html5-qrcode";
import { APP_HOST } from "@/lib/config";

export function QrScannerDialog({
  open,
  onOpenChange,
  onScan,
  onResult,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onScan?: (text: string) => void;
  onResult?: (text: string) => void;
}) {
  const elId = "qr-reader-region";
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  const stopScanner = useCallback(async () => {
    const s = scannerRef.current;
    if (s) {
      try {
        await s.stop();
        s.clear();
      } catch {}
      scannerRef.current = null;
    }
    // Force stop ALL video tracks to prevent black screen
    try {
      const videos = document.querySelectorAll("video");
      videos.forEach((v) => {
        const stream = v.srcObject as MediaStream | null;
        stream?.getTracks().forEach((t) => t.stop());
        v.srcObject = null;
      });
    } catch {}
  }, []);

  useEffect(() => {
    if (!open) {
      stopScanner();
      return;
    }

    setError(null);
    setHasPermission(null);
    let stopped = false;

    const start = async () => {
      const isSecure = location.protocol === "https:" || location.hostname === "localhost";
      if (!isSecure) {
        setError("Camera requires HTTPS. Please open the app via the live URL.");
        return;
      }

      try {
        await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        setHasPermission(true);
      } catch {
        setError("Camera access denied. Please allow camera permission and try again.");
        return;
      }

      try {
        await new Promise((r) => setTimeout(r, 150));

        // Make sure element exists
        const el = document.getElementById(elId);
        if (!el) {
          setError("Scanner element not found. Please try again.");
          return;
        }

        const scanner = new Html5Qrcode(elId, { verbose: false });
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          async (decoded) => {
            if (stopped) return;
            stopped = true;
            await stopScanner();
            onScan?.(decoded);
            onResult?.(decoded);
            onOpenChange(false);
          },
          () => {},
        );
      } catch (e: any) {
        setError(e?.message ?? "Could not start camera. Please try again.");
      }
    };

    void start();

    return () => {
      stopped = true;
      stopScanner();
    };
  }, [open]);

  return (
    <Dialog
      open={open}
      onOpenChange={async (o) => {
        if (!o) await stopScanner();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogTitle>Scan QR code</DialogTitle>
        <div
          id={elId}
          className="w-full rounded-lg overflow-hidden bg-black"
          style={{ minHeight: 280 }}
        />
        {error ? (
          <div className="space-y-2">
            <p className="text-xs text-expense text-center">{error}</p>
            <p className="text-xs text-muted-foreground text-center">
              Make sure you're using the app at{" "}
              <span className="text-primary">{APP_HOST}</span>
            </p>
          </div>
        ) : hasPermission === null ? (
          <p className="text-xs text-muted-foreground text-center">Requesting camera access...</p>
        ) : (
          <p className="text-xs text-muted-foreground text-center">
            Point the camera at a CashFlow QR code
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
