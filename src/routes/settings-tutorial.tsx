import { useNavigate } from "react-router-dom";
import { GraduationCap } from "lucide-react";
import { SettingsHeader, Section, Row } from "@/components/SettingsRows";

export default function TutorialPage() {
  const navigate = useNavigate();
  return (
    <div className="px-4 pt-6 pb-24 space-y-6">
      <SettingsHeader title="Tutorial" back="/settings" />

      <Section label="Tutorial">
        {/* /welcome ignores the once-per-device flag, so this always re-shows the intro carousel. */}
        <Row
          icon={<GraduationCap className="h-4 w-4" />}
          label="Replay intro"
          onClick={() => navigate("/welcome")}
        />
      </Section>
    </div>
  );
}
