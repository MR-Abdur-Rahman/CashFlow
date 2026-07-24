import { WaterFillLogo } from "./WaterFillLogo";

// Branded launch splash shown while the initial session check runs (App.tsx `loading`).
// The gradient lightning-bolt logo (public/favicon.svg) does the same sea-wave water-fill as Setup
// step 3/3, looping (rise → hold → drain) since the splash stays up for an indeterminate time.
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
      <WaterFillLogo loop />

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
