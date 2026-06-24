import { toast } from "sonner";
import { Users, Trash2, Check, ShieldAlert, Bell } from "lucide-react";

// Type-based background + border for each toast.
const toastStyles: Record<string, { background: string; border: string }> = {
  split_added: { background: "#78350F", border: "1px solid #F59E0B" },
  split_deleted: { background: "#7F1D1D", border: "1px solid #EF4444" },
  settlement_created: { background: "#064E3B", border: "1px solid #10B981" },
  delete_attempt: { background: "#374151", border: "1px solid #6B7280" },
};

// White icon per toast type (background is colored).
export function getToastIcon(type: string) {
  switch (type) {
    case "split_added": return <Users size={16} color="#FFFFFF" />;
    case "split_deleted": return <Trash2 size={16} color="#FFFFFF" />;
    case "settlement_created": return <Check size={16} color="#FFFFFF" />;
    case "delete_attempt": return <ShieldAlert size={16} color="#FFFFFF" />;
    default: return <Bell size={16} color="#FFFFFF" />;
  }
}

// Compact toast with a type-colored background + white icon.
// Pass `description` to render a two-line title + description toast (capped at 400px).
export function notifyToast(type: string, message: string, description?: string) {
  const style = toastStyles[type] ?? { background: "#1A1A1A", border: "1px solid #2A2A2A" };
  toast(message, {
    icon: getToastIcon(type),
    duration: 4000,
    description,
    style: {
      ...style,
      color: "#FFFFFF",
      borderRadius: "12px",
      fontSize: "14px",
      padding: "12px 16px",
      ...(description ? { maxWidth: "400px", margin: "0 auto" } : {}),
    },
  });
}
