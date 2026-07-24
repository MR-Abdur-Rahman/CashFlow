import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";

// Logged-out light theme, hardcoded like auth.tsx / SplashScreen (renders before PrefsApplier adds the
// html.light class).
const LIGHT = {
  bg: "oklch(0.99 0 0)",
  fg: "oklch(0.15 0 0)",
  muted: "oklch(0.45 0.01 286)",
  border: "oklch(0.9 0 0)",
};

// Landing screen for the password-reset email link. By the time we get here a short-lived recovery
// session should exist — established either by detectSessionInUrl processing the web ?code, or by
// ResetDeepLinkHandler exchanging the native deep-link code. The user sets a new password, which
// updateUser() applies to that session, upgrading it to a normal signed-in session → /home.
export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<"verifying" | "ready" | "invalid">("verifying");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let done = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!done && data.session) setPhase("ready");
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!done && session && (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN")) {
        setPhase("ready");
      }
    });
    // No recovery session materialised → the link was bad, already used, or expired.
    const t = setTimeout(() => {
      if (!done) setPhase((p) => (p === "verifying" ? "invalid" : p));
    }, 5000);
    return () => {
      done = true;
      subscription.unsubscribe();
      clearTimeout(t);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) return toast.error("Password must be at least 6 characters");
    if (password !== confirm) return toast.error("Passwords don't match");
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated — you're signed in");
      navigate("/home");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update password");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{ background: LIGHT.bg }}
      className="min-h-[100dvh] flex flex-col items-center justify-center px-6 py-12"
    >
      <style>{`
        .rp-field {
          background: #FFFFFF;
          border: 1px solid ${LIGHT.border};
          color: ${LIGHT.fg};
          border-radius: 13px;
        }
        .rp-field::placeholder { color: #9CA3AF; }
        .rp-field:focus {
          outline: none;
          border-color: #7C3AED;
          box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.15);
        }
      `}</style>

      <div className="w-full max-w-sm">
        <div className="flex justify-center">
          <img src="/favicon.svg" alt="CashFlow" style={{ height: 46, width: 46 }} />
        </div>

        {phase === "verifying" && (
          <p className="mt-8 text-center text-sm" style={{ color: LIGHT.muted }}>
            Verifying your reset link…
          </p>
        )}

        {phase === "invalid" && (
          <div className="mt-6 text-center">
            <h1 className="text-2xl font-bold" style={{ color: LIGHT.fg }}>
              Link expired
            </h1>
            <p className="mt-2 text-sm" style={{ color: LIGHT.muted }}>
              This reset link is invalid or has already been used. Request a new one from the login
              screen.
            </p>
            <button
              type="button"
              onClick={() => navigate("/auth")}
              className="mt-6 text-sm font-semibold"
              style={{ color: "#7C3AED" }}
            >
              Back to login
            </button>
          </div>
        )}

        {phase === "ready" && (
          <>
            <div className="mt-6 text-center">
              <h1 className="text-2xl font-bold" style={{ color: LIGHT.fg }}>
                Set a new password
              </h1>
              <p className="mt-1.5 text-sm" style={{ color: LIGHT.muted }}>
                Choose a new password for your account.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              <div className="relative">
                <input
                  type={show ? "text" : "password"}
                  placeholder="New password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  className="rp-field w-full px-4 py-3.5 pr-11 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  aria-label={show ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: LIGHT.muted }}
                >
                  {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>

              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  placeholder="Confirm new password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  className="rp-field w-full px-4 py-3.5 pr-11 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((s) => !s)}
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: LIGHT.muted }}
                >
                  {showConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-xl py-3.5 text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: "linear-gradient(90deg, #7C3AED 0%, #3B82F6 100%)" }}
              >
                {saving ? "Updating…" : "Update password"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
