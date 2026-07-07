import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Contacts } from "@capacitor-community/contacts";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/UserAvatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { INVITE_URL } from "@/lib/config";

type DeviceContact = { id: string; name: string; number: string | null };

// One outside channel at a time. SMS is disabled until there's an SMS path.
const CHANNELS = [
  { m: "whatsapp", label: "WhatsApp", disabled: false },
  { m: "telegram", label: "Telegram", disabled: false },
  { m: "sms", label: "SMS", disabled: true },
] as const;

// Native-only: reads the full device contact list and lets you invite anyone, one channel at a time.
export function DeviceContactsInvite({ query }: { query: string }) {
  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ["device-contacts"],
    retry: false,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<DeviceContact[]> => {
      let perm = await Contacts.checkPermissions();
      if (perm.contacts !== "granted" && perm.contacts !== "limited") {
        perm = await Contacts.requestPermissions();
      }
      if (perm.contacts !== "granted" && perm.contacts !== "limited") {
        throw new Error(
          "Contacts permission is off. Turn it on in Settings › Apps › CashFlow › Permissions, then retry.",
        );
      }
      const { contacts } = await Contacts.getContacts({
        projection: { name: true, phones: true },
      });
      return (contacts ?? [])
        .map((c: any) => ({
          id: c.contactId,
          name: (c.name?.display ?? "").trim() || "Unknown",
          number: c.phones?.[0]?.number ?? null,
        }))
        .sort((a: DeviceContact, b: DeviceContact) => a.name.localeCompare(b.name));
    },
  });

  const [target, setTarget] = useState<DeviceContact | null>(null);

  const filtered = useMemo(() => {
    const t = query.trim().toLowerCase();
    const rows = data ?? [];
    if (!t) return rows;
    return rows.filter((c) => c.name.toLowerCase().includes(t) || (c.number ?? "").includes(t));
  }, [data, query]);

  if (error) {
    return (
      <div className="px-4 pt-6">
        <div className="space-y-3 rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Couldn't load your contacts</p>
          <p className="break-words text-xs">
            {(error as Error)?.message || "Unknown error"}
          </p>
          <Button size="sm" disabled={isRefetching} onClick={() => refetch()}>
            {isRefetching ? "Retrying…" : "Retry"}
          </Button>
        </div>
      </div>
    );
  }
  if (isLoading) {
    return <p className="px-4 py-8 text-center text-sm text-muted-foreground">Loading contacts…</p>;
  }

  return (
    <>
      <p className="px-4 pt-6 pb-2 text-xs uppercase tracking-wider text-muted-foreground">
        Contacts
      </p>
      {filtered.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">No contacts found</p>
      ) : (
        <div className="divide-y divide-border border-y border-border">
          {filtered.map((c) => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-3">
              <UserAvatar name={c.name} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{c.name}</p>
                {c.number && <p className="truncate text-xs text-muted-foreground">{c.number}</p>}
              </div>
              <button
                type="button"
                aria-label={`Invite ${c.name}`}
                onClick={() => setTarget(c)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-white active:opacity-80"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <ContactInviteSheet contact={target} onClose={() => setTarget(null)} />
    </>
  );
}

function ContactInviteSheet({
  contact,
  onClose,
}: {
  contact: DeviceContact | null;
  onClose: () => void;
}) {
  const [channel, setChannel] = useState<string>("whatsapp");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (contact) {
      setChannel("whatsapp");
      setMessage(
        `Hi ${contact.name}, join me on CashFlow so we can track expenses and split bills together.`,
      );
    }
  }, [contact]);

  function send() {
    if (!contact) return;
    if (channel === "whatsapp") {
      const num = (contact.number ?? "").replace(/[^\d]/g, "");
      if (!num) return toast.error("This contact has no phone number for WhatsApp");
      window.open(
        `https://wa.me/${num}?text=${encodeURIComponent(`${message} ${INVITE_URL}`)}`,
        "_blank",
      );
    } else if (channel === "telegram") {
      window.open(
        `https://t.me/share/url?url=${encodeURIComponent(INVITE_URL)}&text=${encodeURIComponent(message)}`,
        "_blank",
      );
    }
    onClose();
  }

  return (
    <Sheet open={!!contact} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="flex flex-col">
        <SheetHeader>
          <SheetTitle>Invite {contact?.name}</SheetTitle>
        </SheetHeader>

        <div className="mt-3 space-y-4">
          <Textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />

          <div className="-mx-6">
            <p className="px-6 pb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
              Send via (choose one)
            </p>
            {CHANNELS.map((ch) => {
              const on = channel === ch.m;
              return (
                <button
                  key={ch.m}
                  type="button"
                  disabled={ch.disabled}
                  onClick={() => setChannel(ch.m)}
                  className={cn(
                    "flex w-full items-center gap-3 px-6 py-3",
                    ch.disabled ? "opacity-50" : "active:bg-secondary/40",
                  )}
                >
                  <span className="flex-1 text-left text-sm">
                    {ch.label}
                    {ch.disabled && <span className="text-muted-foreground"> · coming soon</span>}
                  </span>
                  <span
                    className={cn(
                      "grid h-5 w-5 place-items-center rounded-full border",
                      on ? "bg-primary border-primary text-white" : "border-border",
                    )}
                  >
                    {on && <span className="h-2 w-2 rounded-full bg-white" />}
                  </span>
                </button>
              );
            })}
          </div>

          <Button className="w-full" onClick={send}>
            <Send className="h-4 w-4 mr-2" /> Send
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
