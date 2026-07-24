import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { sendPasswordReset } from "@/lib/passwordReset";

// Strong-password format: 8+ chars, at least one uppercase, one number, one symbol. Used ONLY to
// enable buttons (a format gate) — it is NOT a correctness check of the real password.
const isStrong = (pw: string) =>
  pw.length >= 8 && /[A-Z]/.test(pw) && /[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw);

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

// Two-step change-password dialog. Step 1: verify the current password (format-gated Continue, then a
// real reauth check). Step 2: set + confirm the new password. Sized like the Delete-account dialog.
export function ChangePasswordDialog({
  open,
  onOpenChange,
  email,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  email?: string;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetSending, setResetSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Reset everything whenever the dialog opens.
  useEffect(() => {
    if (!open) return;
    setStep(1);
    setCurrent("");
    setNext("");
    setConfirm("");
    setErr(null);
    setChecking(false);
    setSaving(false);
  }, [open]);

  // Continue: the real reauth check (Continue is already format-gated by isStrong(current)).
  async function verifyCurrent() {
    if (!email) return setErr("No email on this account");
    if (!isStrong(current)) return;
    setChecking(true);
    setErr(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password: current });
      if (error) {
        setErr("Current password is incorrect");
        return;
      }
      setStep(2);
    } catch (e: any) {
      setErr(e?.message ?? "Something went wrong");
    } finally {
      setChecking(false);
    }
  }

  const step2Valid = isStrong(next) && next === confirm;

  async function save() {
    if (!step2Valid) return;
    setSaving(true);
    setErr(null);
    try {
      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) throw error;
      toast.success("Password updated");
      onOpenChange(false);
    } catch (e: any) {
      const m = e?.message ?? "Couldn't update password";
      setErr(m);
      toast.error(m);
    } finally {
      setSaving(false);
    }
  }

  // Fallback — same email-reset flow as login.
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
        {step === 1 ? (
          <>
            <DialogTitle>Change password</DialogTitle>
            <DialogDescription>Enter your current password to continue.</DialogDescription>
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
            <Button
              className="mt-1 w-full"
              disabled={!isStrong(current) || checking}
              onClick={verifyCurrent}
            >
              {checking ? "Checking…" : "Continue"}
            </Button>
          </>
        ) : (
          <>
            <DialogTitle>Set new password</DialogTitle>
            <DialogDescription>
              At least 8 characters with an uppercase letter, a number and a symbol.
            </DialogDescription>
            <div className="mt-1 space-y-2">
              <PwInput
                value={next}
                onChange={setNext}
                placeholder="New password"
                autoComplete="new-password"
              />
              <PwInput
                value={confirm}
                onChange={setConfirm}
                placeholder="Confirm new password"
                autoComplete="new-password"
              />
              {confirm.length > 0 && next !== confirm && (
                <p className="text-xs text-expense">Passwords don't match.</p>
              )}
              {err && <p className="text-xs text-expense">{err}</p>}
            </div>
            <Button className="mt-1 w-full" disabled={!step2Valid || saving} onClick={save}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
