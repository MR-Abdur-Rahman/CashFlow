import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

// Where Supabase's password-reset link returns to. Native uses a custom-scheme deep link (its own host,
// separate from the Google OAuth cashflow://auth-callback, so the two callbacks never collide); web uses
// the /reset-password route on the current origin. Both must be in Supabase's Auth → Redirect URLs list.
export const NATIVE_RESET_REDIRECT = "cashflow://reset-callback";

// Sends a password-reset email via Supabase's dedicated "Reset Password" template (the default works —
// no template edit needed, and it's a different template from the Magic Link one). The emailed link
// carries a PKCE ?code that /reset-password (web) or ResetDeepLinkHandler (native) exchanges for a
// short-lived recovery session, after which the user can set a new password.
export async function sendPasswordReset(email: string): Promise<void> {
  const redirectTo = Capacitor.isNativePlatform()
    ? NATIVE_RESET_REDIRECT
    : `${window.location.origin}/reset-password`;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
}
