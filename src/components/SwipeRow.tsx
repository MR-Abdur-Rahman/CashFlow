import { useRef, useState, useEffect, useContext, createContext, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Pencil, Trash2 } from "lucide-react";

// ─── Global swipe context ──────────────────────────────────────────────────
// Tracks which row is currently open so others can close themselves
const SwipeContext = createContext<{
  openId: string | null;
  setOpenId: (id: string | null) => void;
}>({ openId: null, setOpenId: () => {} });

// Unique id counter
let idCounter = 0;

export function SwipeRow({
  children,
  onEdit,
  onDelete,
  className,
}: {
  children: ReactNode;
  onEdit?: () => void;
  onDelete?: () => void;
  className?: string;
}) {
  const ACTION_WIDTH = onEdit && onDelete ? 144 : 72;
  const [x, setX] = useState(0);
  const startX = useRef<number | null>(null);
  const startOffset = useRef(0);
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
  }

  function move(clientX: number) {
    if (startX.current === null) return;
    const dx = clientX - startX.current + startOffset.current;
    setX(Math.max(-ACTION_WIDTH, Math.min(0, dx)));
  }

  function end() {
    if (startX.current === null) return;
    startX.current = null;
    const newX = x < -ACTION_WIDTH / 2 ? -ACTION_WIDTH : 0;
    setX(newX);
    if (newX !== 0) {
      // This row is now open — tell others to close
      setOpenId(rowId);
    } else {
      if (openId === rowId) setOpenId(null);
    }
  }

  return (
    <div className={cn("relative overflow-hidden", className)}>
      <div className="absolute inset-y-0 right-0 flex">
        {onEdit && (
          <button type="button"
            onClick={() => { setX(0); setOpenId(null); onEdit(); }}
            className="w-[72px] flex flex-col items-center justify-center bg-transfer text-white text-xs">
            <Pencil className="h-4 w-4 mb-0.5" /> Edit
          </button>
        )}
        {onDelete && (
          <button type="button"
            onClick={() => { setX(0); setOpenId(null); onDelete(); }}
            className="w-[72px] flex flex-col items-center justify-center bg-expense text-white text-xs">
            <Trash2 className="h-4 w-4 mb-0.5" /> Delete
          </button>
        )}
      </div>
      <div
        className="relative bg-card transition-transform"
        style={{ transform: `translateX(${x}px)`, transitionDuration: startX.current === null ? "180ms" : "0ms" }}
        onTouchStart={(e) => begin(e.touches[0].clientX)}
        onTouchMove={(e) => move(e.touches[0].clientX)}
        onTouchEnd={end}
        onMouseDown={(e) => begin(e.clientX)}
        onMouseMove={(e) => { if (startX.current !== null) move(e.clientX); }}
        onMouseUp={end}
        onMouseLeave={end}
      >
        {children}
      </div>
    </div>
  );
}

// ─── Provider — wrap your app or page with this ────────────────────────────
export function SwipeProvider({ children }: { children: ReactNode }) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <SwipeContext.Provider value={{ openId, setOpenId }}>
      {children}
    </SwipeContext.Provider>
  );
}