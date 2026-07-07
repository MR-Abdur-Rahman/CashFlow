import { MessageSquare, Info } from "lucide-react";
import { Link } from "react-router-dom";
import { SettingsHeader, Section, Row } from "@/components/SettingsRows";

export default function HelpHubPage() {
  return (
    <div className="px-4 pt-6 pb-24 space-y-6">
      <SettingsHeader title="Help & Feedback" back="/settings" />
      <Section>
        <Link to="/settings/feedback">
          <Row icon={<MessageSquare className="h-4 w-4" />} label="Send feedback" />
        </Link>
        <Link to="/settings/app-info">
          <Row icon={<Info className="h-4 w-4" />} label="App info" />
        </Link>
      </Section>
    </div>
  );
}
