import { Link, useNavigate } from "react-router-dom";
import { GraduationCap, ChevronRight } from "lucide-react";
import { SettingsHeader, Section, Row } from "@/components/SettingsRows";
import { TUTORIAL_TOPICS } from "@/lib/tutorialTopics";

export default function TutorialPage() {
  const navigate = useNavigate();
  return (
    <div className="px-4 pt-6 pb-24 space-y-6">
      <SettingsHeader title="Tutorial" back="/settings" />

      {/* Replay intro — kept exactly as-is. /welcome ignores the once-per-device flag, so it always shows. */}
      <Section>
        <Row
          icon={<GraduationCap className="h-4 w-4" />}
          label="Replay intro"
          onClick={() => navigate("/welcome")}
        />
      </Section>

      {/* Guides — one row per topic, each navigating to its own detail route. */}
      <Section label="Guides">
        {TUTORIAL_TOPICS.map(({ id, icon: Icon, title, desc }) => (
          <Link
            key={id}
            to={`/settings/tutorial/${id}`}
            className="flex w-full items-center gap-3 p-4 text-left active:bg-secondary/40"
          >
            <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{title}</p>
              <p className="text-xs text-muted-foreground truncate">{desc}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </Link>
        ))}
      </Section>
    </div>
  );
}
