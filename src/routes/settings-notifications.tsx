import { useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationsQuery } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, CheckCheck, Trash2, ChevronLeft, ChevronRight, ChevronDown, Search } from "lucide-react";
import { Link } from "react-router-dom";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  startOfYear, endOfYear, subMonths, addMonths, subWeeks, addWeeks, subYears, addYears,
} from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Period = "weekly" | "monthly" | "annually";

function getPeriodRange(period: Period, anchor: Date) {
  if (period === "weekly") return { from: startOfWeek(anchor, { weekStartsOn: 1 }), to: endOfWeek(anchor, { weekStartsOn: 1 }) };
  if (period === "monthly") return { from: startOfMonth(anchor), to: endOfMonth(anchor) };
  return { from: startOfYear(anchor), to: endOfYear(anchor) };
}

function navigateAnchor(period: Period, anchor: Date, dir: -1 | 1): Date {
  if (period === "weekly") return dir === -1 ? subWeeks(anchor, 1) : addWeeks(anchor, 1);
  if (period === "monthly") return dir === -1 ? subMonths(anchor, 1) : addMonths(anchor, 1);
  return dir === -1 ? subYears(anchor, 1) : addYears(anchor, 1);
}

function formatAnchorLabel(period: Period, anchor: Date) {
  if (period === "weekly") return `${format(startOfWeek(anchor, { weekStartsOn: 1 }), "MMM d")} – ${format(endOfWeek(anchor, { weekStartsOn: 1 }), "MMM d, yyyy")}`;
  if (period === "monthly") return format(anchor, "MMM yyyy");
  return format(anchor, "yyyy");
}

export default function NotificationsPage() {
  const { data: notifications = [] } = useQuery(notificationsQuery());
  const qc = useQueryClient();
  const [period, setPeriod] = useState<Period>("monthly");
  const [anchor, setAnchor] = useState(new Date());
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");

  const { from: periodFrom, to: periodTo } = useMemo(
    () => getPeriodRange(period, anchor),
    [period, anchor]
  );

  const filtered = useMemo(() => {
    return (notifications as any[]).filter((n: any) => {
      const d = new Date(n.created_at);
      if (d < periodFrom || d > periodTo) return false;
      if (filter === "unread" && n.is_read) return false;
      if (filter === "read" && !n.is_read) return false;
      if (q) {
        const hay = [n.title, n.message].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [notifications, periodFrom, periodTo, filter, q]);

  const unreadIds = filtered
    .filter((n: any) => !n.is_read && n.type !== "settlement_account_needed")
    .map((n: any) => n.id);

  async function markAllRead() {
    if (unreadIds.length === 0) { toast("All caught up!"); return; }
    const { error } = await supabase.from("notifications").update({ is_read: true }).in("id", unreadIds);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  async function markRead(id: string) {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  async function deleteNotif(id: string) {
    const { error } = await supabase.from("notifications").delete().eq("id", id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  return (
    <div className="px-4 pt-4 pb-24 space-y-4">
      <Link to="/settings" className="inline-flex items-center text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4 mr-1" /> Settings
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Notifications</h1>
        {unreadIds.length > 0 && (
          <Button size="sm" variant="ghost" onClick={markAllRead} className="text-xs text-primary h-8">
            <CheckCheck className="h-3.5 w-3.5 mr-1" /> Mark all read
          </Button>
        )}
      </div>

      {/* Time selector */}
      <div className="flex items-center gap-2">
        <button onClick={() => setAnchor((a) => navigateAnchor(period, a, -1))} className="p-1 rounded-md hover:bg-secondary">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold">{formatAnchorLabel(period, anchor)}</span>
        <button onClick={() => setAnchor((a) => navigateAnchor(period, a, 1))} className="p-1 rounded-md hover:bg-secondary">
          <ChevronRight className="h-4 w-4" />
        </button>
        <div className="ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 bg-primary text-white text-sm font-medium px-3 py-1.5 rounded-xl capitalize">
                {period} <ChevronDown className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              {(["weekly", "monthly", "annually"] as Period[]).map((p) => (
                <DropdownMenuItem key={p} onClick={() => { setPeriod(p); setAnchor(new Date()); }}
                  className={`capitalize py-3 text-base ${period === p ? "text-primary font-medium" : ""}`}>
                  {p}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search notifications..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Read/Unread filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-1.5 bg-secondary text-foreground text-sm font-medium px-3 py-1.5 rounded-xl capitalize">
            {filter === "all" ? "All" : filter === "unread" ? "Unread" : "Read"}
            <ChevronDown className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-32">
          {(["all", "unread", "read"] as const).map((f) => (
            <DropdownMenuItem key={f} onClick={() => setFilter(f)}
              className={`capitalize py-3 text-base ${filter === f ? "text-primary font-medium" : ""}`}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          No notifications
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden border border-border divide-y divide-border">
          {filtered.map((n: any) => (
            <div
              key={n.id}
              className={`flex items-start gap-3 px-4 py-4 ${!n.is_read ? "bg-primary/5" : "bg-card"}`}
            >
              <div className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${!n.is_read ? "bg-primary" : "bg-transparent border border-border"}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{n.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{n.message}</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {format(new Date(n.created_at), "MMM d, yyyy · h:mm a")}
                </p>
              </div>
              <div className="flex flex-col items-center gap-2 shrink-0 pt-0.5">
                {!n.is_read && n.type !== "settlement_account_needed" && (
                  <button type="button" onClick={() => markRead(n.id)} className="text-muted-foreground hover:text-primary" aria-label="Mark read">
                    <CheckCheck className="h-4 w-4" />
                  </button>
                )}
                <button type="button" onClick={() => deleteNotif(n.id)} className="text-muted-foreground hover:text-destructive" aria-label="Delete">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
