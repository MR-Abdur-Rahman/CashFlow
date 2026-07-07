import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { APP_HOST } from "@/lib/config";

// Inline camera QR scanner (no dialog wrapper). Runs while `active` is true.
export function QrScannerInline({
  active,
  onScan,
}: {
  active: boolean;
  onScan: (text: string) => void;
}) {
  const elId = "qr-reader-inline";
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
    if (!active) {
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
            onScan(decoded);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return (
    <div className="space-y-2">
      <div
        id={elId}
        className="w-full rounded-xl overflow-hidden bg-black"
        style={{ minHeight: 280 }}
      />
      {error ? (
        <>
          <p className="text-xs text-expense text-center">{error}</p>
          <p className="text-xs text-muted-foreground text-center">
            Make sure you're using the app at{" "}
            <span className="text-primary">{APP_HOST}</span>
          </p>
        </>
      ) : hasPermission === null ? (
        <p className="text-xs text-muted-foreground text-center">Requesting camera access...</p>
      ) : (
        <p className="text-xs text-muted-foreground text-center">
          Point the camera at a CashFlow QR code
        </p>
      )}
    </div>
  );
}
