import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Html5Qrcode } from "html5-qrcode";

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

  useEffect(() => {
    if (!open) return;
    setError(null);
    setHasPermission(null);
    let stopped = false;

    const start = async () => {
      // Check if running on HTTPS or localhost
      const isSecure = location.protocol === "https:" || location.hostname === "localhost";
      if (!isSecure) {
        setError("Camera requires HTTPS. Please open the app on your phone via the live URL.");
        return;
      }

      // Request camera permission explicitly first
      try {
        await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        setHasPermission(true);
      } catch (e: any) {
        setError("Camera access denied. Please allow camera permission and try again.");
        return;
      }

      try {
        // Small delay to ensure DOM element is ready
        await new Promise((r) => setTimeout(r, 100));

        const scanner = new Html5Qrcode(elId, { verbose: false });
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decoded) => {
            if (stopped) return;
            stopped = true;
            // Support both prop names
            onScan?.(decoded);
            onResult?.(decoded);
            void scanner.stop().then(() => scanner.clear()).catch(() => {});
            onOpenChange(false);
          },
          () => {}, // ignore per-frame errors
        );
      } catch (e: any) {
        setError(e?.message ?? "Could not start camera. Please try again.");
      }
    };

    void start();

    return () => {
      stopped = true;
      const s = scannerRef.current;
      if (s) {
        s.stop().then(() => s.clear()).catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
              <span className="text-primary">cash-flow-zrs8.vercel.app</span>
            </p>
          </div>
        ) : hasPermission === null ? (
          <p className="text-xs text-muted-foreground text-center">Requesting camera access...</p>
        ) : (
          <p className="text-xs text-muted-foreground text-center">Point the camera at a CashFlow QR code</p>
        )}
      </DialogContent>
    </Dialog>
  );
}