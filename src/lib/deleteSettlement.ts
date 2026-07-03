import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { notifyToast } from "@/lib/notify";
import { settlementDirection } from "@/lib/settlement";

// A settlement may be deleted by its CREATOR or its PAYER (the debtor who settled).
// `settlementDirection(s).iPaid` is true when the viewer is that debtor. Server-side
// permission is still enforced by the delete_settlement RPC — this gate only controls
// whether the swipe button is active vs greyed-out. (Edit stays creator-only: there is
// no elevated update path, so only widen delete.)
export function canDeleteSettlement(s: any, currentUserId?: string | null): boolean {
  if (!currentUserId) return false;
  if (s.created_by === currentUserId) return true;
  try {
    return settlementDirection(s, currentUserId).iPaid;
  } catch {
    return false;
  }
}

// Deletes a settlement through the SECURITY DEFINER `delete_settlement` RPC — the single
// source of truth. It enforces creator-or-payer permission, then DELETEs the row so the
// existing balance triggers (update_account_balance_on_settlement + settlement_receiver_balance)
// restore BOTH accounts, clears the receiver's pending account-selection notification, and
// notifies the other party. The client must NOT restore balances or write cross-user
// notifications itself (RLS blocks updating another user's account / notifications).
export async function deleteSettlement(settlementId: string, qc: QueryClient): Promise<boolean> {
  const { error } = await supabase.rpc("delete_settlement", { p_settlement_id: settlementId });
  if (error) {
    notifyToast("delete_attempt", "Cannot delete", error.message);
    return false;
  }
  notifyToast("settlement_created", "Settlement deleted");
  for (const key of [
    ["splits"], ["accounts"], ["settlements"], ["history-settlements"],
    ["pending-splits"], ["pending-settlements"], ["transactions"], ["notifications"],
  ]) {
    qc.invalidateQueries({ queryKey: key, exact: false });
  }
  return true;
}
