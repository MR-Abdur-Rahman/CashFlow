import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { notifyToast } from "@/lib/notify";

// A split may be modified (edited/deleted) by its CREATOR or its PAYER.
// Own splits (created_by = me) arrive without `_isIncoming`; incoming splits
// carry `_isIncoming: true` + `_myPersonId` (the viewer's person_id in that
// split). The viewer is the payer when the split's paid_by_person_id is their
// own person record. Server-side permission is still enforced by the
// `delete_split` RPC — this gate only controls whether the swipe button is
// active vs greyed-out.
export function canModifySplit(split: any): boolean {
  if (!split?._isIncoming) return true; // I created it
  return !!split._myPersonId && split.paid_by_person_id === split._myPersonId; // I paid it
}

// Deletes a split through the SECURITY DEFINER `delete_split` RPC. The RPC is
// the single source of truth and (atomically, RLS-safe) enforces creator-or-payer
// permission, blocks deletion when settlements exist, restores the payer's
// account balance, cancels any pending account-selection notification, and
// notifies every other participant. The client only invokes it and refreshes —
// it must NOT restore balances or write cross-user notifications itself (RLS
// would block updating another user's account, and a DELETE trigger would
// otherwise double-fire).
export async function deleteSplit(splitId: string, qc: QueryClient): Promise<boolean> {
  const { error } = await supabase.rpc("delete_split", { p_split_id: splitId });
  if (error) {
    // RPC RAISE messages surface here (permission denied / settlements exist).
    notifyToast("delete_attempt", "Cannot delete", error.message);
    return false;
  }
  notifyToast("split_deleted", "Split deleted");
  for (const key of [
    ["splits"],
    ["accounts"],
    ["pending-splits"],
    ["transactions"],
    ["notifications"],
  ]) {
    qc.invalidateQueries({ queryKey: key, exact: false });
  }
  return true;
}
