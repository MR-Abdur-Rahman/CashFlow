import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { CountryPickerSheet } from "@/components/CountryPickerSheet";
import { CURRENCY_PRESETS, currencyFlag, type CurrencyPreset } from "@/lib/format";

// Row that opens a searchable, alphabetical currency list (shared CountryPickerSheet UI). Each entry
// shows the country flag, the country name and the currency symbol/code. Selecting one applies it
// immediately and closes.
export function CurrencyPicker({
  value,
  onSelect,
}: {
  value: string;
  onSelect: (p: CurrencyPreset) => void;
}) {
  const [open, setOpen] = useState(false);

  const current = CURRENCY_PRESETS.find((c) => c.code === value) ?? CURRENCY_PRESETS[0];

  const items = useMemo(
    () =>
      CURRENCY_PRESETS.map((c) => ({
        key: c.code,
        flag: currencyFlag(c.country),
        name: `${c.name} (${c.symbol})`,
        trailing: c.code,
      })),
    [],
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-left active:bg-secondary/40"
      >
        <span className="text-xl leading-none">{currencyFlag(current.country)}</span>
        <span className="flex-1 min-w-0 truncate text-sm">
          {current.name} ({current.symbol})
        </span>
        <span className="text-xs text-muted-foreground font-mono">{current.code}</span>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </button>

      <CountryPickerSheet
        open={open}
        onOpenChange={setOpen}
        title="Choose currency"
        searchPlaceholder="Search currency or country"
        items={items}
        selectedKey={value}
        onSelect={(code) => {
          const p = CURRENCY_PRESETS.find((c) => c.code === code);
          if (p) onSelect(p);
        }}
      />
    </>
  );
}
