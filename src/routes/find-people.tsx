import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, UserPlus, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SettingsHeader } from "@/components/SettingsRows";
import { UserAvatar } from "@/components/UserAvatar";
import { incomingRequestsQuery } from "@/lib/queries";
import {
  searchUsersByUsername,
  requestConnection,
  respondConnectionRequest,
  type UserSearchResult,
} from "@/lib/connections";

export default function FindPeoplePage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "requests" ? "requests" : "search";
  const setTab = (t: "search" | "requests") => setParams(t === "search" ? {} : { tab: "requests" });

  return (
    <div className="px-4 pt-6 pb-24 space-y-5">
      <SettingsHeader title="Find people" back="/manage" />

      <div className="flex rounded-xl bg-secondary p-1 gap-1">
        {(["search", "requests"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 rounded-lg py-2 text-sm font-medium transition-colors capitalize",
              tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            {t === "search" ? "Search" : "Requests"}
          </button>
        ))}
      </div>

      {tab === "search" ? <SearchTab /> : <RequestsTab />}
    </div>
  );
}

function SearchTab() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState<string | null>(null);
  const term = q.trim().toLowerCase();

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
      setSent((s) => new Set(s).add(id));
      toast.success("Request sent");
    } catch (e: any) {
      toast.error(e.message ?? "Couldn't send request");
    } finally {
      setSending(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by username"
          autoCapitalize="none"
          autoCorrect="off"
          className="w-full rounded-lg bg-secondary py-2.5 pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>

      {term.length < 2 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          Type at least 2 characters to search usernames.
        </p>
      ) : loading ? (
        <div className="flex justify-center py-8 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : results.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No users found.</p>
      ) : (
        <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden shadow-sm">
          {results.map((r) => {
            const done = sent.has(r.id);
            return (
              <div key={r.id} className="flex items-center gap-3 p-3">
                <UserAvatar url={r.avatar_url} name={r.full_name ?? r.username ?? "?"} size={40} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{r.full_name ?? "CashFlow user"}</p>
                  <p className="text-xs text-muted-foreground truncate">@{r.username}</p>
                </div>
                <button
                  type="button"
                  disabled={done || sending === r.id}
                  onClick={() => send(r.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold shrink-0",
                    done
                      ? "bg-secondary text-muted-foreground"
                      : "bg-primary text-white active:opacity-80",
                  )}
                >
                  {sending === r.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : done ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <UserPlus className="h-3.5 w-3.5" />
                  )}
                  {done ? "Sent" : "Add"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RequestsTab() {
  const qc = useQueryClient();
  const { data: requests = [], isLoading } = useQuery(incomingRequestsQuery());
  const [busy, setBusy] = useState<string | null>(null);

  async function respond(id: string, accept: boolean) {
    setBusy(id);
    try {
      await respondConnectionRequest(id, accept);
      toast.success(accept ? "Connected 🔗" : "Request declined");
      qc.invalidateQueries({ queryKey: ["connection_requests"] });
      qc.invalidateQueries({ queryKey: ["people"] });
      qc.invalidateQueries({ queryKey: ["splits"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setBusy(null);
    }
  }

  const list = requests as any[];

  if (isLoading) {
    return (
      <div className="flex justify-center py-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (list.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-10">No pending requests.</p>;
  }

  return (
    <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden shadow-sm">
      {list.map((req) => (
        <div key={req.id} className="flex items-center gap-3 p-3">
          <UserAvatar
            url={req.from?.avatar_url}
            name={req.from?.full_name ?? req.from?.username ?? "?"}
            size={40}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {req.from?.full_name ?? "CashFlow user"}
            </p>
            {req.from?.username && (
              <p className="text-xs text-muted-foreground truncate">@{req.from.username}</p>
            )}
          </div>
          <button
            type="button"
            disabled={busy === req.id}
            onClick={() => respond(req.id, false)}
            aria-label="Decline"
            className="h-9 w-9 shrink-0 grid place-items-center rounded-lg bg-secondary text-muted-foreground active:opacity-80 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={busy === req.id}
            onClick={() => respond(req.id, true)}
            aria-label="Accept"
            className="h-9 w-9 shrink-0 grid place-items-center rounded-lg bg-primary text-white active:opacity-80 disabled:opacity-50"
          >
            {busy === req.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
          </button>
        </div>
      ))}
    </div>
  );
}
