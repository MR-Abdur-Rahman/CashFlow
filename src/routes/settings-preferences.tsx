import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { profileQuery } from "@/lib/queries";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CURRENCY_PRESETS, setMoneyFormat } from "@/lib/format";
import { SettingsHeader, Section } from "@/components/SettingsRows";
import { cn } from "@/lib/utils";
import { Sun, Moon } from "lucide-react";

export default function PreferencesPage() {
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | undefined>();
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id));
  }, []);
  const { data: profile } = useQuery(profileQuery(userId));
  const theme = (profile as any)?.theme ?? "light";
  const currencyCode = (profile as any)?.currency_code ?? "LKR";
  const thousand = (profile as any)?.thousand_separator ?? ",";
  const decimals = (profile as any)?.decimal_places ?? 2;

  const updateProfile = useMutation({
    mutationFn: async (patch: Record<string, any>) => {
      if (!userId) throw new Error("Not signed in");
      const { error } = await supabase
        .from("profiles")
        .update(patch as any)
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
    onError: (e) => toast.error(e.message),
  });

  // Apply the theme to <html> instantly (global) + persist; PrefsApplier re-confirms on load.
  function chooseTheme(next: "dark" | "light") {
    const root = document.documentElement;
    root.classList.toggle("dark", next === "dark");
    root.classList.toggle("light", next === "light");
    root.style.colorScheme = next;
    updateProfile.mutate({ theme: next });
  }

  function pickCurrency(code: string) {
    const preset = CURRENCY_PRESETS.find((c) => c.code === code) ?? CURRENCY_PRESETS[0];
    const patch = {
      currency_code: preset.code,
      currency_symbol: preset.symbol,
      thousand_separator: preset.sep,
      decimal_places: preset.decimals,
    };
    setMoneyFormat({
      symbol: preset.symbol,
      thousandSeparator: preset.sep,
      decimalPlaces: preset.decimals,
    });
    updateProfile.mutate(patch);
  }

  return (
    <div className="px-4 pt-6 pb-24 space-y-6">
      <SettingsHeader title="Preferences" />

      {/* Appearance — Light | Dark segmented toggle */}
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2 px-1 font-medium">
          Appearance
        </p>
        <div className="flex rounded-xl bg-secondary p-1 gap-1">
          <button
            type="button"
            onClick={() => chooseTheme("light")}
            className={cn(
              "flex-1 rounded-lg py-2 text-sm font-medium transition-colors flex items-center justify-center gap-2",
              theme === "light" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            <Sun className="h-4 w-4" /> Light
          </button>
          <button
            type="button"
            onClick={() => chooseTheme("dark")}
            className={cn(
              "flex-1 rounded-lg py-2 text-sm font-medium transition-colors flex items-center justify-center gap-2",
              theme === "dark" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            <Moon className="h-4 w-4" /> Dark
          </button>
        </div>
      </div>

      <Section label="Currency format">
        <div className="p-4 space-y-4">
          <div className="space-y-1.5">
            <Label>Currency</Label>
            <Select value={currencyCode} onValueChange={pickCurrency}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCY_PRESETS.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.code} — {c.symbol}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Thousand separator</Label>
            <Select
              value={thousand}
              onValueChange={(v) => {
                setMoneyFormat({ thousandSeparator: v as any });
                updateProfile.mutate({ thousand_separator: v });
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value=",">Comma (1,234)</SelectItem>
                <SelectItem value=".">Period (1.234)</SelectItem>
                <SelectItem value=" ">Space (1 234)</SelectItem>
                <SelectItem value="">None (1234)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Decimal places</Label>
            <Select
              value={String(decimals)}
              onValueChange={(v) => {
                setMoneyFormat({ decimalPlaces: Number(v) });
                updateProfile.mutate({ decimal_places: Number(v) });
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[0, 1, 2, 3].map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Section>
    </div>
  );
}
