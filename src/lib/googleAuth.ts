import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { clearRecoveryPending } from "./passwordReset";

const NATIVE_REDIRECT = "cashflow://auth-callback";

// Ensure profiles.google_email is set for a Google-linked user. The handle_new_user trigger records
// it only for brand-new signups, so an existing email/password user who links Google later would
// otherwise keep a null google_email. Cheap: writes only when a google identity exists and the stored
// value differs. Safe to call on every sign-in.
export async function syncGoogleEmail(): Promise<void> {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return;

  const identities = user.identities ?? [];
  const providers: string[] = (user.app_metadata as any)?.providers ?? [];
  const google = identities.find((i) => i.provider === "google");
  if (!google && !providers.includes("google")) return;

  const email = (google?.identity_data as any)?.email ?? user.email;
  if (!email) return;

  const { data: prof } = await supabase
    .from("profiles")
    .select("google_email")
    .eq("id", user.id)
    .maybeSingle();
  if ((prof as any)?.google_email === email) return; // already set

  await supabase
    .from("profiles")
    .update({ google_email: email } as never)
    .eq("id", user.id);
}

// Google OAuth for both environments. Web uses the normal Supabase redirect; native opens the OAuth
// flow in the system browser and completes it via a custom-scheme deep link back into the app.
export async function signInWithGoogle(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const { Browser } = await import("@capacitor/browser");
    const { App } = await import("@capacitor/app");

    // A Google sign-in and a password-recovery both come back on cashflow://auth-callback with a ?code.
    // Clear any pending-recovery flag now so this OAuth callback is never mistaken for recovery by
    // ResetDeepLinkHandler.
    clearRecoveryPending();

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: NATIVE_REDIRECT, skipBrowserRedirect: true },
    });
    if (error) throw error;

    // Deep link back into the app → exchange the ?code for a session → close the in-app browser.
    const sub = await App.addListener("appUrlOpen", async ({ url }) => {
      if (!url.startsWith(NATIVE_REDIRECT)) return;
      const code = new URL(url).searchParams.get("code");
      try {
        if (code) {
          const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
          if (exErr) throw exErr;
        }
      } finally {
        await Browser.close();
        await sub.remove();
      }
    });

    if (data?.url) await Browser.open({ url: data.url });
  } else {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/home` },
    });
    if (error) throw error; // browser redirects out; detectSessionInUrl finishes on return
  }
}
