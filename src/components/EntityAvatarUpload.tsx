import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Camera, Image as ImageIcon, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { UserAvatar } from "./UserAvatar";
import { ImageCropDialog } from "./ImageCropDialog";
import { PhotoPreviewDialog } from "./PhotoPreviewDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQueryClient } from "@tanstack/react-query";

// Picture upload/remove for a `people` or `groups` row. Stores into the shared private `avatars`
// bucket under `${uid}/<folder>/...` (the folder policy already allows the owner's paths) and saves
// the signed URL to <table>.avatar_url. Mirrors the profile AvatarUpload, reused for both.
export function EntityAvatarUpload({
  table,
  id,
  folder,
  currentUrl,
  name,
  invalidateKey,
}: {
  table: "people" | "groups";
  id: string;
  folder: "people" | "groups";
  currentUrl?: string | null;
  name?: string | null;
  invalidateKey: string[];
}) {
  const qc = useQueryClient();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  async function signedUrl(path: string) {
    // Public bucket — plain public URL (never expires, loads for every viewer).
    return supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error("Image must be under 5MB");
    setCropFile(file);
    setCropOpen(true);
  }

  async function onCropped(blob: Blob) {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    setBusy(true);
    try {
      const path = `${u.user.id}/${folder}/${id}-${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, blob, { upsert: true, contentType: "image/jpeg" });
      if (upErr) throw upErr;
      const url = await signedUrl(path);
      const { error } = await (supabase.from(table) as any)
        .update({ avatar_url: url })
        .eq("id", id);
      if (error) throw error;
      toast.success("Photo updated");
      qc.invalidateQueries({ queryKey: invalidateKey });
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function onRemove() {
    setBusy(true);
    try {
      const { error } = await (supabase.from(table) as any)
        .update({ avatar_url: null })
        .eq("id", id);
      if (error) throw error;
      toast.success("Photo removed");
      qc.invalidateQueries({ queryKey: invalidateKey });
    } catch (err: any) {
      toast.error(err.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        {/* Tap avatar → preview (or the edit menu if there's no photo yet) */}
        <button
          type="button"
          aria-label="View photo"
          disabled={busy}
          onClick={() => (currentUrl ? setPreviewOpen(true) : setMenuOpen(true))}
        >
          <UserAvatar url={currentUrl} name={name} size={72} />
        </button>
        {/* Camera badge → edit menu */}
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Edit photo"
              disabled={busy}
              className="absolute -bottom-0.5 -right-0.5 h-8 w-8 rounded-full grid place-items-center border-2 border-background text-white"
              style={{ background: "#7C3AED" }}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center">
            <DropdownMenuItem onClick={() => cameraRef.current?.click()}>
              <Camera className="h-4 w-4 mr-2" /> Camera
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => galleryRef.current?.click()}>
              <ImageIcon className="h-4 w-4 mr-2" /> Gallery
            </DropdownMenuItem>
            {currentUrl && (
              <DropdownMenuItem className="text-expense" onClick={onRemove}>
                <Trash2 className="h-4 w-4 mr-2" /> Remove
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <PhotoPreviewDialog
        url={currentUrl}
        name={name}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={onPick}
      />
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={onPick} />
      <ImageCropDialog
        file={cropFile}
        open={cropOpen}
        onOpenChange={setCropOpen}
        onCropped={onCropped}
      />
    </div>
  );
}
