import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { profileQuery } from "@/lib/queries";
import { UserAvatar } from "@/components/UserAvatar";
import { ImageCropDialog } from "@/components/ImageCropDialog";
import { PhotoPreviewDialog } from "@/components/PhotoPreviewDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Camera,
  Image as ImageIcon,
  Trash2,
  Loader2,
  User,
  Phone,
  Mail,
  Pencil,
} from "lucide-react";
import { SettingsHeader } from "@/components/SettingsRows";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

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
  const fullName = profile?.full_name ?? "";
  const phone = profile?.phone_number ?? "";
  const google = profile?.google_email ?? email ?? "—";

  const [busy, setBusy] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  // ── Photo upload (public URL, crop) ─────────────────────────────────────────
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

  // ── Delete account (verify via emailed code, then delete) ────────────────────
  const [delStep, setDelStep] = useState<"confirm" | "method" | "code" | null>(null);
  const [delMethod, setDelMethod] = useState<"email" | "phone">("email");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);

  async function onContinueDelete() {
    if (!userId) return;
    const { data: blocked } = await supabase.rpc("has_unsettled_splits", { _user_id: userId });
    if (blocked) return toast.error("Settle all splits before deleting your account");
    setDelStep("method");
  }
  async function sendCode() {
    if (delMethod === "phone")
      return toast.message("Phone verification is coming soon — use Email.");
    if (!email) return toast.error("No email on this account");
    setSending(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });
      if (error) throw error;
      toast.success("Code sent to your email");
      setCode("");
      setDelStep("code");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  }
  async function verifyAndDelete() {
    if (!email || !userId) return;
    setSending(true);
    try {
      const { error: vErr } = await supabase.auth.verifyOtp({
        email,
        token: code.trim(),
        type: "email",
      });
      if (vErr) throw new Error("Invalid or expired code");
      const { error } = await supabase.from("profiles").delete().eq("id", userId);
      if (error) throw error;
      await supabase.auth.signOut();
      navigate("/auth");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="px-4 pt-4 pb-24 space-y-6">
      {/* Header with Edit button top-right */}
      <div className="flex items-center justify-between">
        <SettingsHeader title="Account" />
        <Link
          to="/settings/account/edit"
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-primary active:bg-secondary/40"
        >
          <Pencil className="h-4 w-4" /> Edit
        </Link>
      </div>

      {/* Avatar: tap image → preview; camera badge → edit menu */}
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

      {/* Read-only info rows (edit via the Edit button) */}
      <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden shadow-sm">
        {[
          { icon: User, label: "Full name", value: fullName || "Add your name" },
          { icon: Phone, label: "Phone number", value: phone || "Add a phone number" },
          { icon: Mail, label: "Google account", value: google },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-center gap-4 px-4 py-3">
            <Icon className="h-6 w-6 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-base text-foreground mt-0.5 truncate">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Delete account — small, opens the verify-code flow */}
      <button
        type="button"
        onClick={() => setDelStep("confirm")}
        className="mx-auto flex items-center gap-2 rounded-lg border border-expense/40 px-4 py-2 text-sm font-medium text-expense active:bg-secondary/40"
      >
        <Trash2 className="h-4 w-4" /> Delete account
      </button>

      {/* Delete flow: confirm → method → code */}
      <Dialog open={delStep !== null} onOpenChange={(o) => !o && setDelStep(null)}>
        <DialogContent className="max-w-xs">
          {delStep === "confirm" && (
            <>
              <DialogTitle>Delete your account?</DialogTitle>
              <DialogDescription>
                This permanently deletes all your data. You'll verify with a code first.
              </DialogDescription>
              <div className="flex justify-end gap-2 mt-2">
                <Button variant="ghost" onClick={() => setDelStep(null)}>
                  Cancel
                </Button>
                <Button onClick={onContinueDelete}>Continue</Button>
              </div>
            </>
          )}
          {delStep === "method" && (
            <>
              <DialogTitle>Send a verification code</DialogTitle>
              <DialogDescription>Choose where to receive your code.</DialogDescription>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setDelMethod("email")}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium",
                    delMethod === "email"
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground",
                  )}
                >
                  <Mail className="h-4 w-4" /> Email
                </button>
                <button
                  type="button"
                  onClick={() => toast.message("Phone verification is coming soon")}
                  className="flex items-center justify-center gap-2 rounded-lg border border-border py-2.5 text-sm font-medium text-muted-foreground opacity-60"
                >
                  <Phone className="h-4 w-4" /> Phone
                </button>
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <Button variant="ghost" onClick={() => setDelStep(null)}>
                  Cancel
                </Button>
                <Button onClick={sendCode} disabled={sending}>
                  {sending ? "Sending…" : "Send code"}
                </Button>
              </div>
            </>
          )}
          {delStep === "code" && (
            <>
              <DialogTitle>Enter your code</DialogTitle>
              <DialogDescription>
                We sent a code to {email}. Enter it to permanently delete your account.
              </DialogDescription>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Code"
                inputMode="numeric"
                autoFocus
              />
              <div className="flex justify-end gap-2 mt-2">
                <Button variant="ghost" onClick={sendCode} disabled={sending}>
                  Resend
                </Button>
                <Button
                  className="bg-expense hover:bg-expense/90"
                  onClick={verifyAndDelete}
                  disabled={sending || !code.trim()}
                >
                  {sending ? "Deleting…" : "Delete account"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
