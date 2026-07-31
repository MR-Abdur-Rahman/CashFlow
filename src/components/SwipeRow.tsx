import { useRef, useState, useEffect, useContext, createContext, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

// ─── Global swipe context ──────────────────────────────────────────────────
// Tracks which row is currently open so others can close themselves
const SwipeContext = createContext<{
  openId: string | null;
  setOpenId: (id: string | null) => void;
}>({ openId: null, setOpenId: () => {} });

// Unique id counter
let idCounter = 0;

// Pointer travel below this many px counts as a tap, not a swipe. Small enough that a deliberate
// swipe never reads as a tap, large enough to absorb the jitter of a finger press.
const TAP_SLOP = 8;

// A tap that lands on a real control inside the row (the avatar button on split rows) belongs to
// that control, not to the row.
//
// Real elements only — NOT [role='button']. closest() walks up from the tap target, and the row
// wrapper below carries role="button" whenever onClick is passed, so including that selector made
// every tap match the wrapper itself and swallowed the very taps this guard exists to allow.
function hitsInteractive(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest("button, a, input, textarea, select");
}

export function SwipeRow({
  children,
  onEdit,
  onDelete,
  onClick,
  className,
  canEdit = true,
  canDelete = true,
  editDeniedMessage = "Not allowed",
  deleteDeniedMessage = "Not allowed",
}: {
  children: ReactNode;
  onEdit?: () => void;
  onDelete?: () => void;
  // Opt-in: tapping the row body fires this. Rows that pass nothing stay swipe-only.
  onClick?: () => void;
  className?: string;
  canEdit?: boolean;
  canDelete?: boolean;
  editDeniedMessage?: string;
  deleteDeniedMessage?: string;
}) {
  const ACTION_WIDTH = onEdit && onDelete ? 144 : 72;
  const [x, setX] = useState(0);
  const startX = useRef<number | null>(null);
  const startOffset = useRef(0);
  const travel = useRef(0);
  const rowId = useRef(`swipe-${++idCounter}`).current;
  const { openId, setOpenId } = useContext(SwipeContext);

  // Close this row if another row opens
  useEffect(() => {
    if (openId !== rowId && x !== 0) {
      setX(0);
    }
  }, [openId]);

  function begin(clientX: number) {
    startX.current = clientX;
    startOffset.current = x;
    travel.current = 0;
  }

  function move(clientX: number) {
    if (startX.current === null) return;
    const delta = clientX - startX.current;
    travel.current = Math.max(travel.current, Math.abs(delta));
    setX(Math.max(-ACTION_WIDTH, Math.min(0, delta + startOffset.current)));
  }

  // Settle the gesture as a swipe: snap open or closed by which half it ended past.
  function settle() {
    const newX = x < -ACTION_WIDTH / 2 ? -ACTION_WIDTH : 0;
    setX(newX);
    if (newX !== 0) {
      // This row is now open — tell others to close
      setOpenId(rowId);
    } else {
      if (openId === rowId) setOpenId(null);
    }
  }

  function end(target?: EventTarget | null) {
    if (startX.current === null) return;
    startX.current = null;

    if (travel.current >= TAP_SLOP) {
      settle();
      return;
    }

    // A tap. Snap back any sub-threshold jitter rather than leaving the row a few px off.
    const wasOpen = startOffset.current !== 0;
    setX(0);
    if (openId === rowId) setOpenId(null);

    // Tapping an open row closes the action strip — it does not also open the detail sheet.
    if (wasOpen) return;
    if (onClick && !hitsInteractive(target ?? null)) onClick();
  }

  // Pointer left / gesture aborted: resolve the swipe but never treat it as a tap.
  function cancel() {
    if (startX.current === null) return;
    startX.current = null;
    settle();
  }

  return (
    <div className={cn("relative overflow-hidden", className)}>
      <div className="absolute inset-y-0 right-0 flex">
        {onEdit && (
          <button
            type="button"
            onClick={() => {
              setX(0);
              setOpenId(null);
              if (canEdit) onEdit();
              else toast.error(editDeniedMessage);
            }}
            className={cn(
              "w-[72px] flex flex-col items-center justify-center text-xs",
              canEdit ? "bg-transfer text-white" : "bg-muted text-muted-foreground",
            )}
          >
            <Pencil className="h-4 w-4 mb-0.5" /> Edit
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={() => {
              setX(0);
              setOpenId(null);
              if (canDelete) onDelete();
              else toast.error(deleteDeniedMessage);
            }}
            className={cn(
              "w-[72px] flex flex-col items-center justify-center text-xs",
              canDelete ? "bg-expense text-white" : "bg-muted text-muted-foreground",
            )}
          >
            <Trash2 className="h-4 w-4 mb-0.5" /> Delete
          </button>
        )}
      </div>
      <div
        className="relative bg-card transition-transform"
        style={{
          transform: `translateX(${x}px)`,
          transitionDuration: startX.current === null ? "180ms" : "0ms",
        }}
        onTouchStart={(e) => begin(e.touches[0].clientX)}
        onTouchMove={(e) => move(e.touches[0].clientX)}
        onTouchEnd={(e) => end(e.target)}
        onTouchCancel={cancel}
        onMouseDown={(e) => begin(e.clientX)}
        onMouseMove={(e) => {
          if (startX.current !== null) move(e.clientX);
        }}
        onMouseUp={(e) => end(e.target)}
        onMouseLeave={cancel}
        // Keyboard parity for the tap affordance; swipe-only rows stay non-focusable.
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={
          onClick
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onClick();
                }
              }
            : undefined
        }
      >
        {children}
      </div>
    </div>
  );
}

// ─── Provider — wrap your app or page with this ────────────────────────────
export function SwipeProvider({ children }: { children: ReactNode }) {
  const [openId, setOpenId] = useState<string | null>(null);
  return <SwipeContext.Provider value={{ openId, setOpenId }}>{children}</SwipeContext.Provider>;
}
