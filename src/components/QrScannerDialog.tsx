import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Html5Qrcode } from "html5-qrcode";

export function QrScannerDialog({
  open,
  onOpenChange,
  onScan,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onScan: (text: string) => void;
}) {
  const elId = "qr-reader-region";
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    let stopped = false;
    const start = async () => {
      try {
        const scanner = new Html5Qrcode(elId, { verbose: false });
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decoded) => {
            if (stopped) return;
            stopped = true;
            onScan(decoded);
            void scanner.stop().then(() => scanner.clear());
            onOpenChange(false);
          },
          () => {},
        );
      } catch (e: any) {
        setError(e?.message ?? "Could not start camera. Allow camera access and try again.");
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
  }, [open, onOpenChange, onScan]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogTitle>Scan QR code</DialogTitle>
        <div id={elId} className="w-full rounded-lg overflow-hidden bg-black" style={{ minHeight: 280 }} />
        {error ? (
          <p className="text-xs text-expense">{error}</p>
        ) : (
          <p className="text-xs text-muted-foreground text-center">Point the camera at a CashFlow QR</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
