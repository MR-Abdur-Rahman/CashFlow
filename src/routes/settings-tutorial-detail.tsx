import { useParams } from "react-router-dom";
import { SettingsHeader } from "@/components/SettingsRows";
import { TUTORIAL_TOPICS } from "@/lib/tutorialTopics";

// Reusable detail page for a single tutorial topic, keyed by the :topicId route param. Follows the
// app's NORMAL theme (var(--…) tokens via Tailwind classes), since it lives inside Settings (post-login)
// — not the always-light pre-login pattern used by auth/setup/welcome.
export default function TutorialDetailPage() {
  const { topicId } = useParams();
  const topic = TUTORIAL_TOPICS.find((t) => t.id === topicId);

  if (!topic) {
    return (
      <div className="px-4 pt-6 pb-24 space-y-6">
        <SettingsHeader title="Tutorial" back="/settings/tutorial" />
        <p className="text-sm text-muted-foreground">This guide could not be found.</p>
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 pb-24 space-y-6">
      <SettingsHeader title="Tutorial" back="/settings/tutorial" />

      <div>
        <h2 className="text-2xl font-bold text-foreground">{topic.title}</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">{topic.intro}</p>
      </div>

      <div className="space-y-6">
        {topic.steps.map((step, i) => {
          const Illustration = step.illustration;
          return (
            <div key={i} className="space-y-2">
              {Illustration ? (
                <Illustration />
              ) : (
                // Placeholder for topics whose illustrations aren't built yet.
                <div className="flex aspect-video w-full items-center justify-center rounded-2xl border border-border bg-secondary/50">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    [illustration]
                  </span>
                </div>
              )}
              <p className="text-sm text-foreground">
                <span className="font-semibold">Step {i + 1}.</span> {step.caption}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
