import { Search, Plus, QrCode } from "lucide-react";

// Search box + Add button (+ optional QR-scan button) row. Used above People/Group lists on the
// Manage and Split pages so they share one style.
export function ListToolbar({
  query,
  onQuery,
  onAdd,
  onScan,
  placeholder = "Search",
}: {
  query: string;
  onQuery: (v: string) => void;
  onAdd: () => void;
  onScan?: () => void;
  placeholder?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1 min-w-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg bg-secondary py-2 pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>
      <button
        type="button"
        onClick={onAdd}
        aria-label="Add"
        className="h-10 w-10 shrink-0 rounded-lg bg-primary text-white grid place-items-center active:opacity-80"
      >
        <Plus className="h-5 w-5" />
      </button>
      {onScan && (
        <button
          type="button"
          onClick={onScan}
          aria-label="Scan QR"
          className="h-10 w-10 shrink-0 rounded-lg bg-secondary text-foreground grid place-items-center active:opacity-80"
        >
          <QrCode className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
