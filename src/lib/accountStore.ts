import { Capacitor } from "@capacitor/core";

// On-device store of remembered accounts, keyed by user id, for the Switch Account feature.
// Records persist until explicitly removed — signing out deliberately keeps them, so a profile
// stays one tap away.
//
// Native uses @capacitor/preferences (survives WebView data being cleared); the browser and any
// APK built before the plugin existed fall back to localStorage. Same isPluginAvailable guard as
// src/lib/attachments.ts — isNativePlatform alone would be true on an older APK whose bridge has
// no Preferences plugin, and the call would throw.
//
// SECURITY NOTE: these records hold refresh tokens, which are bearer credentials for the account.
// Capacitor Preferences is app-private storage but NOT an encrypted keystore. Anyone with the
// device unlocked, or root/backup access, can read them. That is the accepted trade-off for
// instant switching without re-auth; a secure-storage plugin would be the hardening step.
const STORE_KEY = "cf_remembered_accounts";

export type StoredAccount = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  refresh_token: string;
  access_token: string;
  // ISO timestamp — drives "most recently used other account" for the future double-tap swap.
  last_used_at: string;
};

function nativePrefs(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("Preferences");
}

async function readRaw(): Promise<string | null> {
  if (nativePrefs()) {
    const { Preferences } = await import("@capacitor/preferences");
    const { value } = await Preferences.get({ key: STORE_KEY });
    return value ?? null;
  }
  try {
    return localStorage.getItem(STORE_KEY);
  } catch {
    return null; // private mode / storage disabled
  }
}

async function writeRaw(value: string): Promise<void> {
  if (nativePrefs()) {
    const { Preferences } = await import("@capacitor/preferences");
    await Preferences.set({ key: STORE_KEY, value });
    return;
  }
  try {
    localStorage.setItem(STORE_KEY, value);
  } catch {
    /* storage full or disabled — remembering is best-effort, never fatal */
  }
}

// The whole store is one JSON blob rather than a key per account: switching needs the full list
// anyway, and Preferences has no prefix-scan.
async function readAll(): Promise<StoredAccount[]> {
  const raw = await readRaw();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredAccount[]) : [];
  } catch {
    return []; // corrupt blob — treat as empty rather than wedging every caller
  }
}

async function writeAll(rows: StoredAccount[]): Promise<void> {
  await writeRaw(JSON.stringify(rows));
}

/** Most-recently-used first. */
export async function listAccounts(): Promise<StoredAccount[]> {
  const rows = await readAll();
  return rows.sort((a, b) => String(b.last_used_at).localeCompare(String(a.last_used_at)));
}

export async function getAccount(userId: string): Promise<StoredAccount | null> {
  return (await readAll()).find((a) => a.user_id === userId) ?? null;
}

/** Upsert by user_id — signing in again with a remembered account refreshes it in place. */
export async function saveAccount(record: StoredAccount): Promise<void> {
  const rows = await readAll();
  const i = rows.findIndex((a) => a.user_id === record.user_id);
  if (i >= 0) rows[i] = { ...rows[i], ...record };
  else rows.push(record);
  await writeAll(rows);
}

export async function removeAccount(userId: string): Promise<void> {
  await writeAll((await readAll()).filter((a) => a.user_id !== userId));
}

// Refresh tokens ROTATE: each one can be exchanged only once, and reusing a spent token makes
// Supabase revoke the entire session. So the stored pair must be overwritten every time the active
// session refreshes, or a later switch would present a dead token and silently sign that account
// out everywhere. No-ops for an unknown user rather than inserting a partial record.
export async function updateTokens(
  userId: string,
  tokens: { access_token: string; refresh_token: string },
): Promise<void> {
  const rows = await readAll();
  const i = rows.findIndex((a) => a.user_id === userId);
  if (i < 0) return;
  rows[i] = { ...rows[i], ...tokens, last_used_at: new Date().toISOString() };
  await writeAll(rows);
}
