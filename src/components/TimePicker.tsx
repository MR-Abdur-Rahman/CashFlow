import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// "HH:mm" (24h) → 12-hour parts.
function to12(v: string) {
  const [H, M] = (v || "08:00").split(":").map(Number);
  return { h12: ((H + 11) % 12) + 1, m: M, period: (H >= 12 ? "PM" : "AM") as "AM" | "PM" };
}
export function formatTime12(v: string) {
  const { h12, m, period } = to12(v);
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5); // 5-minute steps

// Design-system time picker with an explicit AM/PM toggle (native <input type=time> hides AM/PM on
// 24-hour devices). Stores/emits "HH:mm" in 24-hour form.
export function TimePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [hh, setHh] = useState(8);
  const [mm, setMm] = useState(0);
  const [period, setPeriod] = useState<"AM" | "PM">("AM");

  useEffect(() => {
    if (open) {
      const t = to12(value);
      setHh(t.h12);
      setMm((Math.round(t.m / 5) * 5) % 60);
      setPeriod(t.period);
    }
  }, [open, value]);

  function save() {
    let H = hh % 12; // 12 → 0
    if (period === "PM") H += 12;
    onChange(`${String(H).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-secondary px-3 py-1.5 text-sm font-mono text-foreground active:opacity-80"
      >
        {formatTime12(value)}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xs">
          <DialogTitle>Reminder time</DialogTitle>
          <div className="flex items-center justify-center gap-2 py-2">
            <Select value={String(hh)} onValueChange={(v) => setHh(Number(v))}>
              <SelectTrigger className="w-16">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HOURS.map((h) => (
                  <SelectItem key={h} value={String(h)}>
                    {h}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-lg font-semibold">:</span>
            <Select value={String(mm)} onValueChange={(v) => setMm(Number(v))}>
              <SelectTrigger className="w-16">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MINUTES.map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {String(m).padStart(2, "0")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="ml-1 flex rounded-lg bg-secondary p-1">
              {(["AM", "PM"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    period === p ? "bg-primary text-white" : "text-muted-foreground",
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <Button className="w-full" onClick={save}>
            Save
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
