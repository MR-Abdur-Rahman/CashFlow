// Branded launch splash shown while the initial session check runs (App.tsx `loading`).
// The gradient lightning-bolt logo (public/favicon.svg, same asset as the App Info page) does a
// two-beat "heartbeat" pulse then rests, looping every 1.4s.
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
      <style>{`
        @keyframes cashflow-heartbeat {
          0%   { transform: scale(1); }
          10%  { transform: scale(1.12); }
          20%  { transform: scale(1); }
          30%  { transform: scale(1.12); }
          40%  { transform: scale(1); }
          100% { transform: scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .cashflow-splash-logo { animation: none !important; }
        }
      `}</style>

      <img
        src="/favicon.svg"
        alt="CashFlow"
        className="cashflow-splash-logo h-24 w-24"
        style={{
          transformOrigin: "center",
          animation: "cashflow-heartbeat 1.4s ease-in-out infinite",
        }}
      />

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
