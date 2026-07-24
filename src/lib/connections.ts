import { supabase } from "@/integrations/supabase/client";

// Thin wrappers over the connection/username RPCs. Cast through `any` because these RPCs aren't in the
// generated Supabase types. All of them derive the caller's identity from auth.uid() server-side.

export type UserSearchResult = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  username: string | null;
};

// Prefix search over opt-in-public usernames (min 2 chars; server also enforces this). Excludes self
// and already-linked contacts.
export async function searchUsersByUsername(prefix: string): Promise<UserSearchResult[]> {
  const { data, error } = await (supabase as any).rpc("search_users_by_username", { prefix });
  if (error) throw error;
  return (data ?? []) as UserSearchResult[];
}

// Send a connection request to a user found via search. Returns the request id.
export async function requestConnection(targetUserId: string): Promise<string> {
  const { data, error } = await (supabase as any).rpc("request_connection", {
    target_user_id: targetUserId,
  });
  if (error) throw error;
  return data as string;
}

// Accept or decline an incoming request. Accepting creates the mutual link.
export async function respondConnectionRequest(requestId: string, accept: boolean): Promise<void> {
  const { error } = await (supabase as any).rpc("respond_connection_request", {
    request_id: requestId,
    accept,
  });
  if (error) throw error;
}

// Availability check for the username editor (debounced by the caller).
export async function usernameAvailable(candidate: string): Promise<boolean> {
  const { data, error } = await (supabase as any).rpc("username_available", { candidate });
  if (error) throw error;
  return !!data;
}

// Set the caller's own username. Returns the stored (lowercased) handle; throws on taken/invalid.
export async function setUsername(newUsername: string): Promise<string> {
  const { data, error } = await (supabase as any).rpc("set_username", { new_username: newUsername });
  if (error) throw error;
  return data as string;
}

// Local, client-side format check that mirrors the server's regex — for instant UI feedback.
export const USERNAME_RE = /^[a-z][a-z0-9_]{2,19}$/;
export function usernameFormatError(v: string): string | null {
  if (!v) return null;
  if (!USERNAME_RE.test(v)) {
    return "3–20 chars: lowercase letters, numbers, underscore; must start with a letter";
  }
  return null;
}
