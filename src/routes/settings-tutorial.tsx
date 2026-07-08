import { toast } from "sonner";
import { GraduationCap } from "lucide-react";
import { SettingsHeader, Section, Row } from "@/components/SettingsRows";

export default function TutorialPage() {
  return (
    <div className="px-4 pt-6 pb-24 space-y-6">
      <SettingsHeader title="Tutorial" back="/settings" />

      <Section label="Tutorial">
        <Row
          icon={<GraduationCap className="h-4 w-4" />}
          label="How to use CashFlow"
          onClick={() => toast("Coming soon")}
        />
      </Section>
    </div>
  );
}
