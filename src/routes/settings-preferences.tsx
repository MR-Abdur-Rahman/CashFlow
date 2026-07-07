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
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CURRENCY_PRESETS, setMoneyFormat } from "@/lib/format";
import { CurrencyPicker } from "@/components/CurrencyPicker";
import { SettingsHeader, Section } from "@/components/SettingsRows";
import { cn } from "@/lib/utils";
import { Sun, Moon, Check, ChevronRight } from "lucide-react";

const REMINDER_LABELS: Record<string, string> = {
  cashflow: "CashFlow notification",
  whatsapp: "WhatsApp message",
  telegram: "Telegram message",
  sms: "SMS message",
};
// One external channel can be paired with the CashFlow notification. SMS is disabled until an SMS
// provider is set up.
const REMINDER_EXTERNALS = [
  { m: "whatsapp", label: "WhatsApp message", disabled: false },
  { m: "telegram", label: "Telegram message", disabled: false },
  { m: "sms", label: "SMS message", disabled: true },
] as const;

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
  const reminderMethods = ((profile as any)?.reminder_methods ?? ["cashflow"]) as string[];
  const reminderSummary =
    reminderMethods.map((m) => REMINDER_LABELS[m] ?? m).join(", ") || "None selected";

  // Row → sheet pattern. CashFlow is independent; at most one external channel may be paired with it.
  // Selection is staged in `methodDraft` and only committed on Save.
  const [methodSheet, setMethodSheet] = useState(false);
  const [methodDraft, setMethodDraft] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (methodSheet) setMethodDraft(new Set(reminderMethods));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [methodSheet]);

  function toggleCashflow() {
    setMethodDraft((prev) => {
      const next = new Set(prev);
      if (next.has("cashflow")) next.delete("cashflow");
      else next.add("cashflow");
      return next;
    });
  }
  function selectExternal(m: string) {
    setMethodDraft((prev) => {
      const next = new Set(prev);
      const wasOn = next.has(m);
      for (const e of REMINDER_EXTERNALS) next.delete(e.m); // only one external at a time
      if (!wasOn) next.add(m);
      return next;
    });
  }
  function saveMethods() {
    updateProfile.mutate({ reminder_methods: [...methodDraft] });
    setMethodSheet(false);
  }

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

  function pickCurrency(preset: (typeof CURRENCY_PRESETS)[number]) {
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
            <CurrencyPicker value={currencyCode} onSelect={pickCurrency} />
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

      <Section label="Reminders">
        <button
          type="button"
          onClick={() => setMethodSheet(true)}
          className="flex w-full items-center gap-4 p-4 text-left active:bg-secondary/40"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Send reminders via</p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{reminderSummary}</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </button>
      </Section>

      <Sheet open={methodSheet} onOpenChange={setMethodSheet}>
        <SheetContent side="bottom" className="flex flex-col">
          <SheetHeader>
            <SheetTitle>Send reminders via</SheetTitle>
          </SheetHeader>
          <div className="mt-3 -mx-6">
            {/* CashFlow notification — independent checkbox */}
            <button
              type="button"
              onClick={toggleCashflow}
              className="flex w-full items-center gap-3 px-6 py-3 active:bg-secondary/40"
            >
              <span className="flex-1 text-left text-sm">{REMINDER_LABELS.cashflow}</span>
              <span
                className={cn(
                  "grid h-5 w-5 place-items-center rounded-md border",
                  methodDraft.has("cashflow")
                    ? "bg-primary border-primary text-white"
                    : "border-border",
                )}
              >
                {methodDraft.has("cashflow") && <Check className="h-3.5 w-3.5" />}
              </span>
            </button>

            {/* One external channel (single-select) */}
            <p className="px-6 pt-3 pb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
              Also reach them on (choose one)
            </p>
            {REMINDER_EXTERNALS.map((ext) => {
              const on = methodDraft.has(ext.m);
              return (
                <button
                  key={ext.m}
                  type="button"
                  disabled={ext.disabled}
                  onClick={() => selectExternal(ext.m)}
                  className={cn(
                    "flex w-full items-center gap-3 px-6 py-3",
                    ext.disabled ? "opacity-50" : "active:bg-secondary/40",
                  )}
                >
                  <span className="flex-1 text-left text-sm">
                    {ext.label}
                    {ext.disabled && <span className="text-muted-foreground"> · coming soon</span>}
                  </span>
                  <span
                    className={cn(
                      "grid h-5 w-5 place-items-center rounded-full border",
                      on ? "bg-primary border-primary text-white" : "border-border",
                    )}
                  >
                    {on && <Check className="h-3.5 w-3.5" />}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="px-0 pt-2 text-xs text-muted-foreground">
            Pick the CashFlow notification and, optionally, one outside channel to also send through.
          </p>
          <div className="pt-3">
            <Button className="w-full" onClick={saveMethods}>
              Save
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
