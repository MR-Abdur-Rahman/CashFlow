import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Camera, Image as ImageIcon, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { UserAvatar } from "./UserAvatar";
import { ImageCropDialog } from "./ImageCropDialog";
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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="relative" aria-label="Edit photo" disabled={busy}>
            <UserAvatar url={currentUrl} name={name} size={72} />
            <span className="absolute inset-0 grid place-items-center rounded-full bg-black/40 opacity-0 hover:opacity-100 transition-opacity text-white text-xs font-medium">
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Edit"}
            </span>
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
      <p className="text-xs text-muted-foreground">Tap to edit photo</p>
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
