import { Search, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type AddAction = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
};

// Search box + a single Add (+) button. If `addActions` is given, the + opens a menu of those choices
// (used on the People lists: add local person / find by username / scan QR); otherwise it directly
// calls `onAdd` (Groups and other simple lists).
export function ListToolbar({
  query,
  onQuery,
  onAdd,
  addActions,
  placeholder = "Search",
}: {
  query: string;
  onQuery: (v: string) => void;
  onAdd?: () => void;
  addActions?: AddAction[];
  placeholder?: string;
}) {
  const menu = !!addActions?.length;

  const addButton = (
    <button
      type="button"
      onClick={menu ? undefined : onAdd}
      aria-label="Add"
      className="h-10 w-10 shrink-0 rounded-lg bg-primary text-white grid place-items-center active:opacity-80"
    >
      <Plus className="h-5 w-5" />
    </button>
  );

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

      {menu ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>{addButton}</DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {addActions!.map((a) => {
              const Icon = a.icon;
              return (
                <DropdownMenuItem key={a.label} onClick={a.onClick} className="text-base py-3 gap-3">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  {a.label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        addButton
      )}
    </div>
  );
}
