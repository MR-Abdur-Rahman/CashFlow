import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Search, QrCode, UserPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/UserAvatar";
import {
  searchUsersByUsername,
  requestConnection,
  type UserSearchResult,
} from "@/lib/connections";

// Compact "Add CashFlow person" sheet (same Dialog style as Add-local-person). Live username search
// inline; tapping a result sends a connection request and closes. The QR button opens the existing
// scan flow.
export function AddCashFlowPersonDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const term = q.trim().toLowerCase();

  // Reset when reopened.
  useEffect(() => {
    if (!open) {
      setQ("");
      setResults([]);
      setSending(null);
    }
  }, [open]);

  // Debounced prefix search.
  useEffect(() => {
    if (term.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const h = setTimeout(async () => {
      try {
        setResults(await searchUsersByUsername(term));
      } catch (e: any) {
        toast.error(e.message ?? "Search failed");
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(h);
  }, [term]);

  async function send(id: string) {
    setSending(id);
    try {
      await requestConnection(id);
      toast.success("Request sent");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Couldn't send request");
    } finally {
      setSending(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Add CashFlow person</DialogTitle>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by username"
                autoCapitalize="none"
                autoCorrect="off"
                autoFocus
                className="w-full rounded-lg bg-secondary py-2.5 pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
            <button
              type="button"
              aria-label="Scan QR code"
              onClick={() => {
                onOpenChange(false);
                navigate("/settings/qr");
              }}
              className="h-10 w-10 shrink-0 rounded-lg bg-secondary text-foreground grid place-items-center active:opacity-80"
            >
              <QrCode className="h-5 w-5" />
            </button>
          </div>

          <div className="min-h-[3rem] max-h-64 overflow-y-auto -mx-1 px-1">
            {term.length < 2 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                Type a username to find someone, or scan their QR code.
              </p>
            ) : loading ? (
              <div className="flex justify-center py-6 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : results.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No users found.</p>
            ) : (
              <div className="divide-y divide-border">
                {results.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 py-2">
                    <UserAvatar
                      url={r.avatar_url}
                      name={r.full_name ?? r.username ?? "?"}
                      size={36}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {r.full_name ?? "CashFlow user"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">@{r.username}</p>
                    </div>
                    <button
                      type="button"
                      disabled={sending === r.id}
                      onClick={() => send(r.id)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold shrink-0 bg-primary text-white active:opacity-80 disabled:opacity-60",
                      )}
                    >
                      {sending === r.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <UserPlus className="h-3.5 w-3.5" />
                      )}
                      Add
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
