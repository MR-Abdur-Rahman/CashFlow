import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

// Native recovery reuses the EXACT Google OAuth deep link (cashflow://auth-callback) — byte-identical
// to the string that's already registered in the app and allow-listed in Supabase, so it reliably
// opens the app instead of silently falling back to the Site URL (which happens when redirect_to isn't
// in the allow-list — e.g. a ?type=recovery variant that doesn't match a plain entry).
//
// Because the recovery callback URL is then indistinguishable from a Google sign-in callback, we mark a
// short-lived local flag when requesting a reset; ResetDeepLinkHandler consumes it, and googleAuth
// clears it when a Google sign-in starts, so an OAuth callback is never mistaken for recovery.
export const NATIVE_AUTH_CALLBACK = "cashflow://auth-callback";
const RECOVERY_FLAG = "cf_recovery_pending";
const RECOVERY_TTL_MS = 60 * 60 * 1000; // roughly how long a reset link stays valid

export function markRecoveryPending(): void {
  try {
    localStorage.setItem(RECOVERY_FLAG, String(Date.now()));
  } catch {
    /* storage unavailable — ignore */
  }
}

export function clearRecoveryPending(): void {
  try {
    localStorage.removeItem(RECOVERY_FLAG);
  } catch {
    /* ignore */
  }
}

// True (and clears the flag) only if a fresh reset request is pending — i.e. this auth-callback is a
// password recovery, not a Google sign-in.
export function consumeRecoveryPending(): boolean {
  let v: string | null = null;
  try {
    v = localStorage.getItem(RECOVERY_FLAG);
    localStorage.removeItem(RECOVERY_FLAG);
  } catch {
    /* ignore */
  }
  if (!v) return false;
  const ts = Number(v);
  return Number.isFinite(ts) && Date.now() - ts < RECOVERY_TTL_MS;
}

// Sends a password-reset email via Supabase's dedicated "Reset Password" template (default works — a
// different template from Magic Link). The emailed link carries a PKCE ?code that ResetDeepLinkHandler
// (native) or /reset-password (web) exchanges for a short-lived recovery session to set a new password.
export async function sendPasswordReset(email: string): Promise<void> {
  const native = Capacitor.isNativePlatform();
  const redirectTo = native ? NATIVE_AUTH_CALLBACK : `${window.location.origin}/reset-password`;
  if (native) markRecoveryPending();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) {
    if (native) clearRecoveryPending();
    throw error;
  }
}
