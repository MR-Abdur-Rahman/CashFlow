import { useEffect, useState } from "react";
import { WaterFillLogo } from "./WaterFillLogo";

// Minimum time the splash stays up, so it never just flashes by. Shared with App.tsx's dismissal
// timer AND used as the water-fill target, so the fill reaches 100% right at the 2.5s floor.
export const SPLASH_MIN_MS = 2500;

// When the splash first painted. Captured once (module scope) so the water fill tracks real elapsed
// time even across the App→RoutedApp splash handoff — both mounts read the same origin, so a remount
// resumes at the current level (or stays held at 100%) instead of restarting from empty.
let splashStartMs: number | null = null;
function getSplashStart(): number {
  if (splashStartMs == null) splashStartMs = Date.now();
  return splashStartMs;
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Branded launch splash shown while the initial session check runs (App.tsx `loading`).
// The gradient lightning-bolt logo does the same sea-wave water-fill as Setup step 3/3, but the water
// LEVEL is driven in real time by requestAnimationFrame (not a fixed-duration CSS animation): it fills
// from empty to full over SPLASH_MIN_MS of actual elapsed time, then HOLDS at 100% for as long as the
// splash stays mounted (i.e. until loading finishes and App unmounts it). So a fast load fills over the
// full 2.5s and dismisses at 100%; a slow load fills by 2.5s then sits filled until loading completes.
//
// Colors are the LIGHT-theme design tokens hardcoded on purpose: this renders before PrefsApplier
// adds the `html.light` class, so `var(--background)` would still be the dark :root default. Hardcoding
// keeps the splash on the app's light theme regardless of when it paints.
export function SplashScreen() {
  const [fill, setFill] = useState(() => {
    // Seed from real elapsed time so a remount (App→RoutedApp) starts at the correct level, not 0.
    const elapsed = Date.now() - getSplashStart();
    return Math.max(0, Math.min(1, elapsed / SPLASH_MIN_MS));
  });

  useEffect(() => {
    if (prefersReducedMotion()) {
      setFill(1);
      return;
    }
    let raf = 0;
    const start = getSplashStart();
    const tick = () => {
      const progress = Math.min(1, (Date.now() - start) / SPLASH_MIN_MS);
      setFill(progress);
      // Keep ticking until full, then stop — leaving fill at 1 so the level holds while loading runs on.
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-6 text-center"
      style={{ background: "oklch(0.99 0 0)" }}
    >
      <WaterFillLogo fill={fill} />

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
