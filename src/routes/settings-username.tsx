import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X, Loader2, AtSign } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { profileQuery } from "@/lib/queries";
import { SettingsHeader } from "@/components/SettingsRows";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { setUsername, usernameAvailable, usernameFormatError, USERNAME_RE } from "@/lib/connections";

type Status = "idle" | "checking" | "available" | "taken" | "invalid";

export default function UsernameSettingsPage() {
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string>();
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id));
  }, []);
  const { data: profile } = useQuery(profileQuery(userId));

  const current = (profile as any)?.username ?? "";
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [saving, setSaving] = useState(false);
  const [discoverable, setDiscoverable] = useState(true);

  // Seed from the loaded profile once.
  useEffect(() => {
    if (profile) {
      setValue(current);
      setDiscoverable((profile as any).discoverable_by_username ?? true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const normalized = value.trim().toLowerCase();
  const unchanged = normalized === current;
  const formatErr = usernameFormatError(normalized);

  // Debounced availability check.
  useEffect(() => {
    if (!normalized || unchanged) {
      setStatus("idle");
      return;
    }
    if (formatErr) {
      setStatus("invalid");
      return;
    }
    setStatus("checking");
    const h = setTimeout(async () => {
      try {
        setStatus((await usernameAvailable(normalized)) ? "available" : "taken");
      } catch {
        setStatus("idle");
      }
    }, 350);
    return () => clearTimeout(h);
  }, [normalized, unchanged, formatErr]);

  async function saveUsername() {
    if (!USERNAME_RE.test(normalized) || status !== "available") return;
    setSaving(true);
    try {
      await setUsername(normalized);
      toast.success("Username saved");
      qc.invalidateQueries({ queryKey: ["profile"] });
    } catch (e: any) {
      toast.error(e.message ?? "Couldn't save username");
    } finally {
      setSaving(false);
    }
  }

  async function toggleDiscoverable(next: boolean) {
    setDiscoverable(next);
    const { error } = await supabase
      .from("profiles")
      .update({ discoverable_by_username: next } as never)
      .eq("id", userId!);
    if (error) {
      setDiscoverable(!next);
      toast.error(error.message);
    } else {
      qc.invalidateQueries({ queryKey: ["profile"] });
    }
  }

  return (
    <div className="px-4 pt-6 pb-24 space-y-6">
      <SettingsHeader title="Username" back="/settings/account" />

      <div className="space-y-2">
        <p className="text-sm font-medium">Your username</p>
        <p className="text-xs text-muted-foreground">
          A public handle others can use to find and connect with you. Lowercase letters, numbers and
          underscores, 3–20 characters.
        </p>
        <div className="relative">
          <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="w-full rounded-lg border border-border bg-card py-2.5 pl-9 pr-10 text-sm text-foreground outline-none focus:border-primary"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            {status === "checking" && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
            {status === "available" && <Check className="h-4 w-4 text-income" />}
            {(status === "taken" || status === "invalid") && <X className="h-4 w-4 text-expense" />}
          </span>
        </div>

        {status === "invalid" && formatErr && (
          <p className="text-xs text-expense">{formatErr}</p>
        )}
        {status === "taken" && <p className="text-xs text-expense">That username is taken.</p>}
        {status === "available" && <p className="text-xs text-income">Available.</p>}
        {current && unchanged && (
          <p className="text-xs text-muted-foreground">
            Current: <span className="font-medium text-foreground">@{current}</span>
          </p>
        )}

        <Button
          className="w-full mt-1"
          disabled={saving || status !== "available"}
          onClick={saveUsername}
        >
          {saving ? "Saving…" : current ? "Update username" : "Set username"}
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 flex items-center justify-between">
        <div className="pr-3">
          <p className="text-sm font-medium">Discoverable by username</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Let others find you when they search your username.
          </p>
        </div>
        <Switch
          checked={discoverable}
          onCheckedChange={toggleDiscoverable}
          disabled={!userId}
        />
      </div>
    </div>
  );
}
