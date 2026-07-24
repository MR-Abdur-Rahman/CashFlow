import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { SettingsHeader } from "@/components/SettingsRows";
import { Button } from "@/components/ui/button";
import { sendPasswordReset } from "@/lib/passwordReset";

// A labelled password input with its own show/hide toggle.
function PwField({
  label,
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className="w-full rounded-lg border border-border bg-card py-2.5 px-3 pr-10 text-sm text-foreground outline-none focus:border-primary"
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
    </div>
  );
}

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string>();
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? undefined));
  }, []);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [resetSending, setResetSending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return toast.error("No email on this account");
    if (!current) return toast.error("Enter your current password");
    if (next.length < 6) return toast.error("New password must be at least 6 characters");
    if (next !== confirm) return toast.error("New passwords don't match");
    if (next === current) return toast.error("New password must be different from the current one");
    setSaving(true);
    try {
      // Supabase can't verify the current password for a live session, so re-authenticate with it.
      // Success = correct (refreshes the same user's session); error = wrong password.
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email,
        password: current,
      });
      if (signErr) {
        toast.error("Current password is incorrect");
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) throw error;
      toast.success("Password updated");
      navigate("/settings/privacy");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update password");
    } finally {
      setSaving(false);
    }
  }

  // Fallback for users who don't remember their current password — same email-reset flow as login.
  async function handleForgot() {
    if (!email) return toast.error("No email on this account");
    setResetSending(true);
    try {
      await sendPasswordReset(email);
      toast.success("Reset link sent — check your email");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send reset email");
    } finally {
      setResetSending(false);
    }
  }

  return (
    <div className="px-4 pt-6 pb-24 space-y-5">
      <SettingsHeader title="Change password" back="/settings/privacy" />

      <form onSubmit={handleSubmit} className="space-y-4">
        <PwField
          label="Current password"
          value={current}
          onChange={setCurrent}
          autoComplete="current-password"
        />
        <PwField
          label="New password"
          value={next}
          onChange={setNext}
          autoComplete="new-password"
        />
        <PwField
          label="Confirm new password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
        />

        {/* Forgot Password? — styled like the login page's link; triggers the existing reset flow. */}
        <div className="text-right">
          <button
            type="button"
            onClick={handleForgot}
            disabled={resetSending}
            className="text-xs font-medium disabled:opacity-60"
            style={{ color: "#7C3AED" }}
          >
            {resetSending ? "Sending…" : "Forgot Password?"}
          </button>
        </div>

        <Button type="submit" className="w-full" disabled={saving}>
          {saving ? "Updating…" : "Update password"}
        </Button>
      </form>
    </div>
  );
}
