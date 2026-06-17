import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useRealtimeSplits() {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel("split-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "splits" }, () => {
        qc.invalidateQueries({ queryKey: ["splits"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "split_shares" }, () => {
        qc.invalidateQueries({ queryKey: ["splits"] });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "settlements" }, (payload) => {
        qc.invalidateQueries({ queryKey: ["splits"] });
        if ((payload.new as any)?.created_by) toast.info("New settlement received");
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);
}
