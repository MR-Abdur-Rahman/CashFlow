import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getAccount, saveAccount, updateTokens } from "@/lib/accountStore";

// Keeps the remembered-accounts store in step with the live session.
//
// Capture happens HERE rather than at each sign-in call site, because one flow cannot be captured
// at its call site at all: the Google WEB flow calls signInWithOAuth, which redirects the browser
// away — there is no code after the await. The session only materialises after the redirect back,
// via detectSessionInUrl. Same shape for the password-recovery deep link. onAuthStateChange sees
// every path (email sign-in, email sign-up, Google native exchangeCodeForSession, Google web,
// deep links), so this one listener covers strictly more than per-site calls would.

let started = false;

export async function captureSession(session: Session | null): Promise<void> {
  if (!session?.user || !session.refresh_token || !session.access_token) return;
  const uid = session.user.id;

  // Reuse the remembered display fields as the fallback, so a failed profile read (offline, RLS
  // hiccup) refreshes the tokens without blanking the name/avatar already on file.
  const existing = await getAccount(uid);

  let full_name = existing?.full_name ?? null;
  let avatar_url = existing?.avatar_url ?? null;
  try {
    const { data } = await supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", uid)
      .single();
    if (data) {
      full_name = data.full_name ?? full_name;
      avatar_url = data.avatar_url ?? avatar_url;
    }
  } catch {
    /* keep whatever we already had */
  }

  await saveAccount({
    user_id: uid,
    email: session.user.email ?? existing?.email ?? null,
    full_name,
    avatar_url,
    refresh_token: session.refresh_token,
    access_token: session.access_token,
    last_used_at: new Date().toISOString(),
  });
}

export function initAccountSync(): void {
  if (started) return; // StrictMode double-invokes effects; the listener must not stack
  started = true;

  supabase.auth.onAuthStateChange((event, session) => {
    if (!session) return;

    // supabase-js DEADLOCKS if you call its methods synchronously inside this callback — the same
    // reason App.tsx:106 defers syncGoogleEmail. Everything below touches the DB, so defer it all.
    if (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "USER_UPDATED") {
      setTimeout(() => void captureSession(session), 0);
      return;
    }

    // Tokens rotated: overwrite the stored pair immediately. A stale refresh token isn't just
    // useless — presenting a spent one revokes that account's whole session server-side.
    if (event === "TOKEN_REFRESHED") {
      setTimeout(() => {
        void updateTokens(session.user.id, {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        });
      }, 0);
    }
  });
}
