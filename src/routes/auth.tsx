import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";

type Tab = "phone" | "email";

// Shared dark-theme field styling (per design spec).
const FIELD: React.CSSProperties = {
  background: "#1A1A1A",
  border: "1px solid #2A2A2A",
  color: "#FFFFFF",
};

export default function AuthPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("phone");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate("/home");
    });
  }, [navigate]);

  // Existing email + password flow — UNCHANGED. Kept wired so email login keeps working.
  async function handleEmail() {
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
    if (tab === "email") {
      handleEmail();
    } else {
      // Phone + password is NOT wired yet — pending the signup-approach decision.
      toast.message("Phone login is being set up — use Email or Google for now.");
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
        <h2 className="mt-8 text-center text-xl font-semibold text-white">
          {mode === "signup" ? "Create account" : "Login"}
        </h2>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {/* Phone | Email segmented toggle */}
          <div className="flex gap-1 rounded-lg p-1" style={{ background: "#1A1A1A" }}>
            {(["phone", "email"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className="flex-1 rounded-lg py-2 text-sm font-medium capitalize transition-colors"
                style={
                  tab === t ? { background: "#7C3AED", color: "#FFFFFF" } : { color: "#9CA3AF" }
                }
              >
                {t}
              </button>
            ))}
          </div>

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

          {/* Identifier field switches with the toggle; password is shared */}
          {tab === "phone" ? (
            <input
              type="tel"
              placeholder="Phone number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={FIELD}
              className="w-full rounded-lg px-4 py-3 text-sm outline-none placeholder:text-[#9CA3AF]"
            />
          ) : (
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={FIELD}
              className="w-full rounded-lg px-4 py-3 text-sm outline-none placeholder:text-[#9CA3AF]"
            />
          )}

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
