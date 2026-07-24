import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { NATIVE_AUTH_CALLBACK } from "@/lib/passwordReset";

// Native only. Password-recovery links come back on the SAME deep link Google OAuth uses
// (cashflow://auth-callback) — the intent-filter for it is already registered in the shipped app, so no
// APK rebuild is needed. They're tagged ?type=recovery so we can tell them apart from an OAuth sign-in
// callback: recovery ones we handle here; anything else we ignore and leave to googleAuth's handler.
//
// Catches the link whether the app was cold-started by tapping it (App.getLaunchUrl) or was already
// running (appUrlOpen), exchanges the PKCE ?code for a recovery session, and routes to the
// set-new-password screen. Mounted once, high in the tree, so it works even while logged out.
export function ResetDeepLinkHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let cancelled = false;
    let sub: { remove: () => void } | null = null;

    async function handleUrl(url: string | null | undefined) {
      if (!url || !url.startsWith(NATIVE_AUTH_CALLBACK)) return;
      const params = new URL(url).searchParams;
      if (params.get("type") !== "recovery") return; // OAuth sign-in callback → not ours
      const code = params.get("code");
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
