import { toast } from "sonner";
import { Users, Trash2, Check, ShieldAlert, Bell, Wallet } from "lucide-react";

const toastStyles: Record<string, { background: string; border: string }> = {
  split_added: { background: "#78350F", border: "1px solid #F59E0B" },
  split_deleted: { background: "#7F1D1D", border: "1px solid #EF4444" },
  settlement_created: { background: "#064E3B", border: "1px solid #10B981" },
  delete_attempt: { background: "var(--muted)", border: "1px solid var(--muted-foreground)" },
  account_selection: { background: "#78350F", border: "1px solid #F59E0B" },
  settlement_account_selection: { background: "#064E3B", border: "1px solid #10B981" },
};

function getToastIcon(type: string) {
  const props = { size: 18, color: "#FFFFFF" };
  switch (type) {
    case "split_added":
      return <Users {...props} />;
    case "split_deleted":
      return <Trash2 {...props} />;
    case "settlement_created":
      return <Check {...props} />;
    case "delete_attempt":
      return <ShieldAlert {...props} />;
    case "account_selection":
      return <Wallet {...props} />;
    case "settlement_account_selection":
      return <Wallet {...props} />;
    default:
      return <Bell {...props} />;
  }
}

export function notifyToast(type: string, message: string, description?: string) {
  const { background, border } = toastStyles[type] ?? {
    background: "var(--card)",
    border: "1px solid var(--border)",
  };

  toast.custom(
    () => (
      <div
        style={{
          background,
          border,
          borderRadius: "12px",
          padding: "12px 16px",
          display: "flex",
          alignItems: "flex-start",
          gap: "10px",
          color: "#FFFFFF",
          width: "100%",
          maxWidth: "400px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
        }}
      >
        <div style={{ flexShrink: 0, marginTop: "2px" }}>{getToastIcon(type)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: "14px", lineHeight: "20px" }}>{message}</div>
          {description && (
            <div
              style={{
                fontSize: "13px",
                lineHeight: "18px",
                opacity: 0.9,
                marginTop: "2px",
                wordBreak: "break-word",
              }}
            >
              {description}
            </div>
          )}
        </div>
      </div>
    ),
    { duration: 4000 },
  );
}
