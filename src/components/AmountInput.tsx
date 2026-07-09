import { cn } from "@/lib/utils";

// The big centered amount field used at the top of the Add Transaction forms and the Scheduled
// Transaction sheet. `accent` tints the figure per type (text-income / text-expense / text-transfer).
export function AmountInput({
  value,
  onChange,
  accent,
}: {
  value: string;
  onChange: (v: string) => void;
  accent: string;
}) {
  return (
    <div className="text-center py-4">
      <input
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ""))}
        placeholder="0.00"
        className={cn(
          "w-full bg-transparent text-center text-5xl font-mono font-semibold outline-none",
          accent,
        )}
      />
      <p className="text-xs text-muted-foreground mt-1 font-mono">LKR</p>
    </div>
  );
}
