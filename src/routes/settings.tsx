import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { profileQuery } from "@/lib/queries";
import { UserAvatar } from "@/components/UserAvatar";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ChevronRight,
  QrCode,
  User,
  Palette,
  SlidersHorizontal,
  Bell,
  LayoutGrid,
  Database,
  History,
  HelpCircle,
  Shield,
  LogOut,
} from "lucide-react";

type Item = {
  to?: string;
  onClick?: () => void;
  icon: typeof User;
  title: string;
  subtitle: string;
};

const MAIN: Item[] = [
  {
    to: "/settings/account",
    icon: User,
    title: "Account",
    subtitle: "Profile, phone number, Google account",
  },
  { to: "/settings/theme", icon: Palette, title: "Appearance", subtitle: "Theme" },
  {
    to: "/settings/preferences",
    icon: SlidersHorizontal,
    title: "Preferences",
    subtitle: "Currency, format, customization",
  },
  {
    to: "/settings/notifications",
    icon: Bell,
    title: "Notifications",
    subtitle: "Reminders, alerts, toast messages",
  },
  {
    to: "/manage",
    icon: LayoutGrid,
    title: "Manage",
    subtitle: "Categories, people, groups",
  },
  { to: "/settings/data", icon: Database, title: "Data & Backup", subtitle: "Export, import" },
  {
    to: "/settings/history",
    icon: History,
    title: "History",
    subtitle: "Notification and transaction history",
  },
  {
    onClick: () => toast("Coming soon"),
    icon: HelpCircle,
    title: "Help and feedback",
    subtitle: "Get help, send feedback",
  },
  {
    onClick: () => toast("Coming soon"),
    icon: Shield,
    title: "Privacy",
    subtitle: "Privacy settings",
  },
];

function RowLink({ to, onClick, icon: Icon, title, subtitle }: Item) {
  const cls = "flex w-full items-center gap-3 p-4 text-left active:bg-secondary/40";
  const inner = (
    <>
      <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </>
  );
  return to ? (
    <Link to={to} className={cls}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | undefined>();
  const [email, setEmail] = useState<string | undefined>();
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id);
      setEmail(data.user?.email ?? undefined);
    });
  }, []);
  const { data: profile } = useQuery(profileQuery(userId));
  const fullName = profile?.full_name ?? "";
  const phone = profile?.phone_number ?? "";

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate("/auth");
  }

  return (
    <div className="px-4 pt-6 pb-24 space-y-5">
      <h1 className="text-xl font-semibold">Settings</h1>

      {/* Profile header — tap the left area for Account, the icon for QR */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="flex items-center gap-4 p-4">
          <Link to="/settings/account" className="flex items-center gap-4 flex-1 min-w-0">
            <UserAvatar url={profile?.avatar_url} name={fullName || email} size={64} />
            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold truncate">{fullName || "Add your name"}</p>
              <p className="text-sm text-muted-foreground truncate">{phone || email || "—"}</p>
            </div>
          </Link>
          <Link
            to="/settings/qr"
            aria-label="My QR code"
            className="p-2 text-muted-foreground hover:text-foreground shrink-0"
          >
            <QrCode className="h-6 w-6" />
          </Link>
        </div>
      </div>

      {/* Main category rows */}
      <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden shadow-sm">
        {MAIN.map((item) => (
          <RowLink key={item.to ?? item.title} {...item} />
        ))}
      </div>

      {/* Sign out — separated, destructive */}
      <button
        onClick={signOut}
        className="w-full rounded-2xl border border-border bg-card p-4 flex items-center gap-3 text-sm font-medium text-expense active:bg-secondary/40 shadow-sm"
      >
        <LogOut className="h-5 w-5" /> Sign out
      </button>
    </div>
  );
}
