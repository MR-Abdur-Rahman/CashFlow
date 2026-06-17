import { useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Pencil, Trash2 } from "lucide-react";

/**
 * Swipe a row left to reveal Edit / Delete actions.
 * Touch + mouse drag supported. Tap anywhere on the revealed row to close it.
 */
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

  const begin = (clientX: number) => {
    startX.current = clientX;
    startOffset.current = x;
  };
  const move = (clientX: number) => {
    if (startX.current === null) return;
    const dx = clientX - startX.current + startOffset.current;
    setX(Math.max(-ACTION_WIDTH, Math.min(0, dx)));
  };
  const end = () => {
    if (startX.current === null) return;
    startX.current = null;
    setX(x < -ACTION_WIDTH / 2 ? -ACTION_WIDTH : 0);
  };

  return (
    <div className={cn("relative overflow-hidden", className)}>
      <div className="absolute inset-y-0 right-0 flex">
        {onEdit && (
          <button
            type="button"
            onClick={() => { setX(0); onEdit(); }}
            className="w-[72px] flex flex-col items-center justify-center bg-transfer text-white text-xs"
          >
            <Pencil className="h-4 w-4 mb-0.5" /> Edit
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={() => { setX(0); onDelete(); }}
            className="w-[72px] flex flex-col items-center justify-center bg-expense text-white text-xs"
          >
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
