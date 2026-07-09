import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Triggered by an AFTER INSERT trigger on public.feedback (via pg_net). Emails the feedback to the
// dev inbox through Resend, attaching the uploaded screenshot/recording (if any) so developers can
// see the actual issue. verify_jwt is disabled (DB webhook); guarded by a shared secret header.
//
// FEEDBACK_WEBHOOK_SECRET must match the `feedback_webhook_secret` entry in Supabase Vault, which is
// what public.notify_feedback_insert() reads when it signs the request.
const WEBHOOK_SECRET = Deno.env.get("FEEDBACK_WEBHOOK_SECRET");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const TO = "cashflow.app.dev@gmail.com";
const FROM = "onboarding@resend.dev";

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Constant-time compare so a wrong secret can't be recovered by timing the 401.
function secretMatches(provided: string | null): boolean {
  if (!WEBHOOK_SECRET || !provided) return false;
  const a = new TextEncoder().encode(provided);
  const b = new TextEncoder().encode(WEBHOOK_SECRET);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

Deno.serve(async (req: Request) => {
  // Fail closed: an unset secret must never degrade into an open endpoint.
  if (!WEBHOOK_SECRET) {
    console.error("FEEDBACK_WEBHOOK_SECRET is not set");
    return new Response("Misconfigured", { status: 500 });
  }
  if (!secretMatches(req.headers.get("x-webhook-secret"))) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!RESEND_API_KEY) {
    return new Response("Missing RESEND_API_KEY", { status: 500 });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const row = payload?.record ?? payload ?? {};
  const name: string = row.name ?? "";
  const email: string = row.email ?? "";
  const message: string = row.message ?? "";
  const imagePath: string | null = row.image_path ?? null;

  // Attach the screenshot/recording via a short-lived signed URL (private bucket). Best-effort: if
  // it can't be signed, we still send the text and note that the attachment was unavailable.
  const attachments: Array<{ filename: string; path: string }> = [];
  let attachNote = "";
  if (imagePath) {
    try {
      const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
      const { data, error } = await supabase.storage
        .from("feedback")
        .createSignedUrl(imagePath, 900);
      if (error || !data?.signedUrl) throw error ?? new Error("no signed url");
      attachments.push({
        filename: imagePath.split("/").pop() || "attachment",
        path: data.signedUrl,
      });
    } catch (e) {
      console.error("attachment sign failed", e);
      attachNote = `<p><em>(An attachment was uploaded but could not be included: ${esc(imagePath)})</em></p>`;
    }
  }

  const html = `
    <h2>New CashFlow feedback</h2>
    <p><strong>Name:</strong> ${esc(name) || "—"}</p>
    <p><strong>Email:</strong> ${esc(email)}</p>
    <p><strong>Message:</strong></p>
    <p>${esc(message).replace(/\n/g, "<br>")}</p>
    ${attachments.length ? "<p><strong>Attachment:</strong> see attached file.</p>" : ""}
    ${attachNote}
  `;

  const body: Record<string, unknown> = {
    from: FROM,
    to: TO,
    reply_to: email || undefined,
    subject: `New CashFlow feedback${name ? ` from ${name}` : ""}`,
    html,
  };
  if (attachments.length) body.attachments = attachments;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const t = await res.text();
    console.error("Resend error", res.status, t);
    return new Response(`Resend error: ${t}`, { status: 502 });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
