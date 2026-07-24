import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { NATIVE_AUTH_CALLBACK, consumeRecoveryPending } from "@/lib/passwordReset";

// Native only. Password-recovery links come back on the SAME deep link Google OAuth uses
// (cashflow://auth-callback) — the exact string already registered in the shipped app and allow-listed
// in Supabase, so it opens the app rather than falling back to the website. The callback URL is
// indistinguishable from a Google sign-in callback, so we tell them apart with a local flag: a recovery
// request sets it (passwordReset), a Google sign-in clears it (googleAuth). Only when the flag is
// present do we treat the callback as recovery; otherwise we leave it to googleAuth's handler.
//
// Catches the link on cold start (getLaunchUrl) and while running (appUrlOpen), exchanges the PKCE
// ?code for a recovery session, and routes to the set-new-password screen. Mounted once, high in the
// tree, so it works even while logged out.
export function ResetDeepLinkHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let cancelled = false;
    let sub: { remove: () => void } | null = null;

    async function handleUrl(url: string | null | undefined) {
      if (!url || !url.startsWith(NATIVE_AUTH_CALLBACK)) return;
      if (!consumeRecoveryPending()) return; // a Google OAuth callback → not ours
      const code = new URL(url).searchParams.get("code");
      if (code) {
        await supabase.auth.exchangeCodeForSession(code).catch(() => {});
      }
      // Route to the reset screen regardless; it surfaces an invalid/expired state if the exchange
      // failed or produced no recovery session.
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
