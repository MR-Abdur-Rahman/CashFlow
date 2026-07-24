import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { NATIVE_RESET_REDIRECT } from "@/lib/passwordReset";

// Native only. Catches the password-reset deep link (cashflow://reset-callback?code=…) whether the app
// was cold-started by tapping the email link (App.getLaunchUrl) or was already running (appUrlOpen),
// exchanges the PKCE code for a recovery session, then routes to the set-new-password screen.
//
// Uses its own scheme host (reset-callback) so it never competes with the Google OAuth one-shot
// listener on auth-callback. Mounted once, high in the tree, so it works even while logged out.
export function ResetDeepLinkHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let cancelled = false;
    let sub: { remove: () => void } | null = null;

    async function handleUrl(url: string | null | undefined) {
      if (!url || !url.startsWith(NATIVE_RESET_REDIRECT)) return;
      const code = new URL(url).searchParams.get("code");
      // Go to the reset screen regardless; it surfaces an "invalid/expired link" state if the exchange
      // failed or produced no recovery session.
      if (code) {
        await supabase.auth.exchangeCodeForSession(code).catch(() => {});
      }
      navigate("/reset-password");
    }

    (async () => {
      const { App } = await import("@capacitor/app");
      // Cold start: the app was launched by the deep link.
      const launch = await App.getLaunchUrl();
      await handleUrl(launch?.url);
      if (cancelled) return;
      // Warm: link tapped while the app is already open.
      const listener = await App.addListener("appUrlOpen", ({ url }) => void handleUrl(url));
      if (cancelled) listener.remove();
      else sub = listener;
    })();

    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [navigate]);

  return null;
}
