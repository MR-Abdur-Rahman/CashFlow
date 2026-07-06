import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { UserAvatar } from "./UserAvatar";

// Simple large photo preview (no edit options). Falls back to the initials avatar when no photo.
export function PhotoPreviewDialog({
  url,
  name,
  open,
  onOpenChange,
}: {
  url: string | null | undefined;
  name: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogTitle className="sr-only">{name}</DialogTitle>
        <div className="flex flex-col items-center gap-3 p-2">
          {url ? (
            <img
              src={url}
              alt={name}
              className="w-full max-h-[70vh] rounded-xl object-contain bg-black"
            />
          ) : (
            <UserAvatar url={null} name={name} size={220} />
          )}
          <p className="text-sm font-medium text-foreground">{name}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
