import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

// Calendar-style day-of-month picker: a button showing the chosen day opens a 7-column grid (like a
// month calendar) to pick 1-31. Recurring, so there's no specific month/year — just the day number.
export function DayOfMonthPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (d: number) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-md bg-secondary px-3 py-1.5 text-sm text-foreground active:opacity-80"
      >
        <CalendarDays className="h-4 w-4 text-muted-foreground" />
        Day {value}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xs">
          <DialogTitle>Day of month</DialogTitle>
          <div className="grid grid-cols-7 gap-1.5">
            {DAYS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => {
                  onChange(d);
                  setOpen(false);
                }}
                className={cn(
                  "flex aspect-square items-center justify-center rounded-lg text-sm tabular-nums transition-colors",
                  value === d
                    ? "bg-primary font-semibold text-white"
                    : "bg-secondary text-foreground active:opacity-80",
                )}
              >
                {d}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Months without this day use their last day.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
