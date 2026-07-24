import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

// Reuse the SAME deep link the Google OAuth flow already registers (cashflow://auth-callback) so no new
// intent-filter / APK rebuild is needed. The ?type=recovery marker lets ResetDeepLinkHandler tell a
// password-recovery callback apart from an OAuth sign-in callback. Supabase preserves this query param
// and appends its own ?code=… (PKCE) when the emailed link is opened, so the app ultimately receives
// cashflow://auth-callback?type=recovery&code=…
export const NATIVE_AUTH_CALLBACK = "cashflow://auth-callback";
export const RECOVERY_REDIRECT = `${NATIVE_AUTH_CALLBACK}?type=recovery`;

// Sends a password-reset email via Supabase's dedicated "Reset Password" template (the default works —
// no template edit needed, and it's a different template from the Magic Link one). The emailed link
// carries a PKCE ?code that ResetDeepLinkHandler (native) or /reset-password (web) exchanges for a
// short-lived recovery session, after which the user can set a new password.
export async function sendPasswordReset(email: string): Promise<void> {
  const redirectTo = Capacitor.isNativePlatform()
    ? RECOVERY_REDIRECT
    : `${window.location.origin}/reset-password`;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
}
