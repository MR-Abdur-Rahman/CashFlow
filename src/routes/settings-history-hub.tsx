import { Bell, ArrowLeftRight } from "lucide-react";
import { Link } from "react-router-dom";
import { SettingsHeader, Section, Row } from "@/components/SettingsRows";

export default function HistoryHubPage() {
  return (
    <div className="px-4 pt-6 pb-24 space-y-6">
      <SettingsHeader title="History" back="/settings" />
      <Section>
        <Link to="/settings/notifications/history">
          <Row icon={<Bell className="h-4 w-4" />} label="Notification history" />
        </Link>
        <Link to="/settings/history/transactions">
          <Row icon={<ArrowLeftRight className="h-4 w-4" />} label="Transaction history" />
        </Link>
      </Section>
    </div>
  );
}
