import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useRealtimeSplits() {
  const qc = useQueryClient();

  useEffect(() => {
    const invalidateAll = () => {
      qc.invalidateQueries({ queryKey: ["splits"], exact: false });
      // Settlement-specific views live under their own keys (not under ["splits"]), so a
      // settlement insert/update/delete must invalidate these too or the Pending tab and
      // History won't refresh live — the receiver would see the notification but not the row.
      qc.invalidateQueries({ queryKey: ["settlements"], exact: false });
      qc.invalidateQueries({ queryKey: ["pending-settlements"] });
      qc.invalidateQueries({ queryKey: ["history-settlements"] });
      qc.invalidateQueries({ queryKey: ["pending-splits"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["people"] });
    };

    const invalidateTxns = () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
    };

    const channel = supabase
      .channel("split-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "splits" }, invalidateAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "split_shares" }, invalidateAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "settlements" }, invalidateAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "people" }, invalidateAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, invalidateTxns)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => {
        qc.invalidateQueries({ queryKey: ["notifications"] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [qc]);
}