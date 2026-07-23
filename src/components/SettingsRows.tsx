import { ArrowLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Switch } from "@/components/ui/switch";
import { useBack } from "@/lib/navBack";

// Shared building blocks for the Settings hub + sub-pages. Pure presentation — no logic moved here.

// Back arrow + page title. Defaults to the logical parent of the current route (see navBack); pass
// `back` to force a specific destination. Either way it goes UP the hierarchy (replace), so back is
// consistent with the hardware/gesture back button.
export function SettingsHeader({ title, back }: { title: string; back?: string }) {
  const navigate = useNavigate();
  const goBack = useBack();
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => (back ? navigate(back, { replace: true }) : goBack())}
        aria-label="Back"
        className="-ml-1 p-1 text-muted-foreground"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>
      <h1 className="text-xl font-semibold">{title}</h1>
    </div>
  );
}

export function Section({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <section>
      {label && (
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2 px-1 font-medium">
          {label}
        </p>
      )}
      <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden shadow-sm">
        {children}
      </div>
    </section>
  );
}

export function Row({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-4 text-sm hover:bg-secondary/40 text-left"
    >
      <span className="text-muted-foreground">{icon}</span>
      <span className="flex-1">{label}</span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}

export function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between p-4">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export function ThemeChoice({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-2 py-3 rounded-lg border text-sm transition-colors ${
        active
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon} {label}
    </button>
  );
}
