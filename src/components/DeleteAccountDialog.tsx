import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { sendPasswordReset } from "@/lib/passwordReset";

// Same show/hide password input used by ChangePasswordDialog.
function PwInput({
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoComplete: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full rounded-lg border border-border bg-card py-2.5 px-3 pr-10 text-sm text-foreground outline-none focus:border-primary placeholder:text-muted-foreground"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

// Two-step delete-account dialog (mirrors ChangePasswordDialog's sizing/style). Step 1: a warning +
// Cancel/Continue. Step 2: verify the current password (real reauth via signInWithPassword) before
// deleting. Deletion is a plain profiles row delete — the on_profile_delete cascade handles the rest
// (keeps other users' saved contact name, unlinks, notifies them). No email OTP, no unsettled-split gate.
export function DeleteAccountDialog({
  open,
  onOpenChange,
  email,
  userId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  email?: string;
  userId?: string;
}) {
  const navigate = useNavigate();
  const [step, setStep] = useState<"confirm" | "password">("confirm");
  const [current, setCurrent] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetSending, setResetSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep("confirm");
    setCurrent("");
    setErr(null);
    setBusy(false);
  }, [open]);

  async function confirmDelete() {
    if (!email || !userId) return setErr("No account found");
    if (!current) return;
    setBusy(true);
    setErr(null);
    try {
      // Verify this is genuinely their password (Supabase can't check it for a live session).
      const { error: signErr } = await supabase.auth.signInWithPassword({ email, password: current });
      if (signErr) {
        setErr("Current password is incorrect");
        return;
      }
      // Delete the profile — the BEFORE DELETE cascade trigger does the rest.
      const { error } = await supabase.from("profiles").delete().eq("id", userId);
      if (error) throw error;
      await supabase.auth.signOut();
      onOpenChange(false);
      navigate("/auth");
    } catch (e: any) {
      const m = e?.message ?? "Couldn't delete account";
      setErr(m);
      toast.error(m);
    } finally {
      setBusy(false);
    }
  }

  // Fallback — same email-reset flow as Change Password.
  async function forgot() {
    if (!email) return setErr("No email on this account");
    setResetSending(true);
    try {
      await sendPasswordReset(email);
      toast.success("Reset link sent — check your email");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't send reset email");
    } finally {
      setResetSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs">
        {step === "confirm" ? (
          <>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              This permanently deletes your account and all your data. This cannot be undone.
            </DialogDescription>
            <div className="mt-2 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                className="bg-expense hover:bg-expense/90"
                onClick={() => {
                  setErr(null);
                  setStep("password");
                }}
              >
                Continue
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogTitle>Confirm your password</DialogTitle>
            <DialogDescription>Enter your password to permanently delete your account.</DialogDescription>
            <div className="mt-1 space-y-2">
              <PwInput
                value={current}
                onChange={(v) => {
                  setCurrent(v);
                  setErr(null);
                }}
                placeholder="Current password"
                autoComplete="current-password"
              />
              {err && <p className="text-xs text-expense">{err}</p>}
              <div className="text-right">
                <button
                  type="button"
                  onClick={forgot}
                  disabled={resetSending}
                  className="text-xs font-medium disabled:opacity-60"
                  style={{ color: "#7C3AED" }}
                >
                  {resetSending ? "Sending…" : "Forgot Password?"}
                </button>
              </div>
            </div>
            <div className="mt-1 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                className="bg-expense hover:bg-expense/90"
                disabled={!current || busy}
                onClick={confirmDelete}
              >
                {busy ? "Deleting…" : "Delete account"}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
