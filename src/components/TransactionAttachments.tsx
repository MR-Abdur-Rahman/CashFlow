import { useState } from "react";
import { ExternalLink, FileText, MapPin, Paperclip, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { AttachmentSheet } from "@/components/AttachmentSheet";
import {
  mapsUrl,
  removeAttachment,
  revokePreview,
  type Coords,
  type PendingAttachment,
  type SavedAttachment,
} from "@/lib/attachments";

type Props = {
  // Files chosen but not yet uploaded (uploaded after the transaction insert returns an id).
  pending: PendingAttachment[];
  onPendingChange: (next: PendingAttachment[]) => void;
  // Already-persisted rows — only populated in edit mode.
  saved?: SavedAttachment[];
  onSavedChange?: (next: SavedAttachment[]) => void;
  location: Coords | null;
  onLocationChange: (c: Coords | null) => void;
  // The Note textarea, so the paperclip can sit on the label row above it.
  children: React.ReactNode;
};

function Chip({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <span className="inline-flex max-w-[10rem] items-center gap-1.5 rounded-full bg-secondary py-1 pl-2 pr-1 text-xs">
      <span className="truncate">{children}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove attachment"
        className="grid h-4 w-4 shrink-0 place-items-center rounded-full text-muted-foreground active:bg-background/60"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

// Note field + paperclip + the chip row for everything attached to it. Shared by all three
// AddTransactionSheet tabs and EditTxSheet so the layout can't drift between them.
export function TransactionAttachments({
  pending,
  onPendingChange,
  saved = [],
  onSavedChange,
  location,
  onLocationChange,
  children,
}: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);

  function removePending(a: PendingAttachment) {
    revokePreview(a);
    onPendingChange(pending.filter((p) => p.localId !== a.localId));
  }

  async function removeSaved(a: SavedAttachment) {
    // Optimistic: drop the chip immediately, the row+object deletion follows.
    onSavedChange?.(saved.filter((s) => s.id !== a.id));
    await removeAttachment(a.id, a.filePath);
  }

  const hasChips = pending.length > 0 || saved.length > 0 || !!location;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label>Note</Label>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-label="Attach a file or location"
          className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground active:bg-secondary/60"
        >
          <Paperclip className="h-4 w-4" />
        </button>
      </div>

      {children}

      {hasChips && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {saved.map((a) =>
            a.signedUrl ? (
              <a key={a.id} href={a.signedUrl} target="_blank" rel="noreferrer" className="contents">
                <Chip onRemove={() => removeSaved(a)}>
                  {a.type === "document" ? "📄 " : "🖼️ "}
                  {a.fileName ?? "Attachment"}
                </Chip>
              </a>
            ) : (
              <Chip key={a.id} onRemove={() => removeSaved(a)}>
                {a.fileName ?? "Attachment"}
              </Chip>
            ),
          )}

          {pending.map((a) => (
            <Chip key={a.localId} onRemove={() => removePending(a)}>
              {a.type === "document" ? (
                <FileText className="mr-1 inline h-3 w-3" />
              ) : (
                <span className="mr-1">🖼️</span>
              )}
              {a.fileName}
            </Chip>
          ))}

          {/* Coordinates only — no reverse geocoding, so no address and no geocoding API key. */}
          {location && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary py-1 pl-2 pr-1 text-xs">
              <a
                href={mapsUrl(location)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1"
              >
                <MapPin className="h-3 w-3 text-transfer" />
                View location
                <ExternalLink className="h-2.5 w-2.5 text-muted-foreground" />
              </a>
              <button
                type="button"
                onClick={() => onLocationChange(null)}
                aria-label="Remove location"
                className="grid h-4 w-4 shrink-0 place-items-center rounded-full text-muted-foreground active:bg-background/60"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
        </div>
      )}

      <AttachmentSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onAttach={(a) => onPendingChange([...pending, a])}
        onLocation={onLocationChange}
      />
    </div>
  );
}
