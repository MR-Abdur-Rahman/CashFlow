import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Loader2, AlertTriangle } from "lucide-react";
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

// Two-step delete-PROFILE dialog. On open it checks account_deletion_blockers (conditions where the
// user is a dependency for OTHER people's data) and, if any, lists them instead of a confirm step.
// Otherwise: Step 1 warning → Step 2 password reauth → the delete-account Edge Function (which does the
// real, complete deletion via admin.deleteUser). No client-side profiles.delete(); the Edge Function
// re-checks the blockers server-side too.
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
  // null = still checking; [] = no blockers; [..] = reasons the user must resolve first.
  const [blockers, setBlockers] = useState<string[] | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep("confirm");
    setCurrent("");
    setErr(null);
    setBusy(false);
    setBlockers(null);
    (supabase as any)
      .rpc("account_deletion_blockers")
      .then(({ data }: { data: string[] | null }) => setBlockers(data ?? []))
      .catch(() => setBlockers([]));
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
      // Real, complete deletion happens in the Edge Function (auth user + cascade + storage).
      const { error } = await supabase.functions.invoke("delete-account");
      if (error) {
        let msg = "Couldn't delete your profile";
        try {
          const body = await (error as any).context?.json?.();
          if (Array.isArray(body?.blockers) && body.blockers.length) msg = body.blockers.join("\n");
          else if (body?.error) msg = body.error;
        } catch {
          /* keep the generic message */
        }
        setErr(msg);
        return;
      }
      await supabase.auth.signOut();
      onOpenChange(false);
      navigate("/auth");
    } catch (e: any) {
      setErr(e?.message ?? "Couldn't delete your profile");
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
          blockers === null ? (
            <>
              <DialogTitle>Delete your profile?</DialogTitle>
              <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Checking…
              </div>
            </>
          ) : blockers.length > 0 ? (
            <>
              <DialogTitle>Resolve these first</DialogTitle>
              <DialogDescription>
                Your profile can't be deleted yet — it's still linked to other people's data:
              </DialogDescription>
              <ul className="mt-1 space-y-2">
                {blockers.map((b, i) => (
                  <li key={i} className="flex gap-2 text-sm text-foreground">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-expense mt-0.5" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex justify-end">
                <Button variant="ghost" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
              </div>
            </>
          ) : (
            <>
              <DialogTitle>Delete your profile?</DialogTitle>
              <DialogDescription>
                This permanently deletes your profile and all your data. This cannot be undone.
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
          )
        ) : (
          <>
            <DialogTitle>Confirm your password</DialogTitle>
            <DialogDescription>Enter your password to permanently delete your profile.</DialogDescription>
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
              {err && <p className="whitespace-pre-line text-xs text-expense">{err}</p>}
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
                {busy ? "Deleting…" : "Delete profile"}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
