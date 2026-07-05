import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { profileQuery } from "@/lib/queries";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ChevronLeft, Camera, Image as ImageIcon, Trash2, Loader2 } from "lucide-react";
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

export default function ProfileEditPage() {
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
  const [deleteConfirm, setDeleteConfirm] = useState("");
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

  async function uploadPhoto(file: File) {
    if (!userId) return;
    if (file.size > 5 * 1024 * 1024) return toast.error("Image must be under 5MB");
    setBusy(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${userId}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data } = await supabase.storage
        .from("avatars")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: data?.signedUrl ?? null })
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
      <button
        onClick={() => navigate("/settings")}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground -ml-1"
      >
        <ChevronLeft className="h-4 w-4" /> Back
      </button>

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
            if (f) uploadPhoto(f);
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
            if (f) uploadPhoto(f);
          }}
        />
        <p className="text-xs text-muted-foreground">Tap to edit photo</p>
      </div>

      <div className="surface-card p-4 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone number</Label>
          <Input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+94..."
          />
        </div>
        <div className="space-y-1.5">
          <Label>Google account</Label>
          <p className="text-sm text-muted-foreground">{profile?.google_email ?? email ?? "—"}</p>
        </div>
        <Button className="w-full" onClick={() => save.mutate()} disabled={save.isPending}>
          Save changes
        </Button>
      </div>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" className="w-full text-expense">
            <Trash2 className="h-4 w-4 mr-2" /> Delete account
          </Button>
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
