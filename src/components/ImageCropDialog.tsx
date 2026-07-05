import { useCallback, useEffect, useState } from "react";
import Cropper from "react-easy-crop";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Area = { x: number; y: number; width: number; height: number };

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", (e) => reject(e));
    img.src = url;
  });
}

// Square-crop the chosen region to a JPEG blob.
async function getCroppedBlob(imageSrc: string, crop: Area): Promise<Blob> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const size = Math.max(1, Math.round(crop.width));
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, size, size);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Crop failed"))), "image/jpeg", 0.9),
  );
}

// Square photo cropper (drag to move, slider to zoom). Returns the cropped JPEG blob.
export function ImageCropDialog({
  file,
  open,
  onOpenChange,
  onCropped,
}: {
  file: File | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCropped: (blob: Blob) => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (file && open) {
      const url = URL.createObjectURL(file);
      setSrc(url);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      return () => URL.revokeObjectURL(url);
    }
    setSrc(null);
  }, [file, open]);

  const onComplete = useCallback((_: Area, pixels: Area) => setArea(pixels), []);

  async function save() {
    if (!src || !area) return;
    setBusy(true);
    try {
      const blob = await getCroppedBlob(src, area);
      onCropped(blob);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Crop photo</DialogTitle>
        <div className="relative w-full h-72 bg-black rounded-lg overflow-hidden">
          {src && (
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onComplete}
            />
          )}
        </div>
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="w-full mt-3"
          aria-label="Zoom"
        />
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy || !area}>
            {busy ? "Saving..." : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
