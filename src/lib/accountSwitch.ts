import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAccount, removeAccount } from "@/lib/accountStore";
import { captureSession } from "@/lib/accountSync";

export type SwitchResult =
  | { ok: true }
  | {
      ok: false;
      // "expired" means the record was dropped; "offline" keeps it for a later retry.
      reason: "same" | "not-found" | "expired" | "offline" | "error";
      message: string;
    };

// A failed setSession is ambiguous: the refresh token may genuinely be dead, or the phone may just
// be off Wi-Fi. Forgetting a good account because of a dropped packet would be worse than the bug
// this feature fixes, so only a real auth rejection (4xx from GoTrue) forgets it.
function isAuthRejection(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  const name = (err as { name?: string })?.name ?? "";
  if (/retryable|fetch|network/i.test(name)) return false;
  return typeof status === "number" && status >= 400 && status < 500;
}

// Activates a remembered account without re-authenticating. Does NOT navigate — the caller does,
// so this stays usable outside React.
export async function switchToAccount(userId: string, qc: QueryClient): Promise<SwitchResult> {
  const target = await getAccount(userId);
  if (!target) {
    return { ok: false, reason: "not-found", message: "That account is no longer remembered." };
  }

  const { data: currentData } = await supabase.auth.getSession();
  const current = currentData.session ?? null;
  if (current?.user?.id === userId) {
    return { ok: false, reason: "same", message: "You're already using this account." };
  }

  // Flush the outgoing account before leaving it. The TOKEN_REFRESHED listener should already have
  // it current; this closes the window where a refresh landed before the listener was registered.
  if (current) await captureSession(current);

  let switched;
  try {
    const { data, error } = await supabase.auth.setSession({
      access_token: target.access_token,
      refresh_token: target.refresh_token,
    });
    if (error) throw error;
    switched = data.session;
  } catch (err) {
    if (isAuthRejection(err)) {
      await removeAccount(userId);
      return {
        ok: false,
        reason: "expired",
        message: "This account's session expired — please sign in again.",
      };
    }
    return {
      ok: false,
      reason: "offline",
      message: "Couldn't reach the server. Check your connection and try again.",
    };
  }

  if (!switched) {
    await removeAccount(userId);
    return {
      ok: false,
      reason: "expired",
      message: "This account's session expired — please sign in again.",
    };
  }

  // MUST persist immediately. setSession refreshes an expired access token, and refreshing ROTATES
  // the refresh token — so the pair we just used is already spent. Without writing the new pair
  // back, the NEXT switch to this account would present a dead token, which doesn't merely fail:
  // Supabase treats reuse as compromise and revokes the whole session. Also bumps last_used_at.
  await captureSession(switched);

  // Same teardown as signOut — the previous account's rows must not bleed into the new one.
  await qc.cancelQueries();
  qc.clear();

  return { ok: true };
}
