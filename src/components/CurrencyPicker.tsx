import { useMemo, useState } from "react";
import { Search, Check, ChevronRight } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CURRENCY_PRESETS, currencyFlag, type CurrencyPreset } from "@/lib/format";

// Row that opens a searchable, alphabetical currency list. Each entry shows the country flag, the
// country name and the currency symbol. Selecting one applies it immediately and closes.
export function CurrencyPicker({
  value,
  onSelect,
}: {
  value: string;
  onSelect: (p: CurrencyPreset) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const current = CURRENCY_PRESETS.find((c) => c.code === value) ?? CURRENCY_PRESETS[0];

  const sorted = useMemo(
    () => [...CURRENCY_PRESETS].sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return sorted;
    return sorted.filter(
      (c) =>
        c.name.toLowerCase().includes(t) ||
        c.code.toLowerCase().includes(t) ||
        c.symbol.toLowerCase().includes(t),
    );
  }, [sorted, q]);

  function choose(c: CurrencyPreset) {
    onSelect(c);
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setQ("");
          setOpen(true);
        }}
        className="flex w-full items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-left active:bg-secondary/40"
      >
        <span className="text-xl leading-none">{currencyFlag(current.country)}</span>
        <span className="flex-1 min-w-0 truncate text-sm">
          {current.name} ({current.symbol})
        </span>
        <span className="text-xs text-muted-foreground font-mono">{current.code}</span>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="h-[85vh] flex flex-col">
          <SheetHeader>
            <SheetTitle>Choose currency</SheetTitle>
          </SheetHeader>

          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search currency or country"
              aria-label="Search currency"
              autoFocus
              className="w-full rounded-lg bg-secondary py-2 pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>

          <div className="mt-3 flex-1 overflow-y-auto -mx-6">
            {filtered.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-muted-foreground">No currencies found</p>
            ) : (
              filtered.map((c) => {
                const on = c.code === value;
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => choose(c)}
                    className="flex w-full items-center gap-3 px-6 py-3 text-left active:bg-secondary/40"
                  >
                    <span className="text-xl leading-none">{currencyFlag(c.country)}</span>
                    <span className="flex-1 min-w-0 truncate text-sm">
                      {c.name} ({c.symbol})
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">{c.code}</span>
                    {on && <Check className="h-4 w-4 text-primary shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
