import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { respondConnectionRequest } from "@/lib/connections";

// Inline Accept/Decline for a connection request — shared by the notification rows (home bell + history)
// and the dedicated Requests sheet. Once the request is no longer pending, shows the outcome instead.
export function ConnectionRequestActions({
  requestId,
  status,
  onResponded,
}: {
  requestId: string;
  status?: string | null;
  onResponded?: () => void;
}) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<null | "accept" | "decline">(null);

  if (status && status !== "pending") {
    return (
      <span
        className="shrink-0 text-xs font-semibold"
        style={{ color: status === "accepted" ? "var(--income)" : "var(--muted-foreground)" }}
      >
        {status === "accepted" ? "Accepted" : "Declined"}
      </span>
    );
  }

  async function respond(accept: boolean) {
    setBusy(accept ? "accept" : "decline");
    try {
      await respondConnectionRequest(requestId, accept);
      toast.success(accept ? "Connected 🔗" : "Request declined");
      qc.invalidateQueries({ queryKey: ["connection_requests"] });
      qc.invalidateQueries({ queryKey: ["people"] });
      qc.invalidateQueries({ queryKey: ["splits"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      onResponded?.();
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex items-center gap-2 shrink-0">
      <button
        type="button"
        disabled={!!busy}
        onClick={() => respond(false)}
        className="h-8 min-w-[68px] grid place-items-center rounded-lg bg-secondary text-muted-foreground text-xs font-semibold active:opacity-80 disabled:opacity-50"
      >
        {busy === "decline" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Decline"}
      </button>
      <button
        type="button"
        disabled={!!busy}
        onClick={() => respond(true)}
        className="h-8 min-w-[68px] grid place-items-center rounded-lg bg-primary text-white text-xs font-semibold active:opacity-80 disabled:opacity-50"
      >
        {busy === "accept" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Accept"}
      </button>
    </div>
  );
}
