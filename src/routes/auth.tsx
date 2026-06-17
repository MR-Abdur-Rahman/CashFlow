import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = "email" | "phone";

export default function AuthPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("email");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate("/home");
    });
  }, [navigate]);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
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

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone });
      if (error) throw error;
      setOtpSent(true);
      toast.success("Code sent to your phone");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send code.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({ phone, token: otp, type: "sms" });
      if (error) throw error;
      navigate("/home");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin + "/home" }
      });
      if (error) throw error;
    } catch {
      toast.error("Google sign-in failed");
      setLoading(false);
    }
  }

  return (
    <div className="phone-frame flex flex-col items-center justify-center px-6 py-12 min-h-[100dvh]">
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="balance-gradient rounded-2xl p-3">
          <Wallet className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">CashFlow</h1>
        <p className="text-sm text-muted-foreground">Track, split, simplify</p>
      </div>

      <div className="surface-card w-full p-5 space-y-4">
        <div className="flex gap-2 rounded-lg bg-secondary p-1">
          {(["email", "phone"] as const).map((t) => (
            <button key={t} type="button"
              onClick={() => { setTab(t); setOtpSent(false); }}
              className={cn("flex-1 rounded-md py-1.5 text-sm capitalize",
                tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
              {t}
            </button>
          ))}
        </div>

        {tab === "email" ? (
          <form onSubmit={handleEmail} className="space-y-4">
            <div className="flex gap-2 rounded-lg bg-secondary p-1">
              {(["signin", "signup"] as const).map((m) => (
                <button type="button" key={m} onClick={() => setMode(m)}
                  className={cn("flex-1 rounded-md py-1.5 text-sm",
                    mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
                  {m === "signin" ? "Sign in" : "Sign up"}
                </button>
              ))}
            </div>
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>
        ) : (
          <form onSubmit={otpSent ? verifyOtp : sendOtp} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone number</Label>
              <Input id="phone" type="tel" placeholder="+9477..."
                value={phone} onChange={(e) => setPhone(e.target.value)}
                required disabled={otpSent} />
            </div>
            {otpSent && (
              <div className="space-y-1.5">
                <Label htmlFor="otp">6-digit code</Label>
                <Input id="otp" inputMode="numeric" maxLength={6}
                  value={otp} onChange={(e) => setOtp(e.target.value)} required />
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {otpSent ? "Verify & sign in" : "Send code"}
            </Button>
            {otpSent && (
              <button type="button"
                className="w-full text-xs text-muted-foreground underline"
                onClick={() => { setOtpSent(false); setOtp(""); }}>
                Use a different number
              </button>
            )}
          </form>
        )}

        <div className="relative my-2 text-center text-xs text-muted-foreground">
          <span className="bg-card px-2 relative z-10">or</span>
          <span className="absolute left-0 top-1/2 w-full border-t border-border" />
        </div>

        <Button type="button" variant="outline" className="w-full"
          onClick={handleGoogle} disabled={loading}>
          Continue with Google
        </Button>
      </div>
    </div>
  );
}