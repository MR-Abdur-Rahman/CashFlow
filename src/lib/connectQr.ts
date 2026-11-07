import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { QueryClient } from "@tanstack/react-query";
import { normalisePhone, parseStored } from "@/lib/phone";

/**
 * Args for the create_mutual_connection RPC. Declared here because the generated Supabase types
 * model the `*_phone` params as non-nullable `string`, while the SQL signature is plain `text` and
 * has always accepted NULL (we deliberately pass null when a number is unknown or unparseable).
 */
export type MutualConnectionArgs = {
  scanner_user_id: string;
  scanner_name: string;
  scanner_phone: string | null;
  scanned_user_id: string;
  scanned_name: string;
  scanned_phone: string | null;
};

/** Single call site for create_mutual_connection, so the nullability note lives in one place. */
export function createMutualConnection(args: MutualConnectionArgs) {
  return supabase.rpc("create_mutual_connection", args as never);
}

/**
 * A QR payload's `phone` field reduced to canonical E.164, or null when it isn't a valid number.
 * QR payloads are untrusted input (and older apps emitted the legacy space-joined format), so this
 * is the only way a scanned phone may reach the database.
 */
export function qrPhoneToE164(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const parsed = parseStored(raw);
  return parsed ? normalisePhone(parsed.national, parsed.country) : null;
}

// Scan a CashFlow contact QR and create the mutual connection (adds each other as linked contacts).
// Shared by the Split page, Manage page, and Settings → QR.
export async function connectViaQr(text: string, qc: QueryClient) {
  let payload: any;
  try {
    payload = JSON.parse(text);
  } catch {
    return toast.error("Not a valid QR code");
  }
  if (payload?.app !== "cashflow") return toast.error("Not a CashFlow QR");

  const scannedName =
    typeof payload.name === "string" ? payload.name.trim().slice(0, 80) : "Friend";
  // Never store the raw payload value: run it through the shared util and keep it only if it
  // normalises to canonical E.164. An unparseable number is dropped, not saved — the connection
  // itself still goes ahead (it keys off the user id, not the phone).
  const scannedPhone = qrPhoneToE164(payload.phone);
  const scannedUserId = typeof payload.id === "string" ? payload.id : null;
  if (!scannedUserId) return toast.error("QR is missing user ID");

  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return toast.error("Not signed in");
  if (scannedUserId === u.user.id) return toast.error("That's your own QR");

  const { data: me } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", u.user.id)
    .maybeSingle();

  // Phone is no longer snapshotted into the contact row — linked contacts resolve the current
  // number through contact_phones() (privacy-enforced), so we pass null here.
  const { error } = await createMutualConnection({
    scanner_user_id: u.user.id,
    scanner_name: me?.full_name || "Friend",
    scanner_phone: null,
    scanned_user_id: scannedUserId,
    scanned_name: scannedName || "Friend",
    scanned_phone: scannedPhone,
  });
  if (error) return toast.error(error.message);

  toast.success(`Connected with ${scannedName || "friend"} 🔗`);
  qc.invalidateQueries({ queryKey: ["people"] });
  qc.invalidateQueries({ queryKey: ["splits"] });
}
