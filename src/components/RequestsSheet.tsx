import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { UserAvatar } from "@/components/UserAvatar";
import { incomingRequestsQuery } from "@/lib/queries";
import { ConnectionRequestActions } from "./ConnectionRequestActions";

// Focused "connection requests" list (like Instagram's follow-requests). Shows only still-pending
// incoming requests, each with the requester's avatar/name and inline Accept/Decline.
export function RequestsSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { data: all = [] } = useQuery(incomingRequestsQuery());
  const pending = (all as any[]).filter((r) => r.status === "pending");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="border-0 p-0 max-h-[75dvh] flex flex-col"
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "12px 12px 0 0",
        }}
      >
        <SheetTitle className="sr-only">Connection requests</SheetTitle>

        <div
          className="flex items-center justify-between"
          style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}
        >
          <span className="font-semibold text-foreground">Connection requests</span>
        </div>

        <div className="overflow-y-auto" style={{ maxHeight: 440 }}>
          {pending.length === 0 ? (
            <p
              className="text-center"
              style={{ color: "var(--muted-foreground)", padding: 40, fontSize: 14 }}
            >
              No pending requests
            </p>
          ) : (
            pending.map((r: any) => (
              <div
                key={r.id}
                className="flex items-center gap-3"
                style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}
              >
                <UserAvatar
                  url={r.from?.avatar_url}
                  name={r.from?.full_name ?? r.from?.username ?? "?"}
                  size={40}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate text-foreground">
                    {r.from?.full_name ?? "CashFlow user"}
                  </p>
                  {r.from?.username && (
                    <p className="text-xs text-muted-foreground truncate">@{r.from.username}</p>
                  )}
                </div>
                <ConnectionRequestActions requestId={r.id} status="pending" />
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
