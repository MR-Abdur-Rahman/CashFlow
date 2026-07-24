import { WaterFillLogo } from "./WaterFillLogo";

// Minimum time the splash stays up, so it never just flashes by. Shared with App.tsx's dismissal
// timer AND used as the water-fill duration, so the fill reaches 100% exactly as the splash dismisses.
export const SPLASH_MIN_MS = 2500;

// When the splash first painted. Captured once (module scope) so the water fill can be synced to real
// elapsed time even across the App→RoutedApp splash handoff — both mounts share this origin, so the
// fill resumes at the right level instead of restarting.
let splashStartMs: number | null = null;
function splashElapsed(): number {
  if (splashStartMs == null) splashStartMs = Date.now();
  return Date.now() - splashStartMs;
}

// Branded launch splash shown while the initial session check runs (App.tsx `loading`).
// The gradient lightning-bolt logo (public/favicon.svg) does the same sea-wave water-fill as Setup
// step 3/3, but synced to the real splash duration: it fills from empty to full over SPLASH_MIN_MS,
// reaching 100% as the splash dismisses. If loading runs longer than that, it holds at 100% (the
// fill's forwards fill-mode) rather than looping.
//
// Colors are the LIGHT-theme design tokens hardcoded on purpose: this renders before PrefsApplier
// adds the `html.light` class, so `var(--background)` would still be the dark :root default. Hardcoding
// keeps the splash on the app's light theme regardless of when it paints.
export function SplashScreen() {
  return (
    <div
      className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-6 text-center"
      style={{ background: "oklch(0.99 0 0)" }}
    >
      <WaterFillLogo durationMs={SPLASH_MIN_MS} startOffsetMs={splashElapsed()} />

      <div className="space-y-1">
        <p className="text-2xl font-bold" style={{ color: "oklch(0.15 0 0)" }}>
          CashFlow
        </p>
        <p className="text-sm" style={{ color: "oklch(0.45 0.01 286)" }}>
          Your money, all in one place
        </p>
      </div>
    </div>
  );
}
