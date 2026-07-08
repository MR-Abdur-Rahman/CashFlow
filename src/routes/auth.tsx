import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { signInWithGoogle } from "@/lib/googleAuth";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";

// Shared dark-theme field styling (per design spec).
const FIELD: React.CSSProperties = {
  background: "#1A1A1A",
  border: "1px solid #2A2A2A",
  color: "#FFFFFF",
};

export default function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  // One field accepts either an email or a phone number; routing is decided at submit.
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

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

  // Email + password flow (the active method). UNCHANGED Supabase calls.
  async function handleEmail(email: string) {
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name }, emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Account created! You're signed in.");
        navigate("/home");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/home");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const id = identifier.trim();
    // An "@" means it's an email → the active flow. Anything else is treated as a phone number,
    // which isn't wired yet.
    if (id.includes("@")) {
      handleEmail(id);
    } else {
      toast.message("Phone login is being set up — use your email for now.");
    }
  }

  return (
    <div
      style={{ background: "#0A0A0A" }}
      className="min-h-[100dvh] flex flex-col items-center justify-center px-6 py-12"
    >
      <div className="w-full max-w-sm">
        {/* Wordmark */}
        <h1 className="text-center text-4xl font-bold tracking-tight text-white">CashFlow</h1>

        <form onSubmit={handleSubmit} className="mt-10 space-y-4">
          <h2 className="mb-1 text-center text-xl font-semibold text-white">
            {mode === "signup" ? "Create account" : "Login"}
          </h2>
          {mode === "signup" && (
            <input
              type="text"
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={FIELD}
              className="w-full rounded-lg px-4 py-3 text-sm outline-none placeholder:text-[#9CA3AF]"
            />
          )}

          {/* Single identifier — email or phone number */}
          <input
            type="text"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="Email / Phone Number"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            style={FIELD}
            className="w-full rounded-lg px-4 py-3 text-sm outline-none placeholder:text-[#9CA3AF]"
          />

          {/* Password with show/hide */}
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={FIELD}
              className="w-full rounded-lg px-4 py-3 pr-11 text-sm outline-none placeholder:text-[#9CA3AF]"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2"
              style={{ color: "#9CA3AF" }}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>

          {mode === "signin" && (
            <div className="text-right">
              <button
                type="button"
                onClick={() => toast.message("Password reset is coming soon.")}
                className="text-xs"
                style={{ color: "#9CA3AF" }}
              >
                Forgot Password?
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: "#7C3AED" }}
          >
            {loading ? "Please wait…" : mode === "signup" ? "Create account" : "Login"}
          </button>
        </form>

        {/* Divider */}
        <div className="my-6 flex items-center gap-3">
          <span className="h-px flex-1" style={{ background: "#2A2A2A" }} />
          <span className="text-xs" style={{ color: "#9CA3AF" }}>
            or
          </span>
          <span className="h-px flex-1" style={{ background: "#2A2A2A" }} />
        </div>

        {/* Google — alternative to the email/phone form */}
        <button
          type="button"
          onClick={handleGoogle}
          disabled={googleLoading}
          style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", color: "#FFFFFF" }}
          className="flex w-full items-center justify-center gap-3 rounded-xl py-3 text-sm font-semibold disabled:opacity-60"
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
        <p className="mt-6 text-center text-sm" style={{ color: "#9CA3AF" }}>
          {mode === "signin" ? "Need an account? " : "Already have an account? "}
          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="font-medium"
            style={{ color: "#7C3AED" }}
          >
            {mode === "signin" ? "Sign up" : "Login"}
          </button>
        </p>
      </div>
    </div>
  );
}
