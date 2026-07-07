import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowLeft, Search, Share2 } from "lucide-react";
import { toast } from "sonner";
import { peopleQuery } from "@/lib/queries";
import { contactDisplay } from "@/lib/people";
import { UserAvatar } from "@/components/UserAvatar";

// Read-only invite screen built on the existing People list. No device-contact access, no writes
// to people/linking. The invite target is the app's own origin (no dedicated invite URL exists yet).
const INVITE_URL = typeof window !== "undefined" ? window.location.origin : "";

async function shareInvite(text: string, title = "Join me on CashFlow") {
  const data = { title, text, url: INVITE_URL };
  // Native share sheet where available (mobile); otherwise copy the link + toast.
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share(data);
    } catch {
      // User dismissed the share sheet — nothing to do.
    }
    return;
  }
  try {
    await navigator.clipboard.writeText(`${text} ${INVITE_URL}`);
    toast("Link copied");
  } catch {
    toast.error("Couldn't copy the invite link");
  }
}

export default function SettingsInvite() {
  const { data: people = [] } = useQuery(peopleQuery());
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const rows = (people as any[]).map((p) => ({ p, display: contactDisplay(p) }));
    if (!term) return rows;
    return rows.filter(
      ({ p, display }) =>
        display.name.toLowerCase().includes(term) ||
        (p.name ?? "").toLowerCase().includes(term) ||
        (p.nickname ?? "").toLowerCase().includes(term),
    );
  }, [people, q]);

  return (
    <div className="min-h-screen pb-24" style={{ background: "var(--background)" }}>
      {/* Header */}
      <div className="flex items-center gap-3" style={{ padding: "16px" }}>
        <Link to="/settings" aria-label="Back" className="text-muted-foreground shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold text-foreground">Invite a friend</h1>
      </div>

      {/* Search + share, one row */}
      <div className="flex items-center gap-2 px-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search people"
            aria-label="Search people"
            className="w-full rounded-full bg-card border border-border py-2.5 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <button
          type="button"
          onClick={() =>
            shareInvite("Track expenses and split bills with me on CashFlow", "Join me on CashFlow")
          }
          aria-label="Share invite link"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-white active:opacity-80"
        >
          <Share2 className="h-5 w-5" />
        </button>
      </div>

      {/* Your people */}
      <p className="px-4 pt-6 pb-2 text-xs uppercase tracking-wider text-muted-foreground">
        Your people
      </p>

      {(people as any[]).length === 0 ? (
        <div className="px-4">
          <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Add people in the Split tab to invite them here
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="px-4">
          <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            No people found
          </div>
        </div>
      ) : (
        <div className="divide-y divide-border border-y border-border">
          {filtered.map(({ p, display }) => {
            const linked = !!p.linked_user_id;
            return (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                <UserAvatar url={display.avatarUrl} name={display.name} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{display.name}</p>
                  {p.phone_number && (
                    <p className="truncate text-xs text-muted-foreground">{p.phone_number}</p>
                  )}
                </div>
                {linked ? (
                  <span className="shrink-0 text-xs text-muted-foreground">Already on CashFlow</span>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      shareInvite(
                        `Hi ${display.name}, join me on CashFlow so we can track expenses and split bills together.`,
                      )
                    }
                    className="shrink-0 text-sm font-semibold text-primary active:opacity-70"
                  >
                    Invite
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
