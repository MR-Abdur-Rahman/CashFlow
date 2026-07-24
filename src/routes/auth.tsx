import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { signInWithGoogle } from "@/lib/googleAuth";
import { sendPasswordReset } from "@/lib/passwordReset";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";

// This page renders while logged out, BEFORE PrefsApplier adds the `html.light` class (that only runs
// once a profile loads). So — like SplashScreen — the light-theme colors are hardcoded here instead of
// using var(--…) tokens, keeping the page reliably light regardless of the dark :root default.
const LIGHT = {
  bg: "oklch(0.99 0 0)", // --background (html.light) — same as SplashScreen
  fg: "oklch(0.15 0 0)", // --foreground
  muted: "oklch(0.45 0.01 286)", // --muted-foreground
  border: "oklch(0.9 0 0)", // --border (html.light)
};

export default function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  // "reset-sent" swaps the form for a check-your-email confirmation after a reset link is sent.
  const [view, setView] = useState<"auth" | "reset-sent">("auth");
  const [resetLoading, setResetLoading] = useState(false);

  async function handleForgot() {
    const address = email.trim();
    if (!address) return toast.error("Enter your email above, then tap Forgot Password.");
    setResetLoading(true);
    try {
      await sendPasswordReset(address);
      setView("reset-sent");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send reset email");
    } finally {
      setResetLoading(false);
    }
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setGoogleLoading(false);
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate("/home");
    });
  }, [navigate]);

  // Email + password flow. Supabase calls themselves are UNCHANGED — only the post-signup destination
  // (guided setup) and the removed emailRedirectTo differ from before.
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const address = email.trim();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: address,
          password,
          options: { data: { full_name: name } },
        });
        if (error) throw error;
        toast.success("Account created! You're signed in.");
        // New users go through guided setup (name/photo/phone) before landing in the app.
        navigate("/setup");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: address, password });
        if (error) throw error;
        navigate("/home");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{ background: LIGHT.bg }}
      className="min-h-[100dvh] flex flex-col items-center justify-center px-6 py-12"
    >
      {/* Scoped input styling — inline styles can't express :focus / ::placeholder. */}
      <style>{`
        .auth-field {
          background: #FFFFFF;
          border: 1px solid ${LIGHT.border};
          color: ${LIGHT.fg};
          border-radius: 13px;
        }
        .auth-field::placeholder { color: #9CA3AF; }
        .auth-field:focus {
          outline: none;
          border-color: #7C3AED;
          box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.15);
        }
      `}</style>

      <div className="w-full max-w-sm">
        {/* Gradient lightning-bolt logo — same asset as the splash / App Info page */}
        <div className="flex justify-center">
          <img src="/favicon.svg" alt="CashFlow" style={{ height: 46, width: 46 }} />
        </div>

        {view === "reset-sent" ? (
          <div className="mt-6 text-center">
            <h1 className="text-2xl font-bold" style={{ color: LIGHT.fg }}>
              Check your email
            </h1>
            <p className="mt-2 text-sm" style={{ color: LIGHT.muted }}>
              We sent a password reset link to{" "}
              <span style={{ color: LIGHT.fg }}>{email.trim()}</span>. Open it on this device to set a
              new password.
            </p>
            <button
              type="button"
              onClick={handleForgot}
              disabled={resetLoading}
              className="mt-6 text-sm font-semibold disabled:opacity-60"
              style={{ color: "#7C3AED" }}
            >
              {resetLoading ? "Sending…" : "Resend email"}
            </button>
            <div>
              <button
                type="button"
                onClick={() => setView("auth")}
                className="mt-3 text-sm"
                style={{ color: LIGHT.muted }}
              >
                Back to login
              </button>
            </div>
          </div>
        ) : (
          <>
        {/* Heading + subtitle */}
        <div className="mt-6 text-center">
          <h1 className="text-2xl font-bold" style={{ color: LIGHT.fg }}>
            {mode === "signup" ? "Create your account" : "Welcome to CashFlow"}
          </h1>
          {mode === "signup" && (
            <p className="mt-1.5 text-sm" style={{ color: LIGHT.muted }}>
              Start tracking your money in minutes
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          {mode === "signup" && (
            <input
              type="text"
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              className="auth-field w-full px-4 py-3.5 text-sm"
            />
          )}

          <input
            type="email"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="auth-field w-full px-4 py-3.5 text-sm"
          />

          {/* Password with show/hide */}
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              className="auth-field w-full px-4 py-3.5 pr-11 text-sm"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2"
              style={{ color: LIGHT.muted }}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>

          {mode === "signin" && (
            <div className="text-right">
              <button
                type="button"
                onClick={handleForgot}
                disabled={resetLoading}
                className="text-xs font-medium disabled:opacity-60"
                style={{ color: "#7C3AED" }}
              >
                {resetLoading ? "Sending…" : "Forgot Password?"}
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl py-3.5 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: "linear-gradient(90deg, #7C3AED 0%, #3B82F6 100%)" }}
          >
            {loading ? "Please wait…" : mode === "signup" ? "Create account" : "Log in"}
          </button>
        </form>

        {/* Divider */}
        <div className="my-6 flex items-center gap-3">
          <span className="h-px flex-1" style={{ background: LIGHT.border }} />
          <span className="text-xs" style={{ color: LIGHT.muted }}>
            or continue with
          </span>
          <span className="h-px flex-1" style={{ background: LIGHT.border }} />
        </div>

        {/* Google — keeps signInWithGoogle logic; restyled light */}
        <button
          type="button"
          onClick={handleGoogle}
          disabled={googleLoading}
          style={{ background: "#FFFFFF", border: `1px solid ${LIGHT.border}`, color: LIGHT.fg }}
          className="flex w-full items-center justify-center gap-3 rounded-xl py-3.5 text-sm font-semibold disabled:opacity-60"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.88 2.68-6.62z"
            />
            <path
              fill="#34A853"
              d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.34A9 9 0 0 0 9 18z"
            />
            <path
              fill="#FBBC05"
              d="M3.98 10.72a5.4 5.4 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.02-2.34z"
            />
            <path
              fill="#EA4335"
              d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.9 11.43 0 9 0A9 9 0 0 0 .96 4.94l3.02 2.34C4.68 5.16 6.66 3.58 9 3.58z"
            />
          </svg>
          {googleLoading ? "Connecting…" : "Sign in with Google"}
        </button>

        {/* Bottom signup / signin toggle */}
        <p className="mt-6 text-center text-sm" style={{ color: LIGHT.muted }}>
          {mode === "signin" ? "I didn't have an account? " : "Already have an account? "}
          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="font-semibold"
            style={{ color: "#7C3AED" }}
          >
            {mode === "signin" ? "Sign up" : "Log in"}
          </button>
        </p>
          </>
        )}
      </div>
    </div>
  );
}
