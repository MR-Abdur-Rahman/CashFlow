import { toast } from "sonner";

// Notification toasts use sonner's default subtle style — the same look as the account-deletion flow
// (settings-privacy.tsx), rather than the old bold, per-type coloured full-width banners.
//
// The `type` argument is kept so none of the call sites need to change, but it no longer affects
// styling: every notification now renders as a plain, compact default toast with an optional
// description line. Default duration (4s) matches the previous behaviour.
export function notifyToast(_type: string, message: string, description?: string) {
  toast(message, description ? { description } : undefined);
}
