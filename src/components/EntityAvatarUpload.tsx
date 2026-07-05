import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Camera, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { UserAvatar } from "./UserAvatar";
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
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function signedUrl(path: string) {
    const { data } = await supabase.storage
      .from("avatars")
      .createSignedUrl(path, 60 * 60 * 24 * 365);
    return data?.signedUrl ?? null;
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error("Image must be under 5MB");
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    setBusy(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${u.user.id}/${folder}/${id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
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
    <div className="flex items-center gap-4">
      <UserAvatar url={currentUrl} name={name} size={64} />
      <div className="flex flex-col gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*,image/heic,image/heif"
          className="hidden"
          onChange={onPick}
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Camera className="h-4 w-4 mr-2" />
          )}
          {currentUrl ? "Change photo" : "Upload photo"}
        </Button>
        {currentUrl && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-expense"
            disabled={busy}
            onClick={onRemove}
          >
            <Trash2 className="h-4 w-4 mr-2" /> Remove
          </Button>
        )}
      </div>
    </div>
  );
}
