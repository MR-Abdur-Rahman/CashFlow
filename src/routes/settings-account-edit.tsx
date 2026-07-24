import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { profileQuery, myPhoneQuery } from "@/lib/queries";
import { UserAvatar } from "@/components/UserAvatar";
import { ImageCropDialog } from "@/components/ImageCropDialog";
import { PhotoPreviewDialog } from "@/components/PhotoPreviewDialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Camera,
  Image as ImageIcon,
  Trash2,
  Loader2,
  User,
  Phone,
  Mail,
  AtSign,
  Check,
  X,
} from "lucide-react";
import { SettingsHeader } from "@/components/SettingsRows";
import {
  usernameAvailable,
  usernameFormatError,
  setUsername as setUsernameRpc,
} from "@/lib/connections";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function AccountEditPage() {
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
  const { data: myPhone } = useQuery(myPhoneQuery());
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [username, setUsername] = useState("");
  const [uStatus, setUStatus] = useState<
    "idle" | "checking" | "available" | "taken" | "invalid"
  >("idle");
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setUsername((profile as any).username ?? "");
    }
  }, [profile]);
  useEffect(() => {
    if (myPhone !== undefined) setPhone(myPhone ?? "");
  }, [myPhone]);
  const google = profile?.google_email ?? email ?? "—";

  // Username: only writable here. Availability is checked (debounced) when it differs from current.
  const currentUsername = ((profile as any)?.username ?? "") as string;
  const normUser = username.trim().toLowerCase();
  const usernameUnchanged = normUser === currentUsername;
  const uFormatErr = usernameFormatError(normUser);
  useEffect(() => {
    if (!normUser || usernameUnchanged) {
      setUStatus("idle");
      return;
    }
    if (uFormatErr) {
      setUStatus("invalid");
      return;
    }
    setUStatus("checking");
    const h = setTimeout(async () => {
      try {
        setUStatus((await usernameAvailable(normUser)) ? "available" : "taken");
      } catch {
        setUStatus("idle");
      }
    }, 350);
    return () => clearTimeout(h);
  }, [normUser, usernameUnchanged, uFormatErr]);
  // Block Save when the entered username changed but isn't confirmed available.
  const usernameBlocked = !usernameUnchanged && uStatus !== "available";

  const [busy, setBusy] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const save = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Not signed in");
      // Username first (unique, validated server-side) — aborts before other edits if taken.
      if (!usernameUnchanged) await setUsernameRpc(normUser);
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName, phone_number: phone || null })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["my-phone"] });
      navigate("/settings/account");
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

  return (
    <div className="px-4 pt-4 pb-24 space-y-6">
      <SettingsHeader title="Edit profile" />

      {/* Avatar: tap → preview; camera badge → edit menu */}
      <div className="flex flex-col items-center">
        <div className="relative">
          <button
            type="button"
            aria-label="View photo"
            disabled={busy}
            onClick={() => (profile?.avatar_url ? setPreviewOpen(true) : setMenuOpen(true))}
          >
            <UserAvatar url={profile?.avatar_url} name={fullName || email} size={120} />
          </button>
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Edit photo"
                disabled={busy}
                className="absolute bottom-1 right-1 h-9 w-9 rounded-full grid place-items-center border-2 border-background text-white"
                style={{ background: "#7C3AED" }}
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
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
        </div>
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
      </div>

      <PhotoPreviewDialog
        url={profile?.avatar_url}
        name={fullName || email || "You"}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
      />
      <ImageCropDialog
        file={cropFile}
        open={cropOpen}
        onOpenChange={setCropOpen}
        onCropped={uploadPhoto}
      />

      {/* Editable rows (Google is read-only) */}
      <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden shadow-sm">
        <div className="flex items-center gap-4 px-4 py-3">
          <User className="h-6 w-6 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">Full name</p>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Add your name"
              className="w-full bg-transparent text-base text-foreground outline-none mt-0.5 placeholder:text-muted-foreground"
            />
          </div>
        </div>
        <div className="flex items-center gap-4 px-4 py-3">
          <AtSign className="h-6 w-6 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">Username</p>
            <div className="flex items-center gap-2">
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Set a username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="w-full bg-transparent text-base text-foreground outline-none mt-0.5 placeholder:text-muted-foreground"
              />
              <span className="shrink-0">
                {uStatus === "checking" && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
                {uStatus === "available" && <Check className="h-4 w-4 text-income" />}
                {(uStatus === "taken" || uStatus === "invalid") && (
                  <X className="h-4 w-4 text-expense" />
                )}
              </span>
            </div>
            {uStatus === "invalid" && uFormatErr && (
              <p className="mt-0.5 text-xs text-expense">{uFormatErr}</p>
            )}
            {uStatus === "taken" && (
              <p className="mt-0.5 text-xs text-expense">That username is taken.</p>
            )}
            {uStatus === "available" && <p className="mt-0.5 text-xs text-income">Available.</p>}
          </div>
        </div>
        <div className="flex items-center gap-4 px-4 py-3">
          <Phone className="h-6 w-6 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">Phone number</p>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+94..."
              className="w-full bg-transparent text-base text-foreground outline-none mt-0.5 placeholder:text-muted-foreground"
            />
          </div>
        </div>
        <div className="flex items-center gap-4 px-4 py-3">
          <Mail className="h-6 w-6 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">Google account</p>
            <p className="text-base text-foreground mt-0.5 truncate">{google}</p>
          </div>
        </div>
      </div>

      <Button
        className="w-full"
        onClick={() => save.mutate()}
        disabled={save.isPending || usernameBlocked}
      >
        Save
      </Button>
    </div>
  );
}
