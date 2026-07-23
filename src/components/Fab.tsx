import { useRef, useState } from "react";
import { Plus, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Split } from "lucide-react";
import { cn } from "@/lib/utils";

export type TxnTab = "income" | "expense" | "transfer" | "split";

// Hold at least this long to reveal the radial quick-action fan instead of a normal tap.
const LONG_PRESS_MS = 300;
// Distance of each fan icon's centre from the FAB centre.
const RADIUS = 108;
// A release within this distance of a fan icon's centre counts as selecting it.
const HIT = 36;

// The 4 transaction types, fanned from 9 o'clock (left) up to 12 o'clock (top), colour-coded to match
// the Add Transaction tabs used across the app. dx/dy are screen offsets from the FAB centre
// (y grows downward, so "up" is negative).
const FAN: { key: TxnTab; icon: typeof Plus; color: string; dx: number; dy: number }[] = [
  { key: "income", icon: ArrowDownLeft, color: "var(--income)", dx: -RADIUS, dy: 0 }, // 180°
  { key: "expense", icon: ArrowUpRight, color: "var(--expense)", dx: -94, dy: -54 }, // 150°
  { key: "transfer", icon: ArrowLeftRight, color: "var(--transfer)", dx: -54, dy: -94 }, // 120°
  { key: "split", icon: Split, color: "var(--split)", dx: 0, dy: -RADIUS }, // 90°
];

// Floating add button. A quick tap (< 0.3s) opens the Add Transaction sheet on its default tab; a
// short hold blooms a radial fan of the 4 transaction types — slide onto one and release to open the
// sheet straight on that tab, release elsewhere to dismiss.
export function Fab({ onSelect }: { onSelect: (tab: TxnTab) => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [hovered, setHovered] = useState<TxnTab | null>(null);
  const fabRef = useRef<HTMLButtonElement | null>(null);
  const timer = useRef<number | null>(null);
  const longFired = useRef(false);

  function clearTimer() {
    if (timer.current != null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }

  // Which fan icon (if any) is under a screen point — for hover highlight and release selection.
  function pick(x: number, y: number): TxnTab | null {
    const el = fabRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    for (const item of FAN) {
      if (Math.hypot(x - (cx + item.dx), y - (cy + item.dy)) <= HIT) return item.key;
    }
    return null;
  }

  function handleDown(e: React.PointerEvent<HTMLButtonElement>) {
    longFired.current = false;
    e.currentTarget.setPointerCapture?.(e.pointerId); // keep moves/up on the FAB while dragging
    clearTimer();
    timer.current = window.setTimeout(() => {
      longFired.current = true;
      navigator.vibrate?.(15); // subtle haptic on Android when the fan pops
      setMenuOpen(true);
    }, LONG_PRESS_MS);
  }

  function handleMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (!menuOpen) return;
    setHovered(pick(e.clientX, e.clientY));
  }

  function handleUp(e: React.PointerEvent<HTMLButtonElement>) {
    clearTimer();
    if (!longFired.current) {
      // Quick tap → open the sheet on its default tab (unchanged behaviour).
      onSelect("expense");
      return;
    }
    // Fan was open: release onto an icon selects it; release elsewhere dismisses.
    const key = pick(e.clientX, e.clientY);
    setMenuOpen(false);
    setHovered(null);
    if (key) onSelect(key);
  }

  function handleCancel() {
    clearTimer();
    setMenuOpen(false);
    setHovered(null);
  }

  return (
    <div
      className={cn(
        "fixed bottom-20 right-1/2 h-14 w-14 translate-x-[200px] md:translate-x-[185px]",
        menuOpen ? "z-50" : "z-30",
      )}
    >
      {/* Radial fan icons — purely visual; selection is resolved from the FAB's captured pointer. */}
      {FAN.map((item, i) => {
        const Icon = item.icon;
        const on = hovered === item.key;
        return (
          <div
            key={item.key}
            aria-hidden="true"
            className="fab-shadow pointer-events-none absolute left-1/2 top-1/2 grid h-12 w-12 place-items-center rounded-full text-white"
            style={{
              background: item.color,
              opacity: menuOpen ? 1 : 0,
              transform: menuOpen
                ? `translate(calc(-50% + ${item.dx}px), calc(-50% + ${item.dy}px)) scale(${on ? 1.18 : 1})`
                : "translate(-50%, -50%) scale(0.4)",
              transition: `transform 0.2s ease-out ${i * 25}ms, opacity 0.18s ease-out ${i * 25}ms`,
              boxShadow: on ? "0 0 0 3px rgba(255,255,255,0.6)" : undefined,
            }}
          >
            <Icon className="h-5 w-5" />
          </div>
        );
      })}

      {/* The FAB itself */}
      <button
        ref={fabRef}
        type="button"
        aria-label="Add transaction"
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={handleCancel}
        onContextMenu={(e) => e.preventDefault()}
        style={{
          touchAction: "none",
          userSelect: "none",
          WebkitUserSelect: "none",
          WebkitTouchCallout: "none",
        }}
        className="fab-shadow grid h-14 w-14 place-items-center rounded-full bg-primary text-white transition-transform hover:bg-primary/90 active:scale-95"
      >
        <Plus className={cn("h-6 w-6 transition-transform duration-200", menuOpen && "rotate-45")} />
      </button>
    </div>
  );
}
