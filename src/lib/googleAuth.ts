import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

const NATIVE_REDIRECT = "cashflow://auth-callback";

// Google OAuth for both environments. Web uses the normal Supabase redirect; native opens the OAuth
// flow in the system browser and completes it via a custom-scheme deep link back into the app.
export async function signInWithGoogle(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const { Browser } = await import("@capacitor/browser");
    const { App } = await import("@capacitor/app");

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
