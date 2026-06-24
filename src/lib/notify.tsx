import { toast } from "sonner";
import { Users, Trash2, Check, ShieldAlert, Bell } from "lucide-react";

// Colored icon per notification/toast type.
export function getToastIcon(type: string) {
  switch (type) {
    case "split_added": return <Users size={16} color="#F59E0B" />;
    case "split_deleted": return <Trash2 size={16} color="#EF4444" />;
    case "settlement_created": return <Check size={16} color="#10B981" />;
    case "delete_attempt": return <ShieldAlert size={16} color="#6B7280" />;
    default: return <Bell size={16} color="#9CA3AF" />;
  }
}

// Compact single-line toast (sonner default style) with a type-colored icon.
export function notifyToast(type: string, message: string) {
  toast(message, {
    duration: 4000,
    style: {
      background: "#1A1A1A",
      border: "1px solid #2A2A2A",
      borderRadius: "12px",
      color: "#FFFFFF",
      fontSize: "14px",
      padding: "12px 16px",
    },
    icon: getToastIcon(type),
  });
}
