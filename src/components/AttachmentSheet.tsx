import { useRef, useState } from "react";
import { Camera, FileText, ImageIcon, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  canUseNativeCamera,
  canUseNativeFilePicker,
  getCurrentLocation,
  makePending,
  pickDocumentNative,
  pickImageNative,
  type Coords,
  type PendingAttachment,
} from "@/lib/attachments";

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : "";
}

type OptionKey = "gallery" | "camera" | "document" | "location";

// Module-level so the render pass never walks handlers that touch the hidden-input refs
// (react-hooks/refs flags ref access reached from render).
const OPTIONS: { key: OptionKey; label: string; icon: typeof Camera }[] = [
  { key: "gallery", label: "Gallery", icon: ImageIcon },
  { key: "camera", label: "Camera", icon: Camera },
  { key: "document", label: "Document", icon: FileText },
  { key: "location", label: "Location", icon: MapPin },
];

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onAttach: (a: PendingAttachment) => void;
  onLocation: (c: Coords) => void;
};

// The four attach options behind the paperclip next to Note. Each native picker degrades to a
// browser file input when the plugin isn't there — which covers both the web app and an installed
// APK built before these plugins were added (the native shell loads the web bundle remotely, so JS
// can ship ahead of the native build).
export function AttachmentSheet({ open, onOpenChange, onAttach, onLocation }: Props) {
  const [locating, setLocating] = useState(false);
  const galleryInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const docInput = useRef<HTMLInputElement>(null);

  function handleWebFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Clear so re-picking the same file fires change again (same reason AvatarUpload does it).
    e.target.value = "";
    if (!file) return;
    const type = file.type.startsWith("image/") ? "image" : "document";
    onAttach(makePending(file, file.name, type));
    onOpenChange(false);
  }

  async function pickImage(from: "camera" | "gallery") {
    if (!canUseNativeCamera()) {
      (from === "camera" ? cameraInput : galleryInput).current?.click();
      return;
    }
    try {
      const a = await pickImageNative(from);
      if (a) {
        onAttach(a);
        onOpenChange(false);
      }
    } catch (err) {
      // User-cancelled shows up as a thrown error too; don't nag them about it.
      const msg = messageOf(err);
      if (!/cancel/i.test(msg)) toast.error(msg || "Couldn't open the camera.");
    }
  }

  async function pickDocument() {
    if (!canUseNativeFilePicker()) {
      docInput.current?.click();
      return;
    }
    try {
      const a = await pickDocumentNative();
      if (a) {
        onAttach(a);
        onOpenChange(false);
      }
    } catch (err) {
      const msg = messageOf(err);
      if (!/cancel/i.test(msg)) toast.error(msg || "Couldn't open files.");
    }
  }

  async function attachLocation() {
    setLocating(true);
    try {
      onLocation(await getCurrentLocation());
      onOpenChange(false);
    } catch (err) {
      toast.error(messageOf(err) || "Couldn't get your location.");
    } finally {
      setLocating(false);
    }
  }

  function handleSelect(key: OptionKey) {
    if (key === "gallery") return pickImage("gallery");
    if (key === "camera") return pickImage("camera");
    if (key === "document") return pickDocument();
    return attachLocation();
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="flex flex-col">
          <SheetHeader>
            <SheetTitle>Attach</SheetTitle>
          </SheetHeader>
          {/* -mx-6 cancels SheetContent's p-6 so rows run edge-to-edge, matching settings-preferences */}
          <div className="mt-3 -mx-6 pb-2">
            {OPTIONS.map((o) => {
              const busy = o.key === "location" && locating;
              return (
                <button
                  key={o.key}
                  type="button"
                  disabled={busy}
                  onClick={() => handleSelect(o.key)}
                  className={cn(
                    "flex w-full items-center gap-3 px-6 py-3",
                    busy ? "opacity-60" : "active:bg-secondary/40",
                  )}
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary">
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <o.icon className="h-4 w-4" />
                    )}
                  </span>
                  <span className="flex-1 text-left text-sm">{o.label}</span>
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>

      {/* Web / older-APK fallbacks. capture="environment" points at the rear camera for receipts. */}
      <input
        ref={galleryInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleWebFile}
      />
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleWebFile}
      />
      <input
        ref={docInput}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleWebFile}
      />
    </>
  );
}
