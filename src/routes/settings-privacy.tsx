import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { SettingsHeader } from "@/components/SettingsRows";
import { PhoneVisibilitySettings } from "@/components/PhoneVisibilitySettings";
import { ProfileVisibilitySettings } from "@/components/ProfileVisibilitySettings";
import { cn } from "@/lib/utils";

export default function PrivacyPage() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | undefined>();
  const [email, setEmail] = useState<string | undefined>();
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id);
      setEmail(data.user?.email ?? undefined);
    });
  }, []);

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
    <div className="px-4 pt-6 pb-24 space-y-6">
      <SettingsHeader title="Privacy" />

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-muted-foreground px-1">Profile</p>
        <ProfileVisibilitySettings userId={userId} />
      </div>

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-muted-foreground px-1">Phone number</p>
        <PhoneVisibilitySettings userId={userId} />
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div>
          <p className="text-sm font-medium">Delete account</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Permanently delete your account and all your data. You'll verify with a code first.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDelStep("confirm")}
          className="flex items-center gap-2 rounded-lg border border-expense/40 px-4 py-2 text-sm font-medium text-expense active:bg-secondary/40"
        >
          <Trash2 className="h-4 w-4" /> Delete account
        </button>
      </div>

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
