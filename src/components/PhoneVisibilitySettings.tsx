import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Phone, Search, ChevronRight, Check } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { profileQuery, peopleQuery } from "@/lib/queries";
import { contactDisplay } from "@/lib/people";
import { UserAvatar } from "@/components/UserAvatar";

type Scope = "everyone" | "except" | "nobody";

const SCOPES: { v: Scope; label: string; desc: string }[] = [
  { v: "everyone", label: "Everyone", desc: "All your contacts can see your number" },
  { v: "except", label: "Except these people", desc: "Visible to everyone except people you choose" },
  { v: "nobody", label: "Nobody", desc: "Hidden from all your contacts" },
];

export function PhoneVisibilitySettings({ userId }: { userId?: string }) {
  const qc = useQueryClient();
  const { data: profile } = useQuery(profileQuery(userId));
  const enabled = profile?.phone_share_enabled ?? true;
  const scope = (profile?.phone_share_scope ?? "everyone") as Scope;

  const { data: exceptions = [] } = useQuery({
    queryKey: ["phone-exceptions", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("phone_visibility_exceptions")
        .select("excluded_user_id")
        .eq("owner_id", userId);
      if (error) throw error;
      return (data ?? []).map((r: any) => r.excluded_user_id as string);
    },
  });

  const [pickerOpen, setPickerOpen] = useState(false);

  async function patchProfile(patch: Record<string, unknown>) {
    if (!userId) return;
    const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["profile"] });
    // What contacts can see depends on these settings — refresh any resolved contact phones.
    qc.invalidateQueries({ queryKey: ["contact-phones"] });
  }

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Master toggle */}
      <div className="flex items-center gap-4 p-4">
        <Phone className="h-5 w-5 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Show my phone number</p>
          <p className="text-xs text-muted-foreground mt-0.5">Let your contacts see your number</p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={(v) => patchProfile({ phone_share_enabled: v })}
        />
      </div>

      {/* Who can see it */}
      {enabled && (
        <div className="border-t border-border p-4">
          <RadioGroup
            value={scope}
            onValueChange={(v) => patchProfile({ phone_share_scope: v })}
            className="gap-0"
          >
            {SCOPES.map((o) => (
              <label
                key={o.v}
                htmlFor={`scope-${o.v}`}
                className="flex items-start gap-3 py-2 cursor-pointer"
              >
                <RadioGroupItem value={o.v} id={`scope-${o.v}`} className="mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm">{o.label}</p>
                  <p className="text-xs text-muted-foreground">{o.desc}</p>
                </div>
              </label>
            ))}
          </RadioGroup>

          {scope === "except" && (
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="mt-2 flex w-full items-center gap-2 rounded-lg bg-secondary px-3 py-2.5 text-sm active:opacity-80"
            >
              <span className="flex-1 text-left">
                {exceptions.length
                  ? `Hidden from ${exceptions.length} ${exceptions.length === 1 ? "person" : "people"}`
                  : "Choose people to hide from"}
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          )}
        </div>
      )}

      <HidePhonePeopleSheet
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        userId={userId}
        exceptions={exceptions}
      />
    </div>
  );
}

function HidePhonePeopleSheet({
  open,
  onOpenChange,
  userId,
  exceptions,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  userId?: string;
  exceptions: string[];
}) {
  const qc = useQueryClient();
  const { data: people = [] } = useQuery(peopleQuery());
  const [q, setQ] = useState("");

  // Phone sharing only applies to linked CashFlow users, so only they can be excepted.
  const linkedPeople = useMemo(
    () => (people as any[]).filter((p) => p.linked_user_id),
    [people],
  );
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const rows = linkedPeople.map((p) => ({ p, d: contactDisplay(p) }));
    if (!term) return rows;
    return rows.filter(({ d }) => d.name.toLowerCase().includes(term));
  }, [linkedPeople, q]);

  const hiddenSet = new Set(exceptions);

  async function toggle(excludedUserId: string, currentlyHidden: boolean) {
    if (!userId) return;
    const table = supabase.from("phone_visibility_exceptions");
    const { error } = currentlyHidden
      ? await table.delete().eq("owner_id", userId).eq("excluded_user_id", excludedUserId)
      : await table.insert({ owner_id: userId, excluded_user_id: excludedUserId });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["phone-exceptions", userId] });
    qc.invalidateQueries({ queryKey: ["contact-phones"] });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[80vh] flex flex-col">
        <SheetHeader>
          <SheetTitle>Hide number from</SheetTitle>
        </SheetHeader>

        {/* Same search style as the Split / Invite lists */}
        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search people"
            aria-label="Search people"
            className="w-full rounded-lg bg-secondary py-2 pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div className="mt-3 flex-1 overflow-y-auto -mx-6">
          {filtered.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              {linkedPeople.length === 0 ? "No linked CashFlow contacts yet" : "No people found"}
            </p>
          ) : (
            filtered.map(({ p, d }) => {
              const hidden = hiddenSet.has(p.linked_user_id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle(p.linked_user_id, hidden)}
                  className="flex w-full items-center gap-3 px-6 py-3 active:bg-secondary/40"
                >
                  <UserAvatar url={d.avatarUrl} name={d.name} size={36} />
                  <span className="flex-1 text-left text-sm">{d.name}</span>
                  <span
                    className={`grid h-5 w-5 place-items-center rounded-md border ${
                      hidden ? "bg-primary border-primary text-white" : "border-border"
                    }`}
                  >
                    {hidden && <Check className="h-3.5 w-3.5" />}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
