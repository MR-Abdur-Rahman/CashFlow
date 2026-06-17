import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Camera, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { UserAvatar } from "./UserAvatar";
import { useQueryClient } from "@tanstack/react-query";

export function AvatarUpload({
  userId,
  currentUrl,
  name,
}: {
  userId: string | undefined;
  currentUrl?: string | null;
  name?: string | null;
}) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function urlForPath(path: string) {
    // Bucket is private — use a signed URL valid for 1 year.
    const { data } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60 * 24 * 365);
    return data?.signedUrl ?? null;
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !userId) return;
    if (file.size > 5 * 1024 * 1024) return toast.error("Image must be under 5MB");
    setBusy(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${userId}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const signed = await urlForPath(path);
      const { error: profErr } = await supabase
        .from("profiles")
        .update({ avatar_url: signed })
        .eq("id", userId);
      if (profErr) throw profErr;
      toast.success("Profile photo updated");
      qc.invalidateQueries({ queryKey: ["profile"] });
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function onRemove() {
    if (!userId) return;
    setBusy(true);
    try {
      // Clean up everything under this user's folder.
      const { data: files } = await supabase.storage.from("avatars").list(userId);
      if (files?.length) {
        await supabase.storage.from("avatars").remove(files.map((f) => `${userId}/${f.name}`));
      }
      const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", userId);
      if (error) throw error;
      toast.success("Profile photo removed");
      qc.invalidateQueries({ queryKey: ["profile"] });
    } catch (err: any) {
      toast.error(err.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <UserAvatar url={currentUrl} name={name} size={72} />
      <div className="flex flex-col gap-2">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPick} />
        <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Camera className="h-4 w-4 mr-2" />}
          {currentUrl ? "Change photo" : "Upload photo"}
        </Button>
        {currentUrl && (
          <Button type="button" size="sm" variant="ghost" className="text-expense" disabled={busy} onClick={onRemove}>
            <Trash2 className="h-4 w-4 mr-2" /> Remove
          </Button>
        )}
      </div>
    </div>
  );
}
