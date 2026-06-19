import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useRealtimeSplits() {
  const qc = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("split-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "splits" }, () => {
        qc.invalidateQueries({ queryKey: ["splits"] });
        qc.invalidateQueries({ queryKey: ["transactions"] });
        qc.invalidateQueries({ queryKey: ["accounts"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "split_shares" }, () => {
        qc.invalidateQueries({ queryKey: ["splits"] });
        qc.invalidateQueries({ queryKey: ["transactions"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "settlements" }, () => {
        qc.invalidateQueries({ queryKey: ["splits"] });
        qc.invalidateQueries({ queryKey: ["transactions"] });
        qc.invalidateQueries({ queryKey: ["accounts"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "people" }, () => {
        qc.invalidateQueries({ queryKey: ["people"] });
        qc.invalidateQueries({ queryKey: ["splits"] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [qc]);
}