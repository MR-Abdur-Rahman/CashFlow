import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowLeft, Search, Share2, Contact } from "lucide-react";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import { peopleQuery, contactPhonesQuery } from "@/lib/queries";
import { INVITE_URL } from "@/lib/config";
import { contactDisplay } from "@/lib/people";
import { UserAvatar } from "@/components/UserAvatar";
import { DeviceContactsInvite } from "@/components/DeviceContactsInvite";

// Read-only invite screen built on the existing People list. No device-contact access, no writes
// to people/linking. Invites point at the canonical app URL's auth screen (see lib/config).
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
  const { data: contactPhones } = useQuery(
    contactPhonesQuery((people as any[]).map((p) => p.linked_user_id)),
  );
  const [q, setQ] = useState("");

  // Browser Contact Picker — on-demand (Chrome for Android). No standing permission; the OS shows
  // its own picker each time. Lets you invite someone from your phone book who isn't in the app yet.
  const contactPickerSupported =
    typeof navigator !== "undefined" &&
    "contacts" in navigator &&
    "select" in (navigator as any).contacts;

  async function pickFromContacts() {
    try {
      const picked = await (navigator as any).contacts.select(["name", "tel"], { multiple: false });
      const c = picked?.[0];
      if (!c) return;
      const name = ((c.name?.[0] as string) ?? "").trim() || "there";
      const tel = ((c.tel?.[0] as string) ?? "").replace(/[^\d]/g, "");
      const text = `Hi ${name}, join me on CashFlow so we can track expenses and split bills together.`;
      if (tel) {
        window.open(
          `https://wa.me/${tel}?text=${encodeURIComponent(`${text} ${INVITE_URL}`)}`,
          "_blank",
        );
      } else {
        shareInvite(text);
      }
    } catch {
      // Cancelled or blocked — nothing to do.
    }
  }

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

      {/* Search + share, one row — matches the Split page ListToolbar (search + square button). */}
      <div className="flex items-center gap-2 px-4">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search people"
            aria-label="Search people"
            className="w-full rounded-lg bg-secondary py-2 pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
        <button
          type="button"
          onClick={() =>
            shareInvite("Track expenses and split bills with me on CashFlow", "Join me on CashFlow")
          }
          aria-label="Share invite link"
          className="h-10 w-10 shrink-0 rounded-lg bg-primary text-white grid place-items-center active:opacity-80"
        >
          <Share2 className="h-5 w-5" />
        </button>
      </div>

      {Capacitor.isNativePlatform() ? (
        // Native app: the full device contact list, each with a per-contact send window.
        <DeviceContactsInvite query={q} />
      ) : (
        <>
          {/* Web: pick from contacts (Chrome for Android) is on-demand; else the app People list. */}
          {contactPickerSupported && (
            <div className="px-4 pt-3">
              <button
                type="button"
                onClick={pickFromContacts}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-secondary py-2.5 text-sm font-medium active:opacity-80"
              >
                <Contact className="h-4 w-4" /> Pick from contacts
              </button>
            </div>
          )}

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
            const phone = linked ? (contactPhones?.get(p.linked_user_id) ?? null) : p.phone_number;
            return (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                <UserAvatar url={display.avatarUrl} name={display.name} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{display.name}</p>
                  {phone && <p className="truncate text-xs text-muted-foreground">{phone}</p>}
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
        </>
      )}
    </div>
  );
}
