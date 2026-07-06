import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { profileQuery } from "@/lib/queries";
import { UserAvatar } from "@/components/UserAvatar";
import { ImageCropDialog } from "@/components/ImageCropDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Camera, Image as ImageIcon, Trash2, Loader2, User, Phone, Mail } from "lucide-react";
import { SettingsHeader } from "@/components/SettingsRows";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";

export default function AccountPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | undefined>();
  const [email, setEmail] = useState<string | undefined>();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id);
      setEmail(data.user?.email ?? undefined);
    });
  }, []);

  const { data: profile } = useQuery(profileQuery(userId));
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [editing, setEditing] = useState<"name" | "phone" | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setPhone(profile.phone_number ?? "");
    }
  }, [profile]);

  const save = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Not signed in");
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName, phone_number: phone || null })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e) => toast.error(e.message),
  });

  function pickPhoto(f: File) {
    if (f.size > 5 * 1024 * 1024) return toast.error("Image must be under 5MB");
    setCropFile(f);
    setCropOpen(true);
  }

  async function uploadPhoto(blob: Blob) {
    if (!userId) return;
    setBusy(true);
    try {
      const path = `${userId}/avatar-${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, blob, { upsert: true, contentType: "image/jpeg" });
      if (upErr) throw upErr;
      const publicUrl = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", userId);
      if (error) throw error;
      toast.success("Photo updated");
      qc.invalidateQueries({ queryKey: ["profile"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function removePhoto() {
    if (!userId) return;
    setBusy(true);
    try {
      const { data: files } = await supabase.storage.from("avatars").list(userId);
      if (files?.length)
        await supabase.storage.from("avatars").remove(files.map((f) => `${userId}/${f.name}`));
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: null })
        .eq("id", userId);
      if (error) throw error;
      toast.success("Photo removed");
      qc.invalidateQueries({ queryKey: ["profile"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount() {
    if (!userId) return;
    if (deleteConfirm !== "DELETE") return toast.error("Type DELETE to confirm");
    const { data: blocked } = await supabase.rpc("has_unsettled_splits", { _user_id: userId });
    if (blocked) return toast.error("Settle all splits before deleting your account");
    const { error } = await supabase.from("profiles").delete().eq("id", userId);
    if (error) return toast.error(error.message);
    await supabase.auth.signOut();
    navigate("/auth");
  }

  return (
    <div className="px-4 pt-4 pb-24 space-y-6">
      <SettingsHeader title="Account" />

      <div className="flex flex-col items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="relative" aria-label="Edit photo" disabled={busy}>
              <UserAvatar url={profile?.avatar_url} name={fullName || email} size={120} />
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
            {profile?.avatar_url && (
              <DropdownMenuItem className="text-expense" onClick={removePhoto}>
                <Trash2 className="h-4 w-4 mr-2" /> Remove
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="user"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) pickPhoto(f);
          }}
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) pickPhoto(f);
          }}
        />
        <p className="text-xs text-muted-foreground">Tap to edit photo</p>
      </div>

      <ImageCropDialog
        file={cropFile}
        open={cropOpen}
        onOpenChange={setCropOpen}
        onCropped={uploadPhoto}
      />

      {/* Icon-led data rows (WhatsApp style). Tap a value to edit it inline. */}
      <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden shadow-sm">
        <div className="flex items-center gap-4 px-4 py-3">
          <User className="h-6 w-6 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">Full name</p>
            {editing === "name" ? (
              <input
                autoFocus
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                onBlur={() => setEditing(null)}
                className="w-full bg-transparent text-base text-foreground outline-none mt-0.5"
              />
            ) : (
              <button
                type="button"
                onClick={() => setEditing("name")}
                className="w-full text-left text-base text-foreground mt-0.5 truncate"
              >
                {fullName || <span className="text-muted-foreground">Add your name</span>}
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 px-4 py-3">
          <Phone className="h-6 w-6 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">Phone number</p>
            {editing === "phone" ? (
              <input
                autoFocus
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onBlur={() => setEditing(null)}
                placeholder="+94..."
                className="w-full bg-transparent text-base text-foreground outline-none mt-0.5 placeholder:text-muted-foreground"
              />
            ) : (
              <button
                type="button"
                onClick={() => setEditing("phone")}
                className="w-full text-left text-base text-foreground mt-0.5 truncate"
              >
                {phone || <span className="text-muted-foreground">Add a phone number</span>}
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 px-4 py-3">
          <Mail className="h-6 w-6 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">Google account</p>
            <p className="text-base text-foreground mt-0.5 truncate">
              {profile?.google_email ?? email ?? "—"}
            </p>
          </div>
        </div>
      </div>

      <Button className="w-full" onClick={() => save.mutate()} disabled={save.isPending}>
        Save changes
      </Button>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button
            type="button"
            className="mx-auto flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-expense active:bg-secondary/40"
          >
            <Trash2 className="h-4 w-4" /> Delete account
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes all your data. Type DELETE to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder="DELETE"
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirm("")}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteAccount} disabled={deleteConfirm !== "DELETE"}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
