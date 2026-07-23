import { useRef, useState, type ReactNode } from "react";
import { Plus, Receipt, Split } from "lucide-react";
import { cn } from "@/lib/utils";

// Hold this long to reveal the quick-action menu instead of a normal tap.
const LONG_PRESS_MS = 2000;

// Floating add button. A normal tap opens Add Transaction; a long-press (~2s) reveals quick actions
// for "Add Transaction" and "Add Split". Owns the menu + press detection so App only wires the two
// actions to the shared Add Transaction sheet.
export function Fab({
  onAddTransaction,
  onAddSplit,
}: {
  onAddTransaction: () => void;
  onAddSplit: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const timer = useRef<number | null>(null);
  const longFired = useRef(false);

  function clearTimer() {
    if (timer.current != null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }
  function handleDown() {
    longFired.current = false;
    clearTimer();
    timer.current = window.setTimeout(() => {
      longFired.current = true;
      navigator.vibrate?.(15); // subtle haptic on Android when the menu pops
      setMenuOpen(true);
    }, LONG_PRESS_MS);
  }
  function handleUp() {
    clearTimer();
    // Released before the long-press fired → treat as a tap.
    if (!longFired.current) {
      if (menuOpen) setMenuOpen(false); // tapping the FAB again dismisses the menu
      else onAddTransaction();
    }
  }
  function handleCancel() {
    // Finger left the button / gesture cancelled → abort the long-press, no tap.
    clearTimer();
  }

  return (
    <>
      <style>{`
        @keyframes fab-qa-in {
          from { opacity: 0; transform: translateY(10px) scale(0.85); }
          to   { opacity: 1; transform: none; }
        }
      `}</style>

      {/* Tap-away backdrop while the menu is open */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-40"
          aria-hidden="true"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Quick actions stack above the FAB anchor */}
      <div
        className={cn(
          "fixed bottom-20 right-1/2 flex translate-x-[200px] flex-col items-center gap-3 md:translate-x-[185px]",
          menuOpen ? "z-50" : "z-30",
        )}
      >
        {menuOpen && (
          <>
            <QuickAction
              label="Add Split"
              icon={<Split className="h-5 w-5" />}
              delay={60}
              onClick={() => {
                setMenuOpen(false);
                onAddSplit();
              }}
            />
            <QuickAction
              label="Add Transaction"
              icon={<Receipt className="h-5 w-5" />}
              delay={0}
              onClick={() => {
                setMenuOpen(false);
                onAddTransaction();
              }}
            />
          </>
        )}

        <button
          type="button"
          aria-label="Add transaction"
          onPointerDown={handleDown}
          onPointerUp={handleUp}
          onPointerLeave={handleCancel}
          onPointerCancel={handleCancel}
          onContextMenu={(e) => e.preventDefault()}
          style={{
            touchAction: "manipulation",
            userSelect: "none",
            WebkitUserSelect: "none",
            WebkitTouchCallout: "none",
          }}
          className="fab-shadow grid h-14 w-14 place-items-center rounded-full bg-primary text-white transition-transform hover:bg-primary/90 active:scale-95"
        >
          <Plus className={cn("h-6 w-6 transition-transform duration-200", menuOpen && "rotate-45")} />
        </button>
      </div>
    </>
  );
}

function QuickAction({
  label,
  icon,
  onClick,
  delay = 0,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  delay?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ animation: "fab-qa-in 0.18s ease-out both", animationDelay: `${delay}ms` }}
      className="fab-shadow relative grid h-12 w-12 place-items-center rounded-full bg-primary text-white active:scale-95"
    >
      {icon}
      <span className="absolute right-full mr-3 whitespace-nowrap rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground shadow">
        {label}
      </span>
    </button>
  );
}
