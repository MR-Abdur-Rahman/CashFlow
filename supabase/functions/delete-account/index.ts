import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Genuinely-complete, self-only account deletion. The user id comes SOLELY from the verified JWT — the
// function never accepts a target id, so a caller can only ever delete THEIR OWN account. It re-runs
// the deletion blockers server-side (never trusts the client), purges the user's storage objects,
// clears the RESTRICT-guarded transactions, then calls admin.deleteUser which removes auth.users and
// cascades to profiles and all owned data (the BEFORE DELETE trigger on profiles still fires: it keeps
// other users' saved contact names and notifies them).
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return json({ error: "Not authenticated" }, 401);

  // User-scoped client — identity comes only from the caller's JWT.
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return json({ error: "Not authenticated" }, 401);
  const callerId = user.id;

  // Server-side re-check of the blocking conditions (defence-in-depth; never trust the client alone).
  const { data: blockers, error: blkErr } = await userClient.rpc("account_deletion_blockers");
  if (blkErr) return json({ error: blkErr.message }, 500);
  if (Array.isArray(blockers) && blockers.length > 0) {
    return json({ error: "blocked", blockers }, 409);
  }

  const service = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Purge the user's storage objects (not covered by the DB cascade). Best-effort per bucket.
  for (const bucket of ["avatars", "feedback"]) {
    try {
      const { data: files } = await service.storage.from(bucket).list(callerId);
      if (files && files.length) {
        await service.storage.from(bucket).remove(files.map((f) => `${callerId}/${f.name}`));
      }
    } catch (_e) {
      // ignore — storage cleanup shouldn't block account deletion
    }
  }

  // Clear the RESTRICT-guarded transactions before the account cascade (so normal single-account
  // deletion keeps its RESTRICT protection while full deletion still succeeds).
  const { error: txErr } = await service.from("transactions").delete().eq("user_id", callerId);
  if (txErr) return json({ error: `Failed to clear transactions: ${txErr.message}` }, 500);

  // The real deletion.
  const { error: delErr } = await service.auth.admin.deleteUser(callerId);
  if (delErr) return json({ error: delErr.message }, 500);

  return json({ ok: true });
});
