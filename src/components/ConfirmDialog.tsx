import { useCallback, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Paints the confirm button in the app's expense red. Use for anything that destroys data. */
  destructive?: boolean;
};

/**
 * Themed replacement for window.confirm(). Built on the shadcn AlertDialog, which already paints
 * `bg-card` (the raised surface) rather than `bg-background` (the page backdrop) — the same fix
 * dialog.tsx carries. Overrides the primitive's `sm:rounded-lg` with an unconditional `rounded-2xl`
 * so the corners match the other dialogs on a phone, and replaces the default
 * `flex-col-reverse sm:flex-row` footer with an evenly split two-column grid.
 *
 * Cancel is the focused control on open and is never the destructive one, so a stray Enter or a
 * double-tap can't confirm a deletion.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  options,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  options: ConfirmOptions;
  onConfirm: () => void;
  onCancel?: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const {
    title,
    description,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    destructive = false,
  } = options;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onCancel?.();
        onOpenChange(o);
      }}
    >
      <AlertDialogContent
        className="max-w-[min(26rem,calc(100vw-2rem))] rounded-2xl border-border"
        // Keep focus off the destructive action: Radix focuses this element on open.
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          cancelRef.current?.focus();
        }}
      >
        <div className="space-y-2">
          <AlertDialogTitle className="text-base">{title}</AlertDialogTitle>
          {description && (
            <AlertDialogDescription className="text-sm">{description}</AlertDialogDescription>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <AlertDialogCancel
            ref={cancelRef}
            className="mt-0 min-h-[44px] w-full border-border bg-secondary text-foreground hover:bg-secondary/80"
          >
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={cn(
              "min-h-[44px] w-full text-white",
              destructive
                ? "bg-[var(--expense)] hover:bg-[var(--expense)]/90"
                : "bg-primary hover:bg-primary/90",
            )}
          >
            {confirmLabel}
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Promise-based confirm so call sites stay a one-liner and keep their existing control flow:
 *
 *   const { confirm, confirmDialog } = useConfirm();
 *   ...
 *   if (!(await confirm({ title: "Delete X?", destructive: true, confirmLabel: "Delete" }))) return;
 *   ...
 *   return (<>{...}{confirmDialog}</>);
 *
 * Deliberately NOT a global provider: the dialog element is rendered by the caller, so this needs
 * no app-root wiring and nothing in the routing tree changes.
 */
export function useConfirm() {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({ title: "" });
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    setOptions(opts);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  // Settle the promise exactly once per open, whichever way the dialog closes (button, Escape,
  // overlay tap) — a dangling promise would leave the caller's await hanging forever.
  const settle = useCallback((ok: boolean) => {
    const r = resolver.current;
    resolver.current = null;
    r?.(ok);
  }, []);

  const confirmDialog = (
    <ConfirmDialog
      open={open}
      onOpenChange={setOpen}
      options={options}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  );

  return { confirm, confirmDialog };
}
