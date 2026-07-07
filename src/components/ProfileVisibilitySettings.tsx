import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { UserCircle, Search, ChevronRight, Check } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { profileQuery, peopleQuery } from "@/lib/queries";
import { contactDisplay } from "@/lib/people";
import { UserAvatar } from "@/components/UserAvatar";

// Mirrors PhoneVisibilitySettings: toggle to share your profile (name + photo) with contacts, plus
// an "Except these people" list. Same design and storage shape as the phone control.
export function ProfileVisibilitySettings({ userId }: { userId?: string }) {
  const qc = useQueryClient();
  const { data: profile } = useQuery(profileQuery(userId));
  const enabled = profile?.profile_share_enabled ?? true;

  const { data: exceptions = [] } = useQuery({
    queryKey: ["profile-exceptions", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profile_visibility_exceptions")
        .select("excluded_user_id")
        .eq("owner_id", userId);
      if (error) throw error;
      return (data ?? []).map((r: any) => r.excluded_user_id as string);
    },
  });

  const [pickerOpen, setPickerOpen] = useState(false);

  async function setEnabled(v: boolean) {
    if (!userId) return;
    const { error } = await supabase
      .from("profiles")
      .update({ profile_share_enabled: v })
      .eq("id", userId);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["profile"] });
    qc.invalidateQueries({ queryKey: ["contact-profiles"] });
  }

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-4 p-4">
        <UserCircle className="h-5 w-5 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Show my profile</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Let your contacts see your name and photo
          </p>
        </div>
        <Switch checked={enabled} onCheckedChange={setEnabled} />
      </div>

      {enabled && (
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="flex w-full items-center gap-4 border-t border-border p-4 text-left active:bg-secondary/40"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Except these people</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {exceptions.length
                ? `Hidden from ${exceptions.length} ${exceptions.length === 1 ? "person" : "people"}`
                : "Everyone can see it — tap to hide from specific people"}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </button>
      )}

      <HideProfilePeopleSheet
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        userId={userId}
        exceptions={exceptions}
      />
    </div>
  );
}

function HideProfilePeopleSheet({
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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setSelected(new Set(exceptions));
  }, [open, exceptions]);

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

  function toggle(uid: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  }

  async function save() {
    if (!userId) return;
    const current = new Set(exceptions);
    const toAdd = [...selected].filter((id) => !current.has(id));
    const toRemove = [...current].filter((id) => !selected.has(id));
    setSaving(true);
    try {
      if (toRemove.length) {
        const { error } = await supabase
          .from("profile_visibility_exceptions")
          .delete()
          .eq("owner_id", userId)
          .in("excluded_user_id", toRemove);
        if (error) throw error;
      }
      if (toAdd.length) {
        const { error } = await supabase
          .from("profile_visibility_exceptions")
          .insert(toAdd.map((id) => ({ owner_id: userId, excluded_user_id: id })));
        if (error) throw error;
      }
      qc.invalidateQueries({ queryKey: ["profile-exceptions", userId] });
      qc.invalidateQueries({ queryKey: ["contact-profiles"] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[80vh] flex flex-col rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Hide profile from</SheetTitle>
        </SheetHeader>

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
              const on = selected.has(p.linked_user_id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle(p.linked_user_id)}
                  className="flex w-full items-center gap-3 px-6 py-3 active:bg-secondary/40"
                >
                  <UserAvatar url={d.avatarUrl} name={d.name} size={36} />
                  <span className="flex-1 text-left text-sm">{d.name}</span>
                  <span
                    className={`grid h-5 w-5 place-items-center rounded-md border ${
                      on ? "bg-primary border-primary text-white" : "border-border"
                    }`}
                  >
                    {on && <Check className="h-3.5 w-3.5" />}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="pt-3">
          <Button className="w-full" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
