import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { QueryClient } from "@tanstack/react-query";

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
  const phoneRaw = typeof payload.phone === "string" ? payload.phone.trim() : "";
  const scannedPhone = phoneRaw && /^\+?[0-9 ()-]{6,20}$/.test(phoneRaw) ? phoneRaw : null;
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
  const { error } = await supabase.rpc("create_mutual_connection", {
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
