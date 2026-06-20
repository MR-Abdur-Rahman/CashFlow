import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useRealtimeSplits() {
  const qc = useQueryClient();

  useEffect(() => {
    const invalidateAll = () => {
      qc.invalidateQueries({ queryKey: ["splits"], exact: false });
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