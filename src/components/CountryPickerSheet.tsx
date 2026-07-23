import { useEffect, useMemo, useState } from "react";
import { Search, Check } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

// A searchable, alphabetical bottom-sheet list of countries. Each row: flag + name + an optional
// trailing label (currency code, dial code, …) + a check on the selected one. Shared by CurrencyPicker
// and the phone-number country/dial-code picker so both use the exact same UI.
export type CountryPickerItem = {
  key: string; // stable identity + selection value
  flag: string;
  name: string;
  trailing?: string; // e.g. "LKR" or "+94"
};

export function CountryPickerSheet({
  open,
  onOpenChange,
  title,
  searchPlaceholder,
  items,
  selectedKey,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  searchPlaceholder: string;
  items: CountryPickerItem[];
  selectedKey?: string;
  onSelect: (key: string) => void;
}) {
  const [q, setQ] = useState("");

  // Reset the query each time the sheet opens.
  useEffect(() => {
    if (open) setQ("");
  }, [open]);

  const sorted = useMemo(() => [...items].sort((a, b) => a.name.localeCompare(b.name)), [items]);
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return sorted;
    return sorted.filter(
      (c) =>
        c.name.toLowerCase().includes(t) ||
        c.key.toLowerCase().includes(t) ||
        (c.trailing ?? "").toLowerCase().includes(t),
    );
  }, [sorted, q]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] flex flex-col">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>

        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            autoFocus
            className="w-full rounded-lg bg-secondary py-2 pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div className="mt-3 flex-1 overflow-y-auto -mx-6">
          {filtered.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">No results found</p>
          ) : (
            filtered.map((c) => {
              const on = c.key === selectedKey;
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => {
                    onSelect(c.key);
                    onOpenChange(false);
                  }}
                  className="flex w-full items-center gap-3 px-6 py-3 text-left active:bg-secondary/40"
                >
                  <span className="text-xl leading-none">{c.flag}</span>
                  <span className="flex-1 min-w-0 truncate text-sm">{c.name}</span>
                  {c.trailing && (
                    <span className="text-xs text-muted-foreground font-mono">{c.trailing}</span>
                  )}
                  {on && <Check className="h-4 w-4 text-primary shrink-0" />}
                </button>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
