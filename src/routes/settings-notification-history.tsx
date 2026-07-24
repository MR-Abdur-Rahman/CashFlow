import { useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationsQuery, incomingRequestsQuery } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft,
  Users,
  Trash2,
  Check,
  ShieldAlert,
  Bell,
  Wallet,
  CalendarClock,
  UserPlus,
  Inbox,
  Download,
  UserMinus,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { ConnectionRequestActions } from "@/components/ConnectionRequestActions";
import { RequestsSheet } from "@/components/RequestsSheet";

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
    case "scheduled_due":
      return { bg: "#2E1065", color: "#A78BFA", Icon: CalendarClock };
    case "connection_request":
      return { bg: "#1E3A5F", color: "#3B82F6", Icon: UserPlus };
    case "connection_accepted":
      return { bg: "#064E3B", color: "#10B981", Icon: Users };
    case "connection_declined":
      return { bg: "var(--muted)", color: "var(--muted-foreground)", Icon: Users };
    case "app_update":
      return { bg: "#1E3A5F", color: "#3B82F6", Icon: Download };
    case "contact_account_deleted":
      return { bg: "var(--muted)", color: "var(--muted-foreground)", Icon: UserMinus };
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
  const { data: incomingReqs = [] } = useQuery(incomingRequestsQuery());
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | undefined>();
  const [requestsOpen, setRequestsOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id));
  }, []);

  const grouped = useMemo(() => groupByDate(notifications as any[]), [notifications]);
  // request id → current status, so a connection_request row shows Accept/Decline vs the outcome.
  const statusById = useMemo(
    () => new Map((incomingReqs as any[]).map((r: any) => [r.id, r.status])),
    [incomingReqs],
  );
  const pendingCount = (incomingReqs as any[]).filter((r: any) => r.status === "pending").length;

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

    // Accepted connection → the People list. (Requests are actioned inline, not via tap.)
    if (n.type === "connection_accepted") {
      navigate("/manage");
      return;
    }

    // Update-available → App Info, which auto-opens the shared update dialog.
    if (n.type === "app_update") {
      navigate("/settings/app-info?update=1");
      return;
    }

    // A contact deleted their account → open that specific (now local) contact; fall back to People.
    if (n.type === "contact_account_deleted") {
      navigate(n.related_person_id ? `/split/person/${n.related_person_id}` : "/manage");
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
          onClick={() => setRequestsOpen(true)}
          aria-label="Connection requests"
          className="relative inline-flex items-center gap-1.5 text-sm font-medium"
          style={{ color: "var(--primary)" }}
        >
          <Inbox className="h-5 w-5" /> Requests
          {pendingCount > 0 && (
            <span
              className="absolute -right-2 -top-2 inline-flex items-center justify-center rounded-full text-[10px] font-bold text-white px-1.5 min-w-[16px] h-4 leading-none"
              style={{ background: "#EF4444" }}
            >
              {pendingCount}
            </span>
          )}
        </button>
      </div>
      <RequestsSheet open={requestsOpen} onOpenChange={setRequestsOpen} />

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
                const isRequest = n.type === "connection_request" && n.related_request_id;
                const rowStyle = {
                  gap: 12,
                  padding: "12px 16px",
                  background: n.is_read ? "var(--card)" : "var(--secondary)",
                  borderTop: i === 0 ? "none" : "1px solid var(--border)",
                } as const;
                const inner = (
                  <>
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
                  </>
                );

                // Connection requests aren't tap-to-navigate — they carry inline Accept/Decline.
                if (isRequest) {
                  return (
                    <div key={n.id} className="w-full flex items-center" style={rowStyle}>
                      {inner}
                      <ConnectionRequestActions
                        requestId={n.related_request_id}
                        status={statusById.get(n.related_request_id) ?? "pending"}
                      />
                    </div>
                  );
                }
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => handleTap(n)}
                    className="w-full flex items-start text-left transition-colors active:opacity-80"
                    style={rowStyle}
                  >
                    {inner}
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
