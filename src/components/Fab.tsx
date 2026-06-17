import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Fab({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      onClick={onClick}
      className="fab-shadow fixed bottom-20 right-1/2 translate-x-[200px] z-30 h-14 w-14 rounded-full bg-primary p-0 hover:bg-primary/90 md:translate-x-[185px]"
      aria-label="Add transaction"
    >
      <Plus className="h-6 w-6" />
    </Button>
  );
}
