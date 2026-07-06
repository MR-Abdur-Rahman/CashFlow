import { useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationsQuery } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Users, Trash2, Check, ShieldAlert, Bell, Wallet } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { useEffect, useMemo, useState } from "react";

// Colored circle icon per notification type (matches Home dropdown panel).
function getNotificationIcon(type: string) {
  switch (type) {
    case "split_added":
      return { bg: "#78350F", color: "#F59E0B", Icon: Users };
    case "split_deleted":
      return { bg: "#7F1D1D", color: "#EF4444", Icon: Trash2 };
    case "settlement_created":
      return { bg: "#064E3B", color: "#10B981", Icon: Check };
    case "delete_attempt":
      return { bg: "var(--muted)", color: "var(--muted-foreground)", Icon: ShieldAlert };
    case "account_selection":
      return { bg: "#78350F", color: "#F59E0B", Icon: Wallet };
    case "settlement_account_selection":
    case "settlement_account_needed":
      return { bg: "#064E3B", color: "#10B981", Icon: Wallet };
    default:
      return { bg: "var(--muted)", color: "var(--muted-foreground)", Icon: Bell };
  }
}

// "2:30 PM" today, "Yesterday 2:30 PM", "Jun 23 · 2:30 PM" otherwise.
function formatNotifTime(dateStr: string): string {
  const d = new Date(dateStr);
  const ds = d.toDateString();
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  if (ds === today) return format(d, "h:mm a");
  if (ds === yesterday) return `Yesterday ${format(d, "h:mm a")}`;
  return format(d, "MMM d · h:mm a");
}

// Group notifications into date sections (preserves DESC order via insertion order).
function groupByDate(notifications: any[]) {
  const groups: Record<string, any[]> = {};
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  for (const n of notifications) {
    const d = new Date(n.created_at).toDateString();
    let label: string;
    if (d === today) label = "Today";
    else if (d === yesterday) label = "Yesterday";
    else label = format(new Date(n.created_at), "MMM d, yyyy");

    if (!groups[label]) groups[label] = [];
    groups[label].push(n);
  }
  return groups;
}

export default function NotificationHistoryPage() {
  const { data: notifications = [] } = useQuery(notificationsQuery());
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | undefined>();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id));
  }, []);

  const grouped = useMemo(() => groupByDate(notifications as any[]), [notifications]);
  const hasUnread = (notifications as any[]).some((n: any) => !n.is_read);

  async function markAllRead() {
    if (!userId) return;
    if (!hasUnread) {
      toast("All caught up!");
      return;
    }
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  async function handleTap(n: any) {
    if (!n.is_read) {
      await supabase.from("notifications").update({ is_read: true }).eq("id", n.id);
      qc.invalidateQueries({ queryKey: ["notifications"] });
    }

    // Account selection (split payer, or settlement receiver) → Split page Pending tab.
    if (
      n.type === "account_selection" ||
      n.type === "settlement_account_selection" ||
      n.type === "settlement_account_needed"
    ) {
      navigate("/split?tab=pending");
      return;
    }

    // split_added / settlement_created → counterpart person's detail page.
    // notifications carry related_split_id (not from_user_id); resolve via the split's creator.
    if (
      (n.type === "split_added" || n.type === "settlement_created") &&
      n.related_split_id &&
      userId
    ) {
      const { data: split } = await supabase
        .from("splits")
        .select("created_by")
        .eq("id", n.related_split_id)
        .maybeSingle();
      if (split?.created_by) {
        const { data: person } = await supabase
          .from("people")
          .select("id")
          .eq("user_id", userId)
          .eq("linked_user_id", split.created_by)
          .maybeSingle();
        if (person) navigate(`/split/person/${person.id}`);
      }
    }
    // split_deleted, delete_attempt → just mark as read, no navigation
  }

  return (
    <div className="min-h-screen pb-24" style={{ background: "var(--background)" }}>
      {/* Header */}
      <div className="flex items-center justify-between" style={{ padding: "16px" }}>
        <Link
          to="/settings/history"
          className="inline-flex items-center text-sm"
          style={{ color: "var(--muted-foreground)" }}
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> History
        </Link>
        <button
          type="button"
          onClick={markAllRead}
          className="text-sm font-medium"
          style={{ color: "var(--primary)" }}
        >
          Mark all read
        </button>
      </div>

      <h1 className="text-xl font-semibold text-foreground" style={{ padding: "0 16px 12px" }}>
        Notification History
      </h1>

      {(notifications as any[]).length === 0 ? (
        <div
          className="flex flex-col items-center justify-center text-center"
          style={{ padding: "80px 16px", gap: 12 }}
        >
          <Bell style={{ width: 48, height: 48, color: "var(--muted-foreground)" }} />
          <p style={{ color: "var(--muted-foreground)", fontSize: 14 }}>No notifications yet</p>
        </div>
      ) : (
        Object.entries(grouped).map(([label, items]) => (
          <div key={label}>
            {/* Date section header */}
            <p
              style={{
                color: "var(--muted-foreground)",
                textTransform: "uppercase",
                fontSize: 12,
                letterSpacing: "0.06em",
                padding: "12px 16px",
                background: "var(--background)",
                fontWeight: 600,
              }}
            >
              {label}
            </p>

            {/* Card wrapping this group's rows */}
            <div
              style={{
                margin: "0 16px",
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
              {items.map((n: any, i: number) => {
                const { bg, color, Icon } = getNotificationIcon(n.type);
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => handleTap(n)}
                    className="w-full flex items-start text-left transition-colors active:opacity-80"
                    style={{
                      gap: 12,
                      padding: "12px 16px",
                      background: n.is_read ? "var(--card)" : "var(--secondary)",
                      borderTop: i === 0 ? "none" : "1px solid var(--border)",
                    }}
                  >
                    <div
                      className="shrink-0 rounded-full flex items-center justify-center"
                      style={{ width: 36, height: 36, background: bg }}
                    >
                      <Icon style={{ width: 18, height: 18, color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground font-medium text-sm">{n.title}</p>
                      <p
                        className="text-[13px] mt-0.5 line-clamp-3"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        {n.message}
                      </p>
                      <p className="text-[11px] mt-1" style={{ color: "var(--muted-foreground)" }}>
                        {formatNotifTime(n.created_at)}
                      </p>
                    </div>
                    {!n.is_read && (
                      <span
                        className="shrink-0 mt-1.5 rounded-full"
                        style={{ width: 8, height: 8, background: "#3B82F6" }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
