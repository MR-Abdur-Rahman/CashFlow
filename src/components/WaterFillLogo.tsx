// Sea-wave "liquid fill" of the CashFlow logo, shared by Setup step 3/3 and the launch SplashScreen.
// The favicon.svg silhouette is used as a CSS mask over a rising purple→blue body, with three
// overlapping wave layers scrolling horizontally at different speeds/opacities so the surface reads
// like real ocean waves climbing to fill the logo.
//
// Two ways to drive the WATER LEVEL:
//   - Uncontrolled (no `fill`): a one-shot CSS animation rises empty→full over `durationMs` and holds
//     (fill-mode forwards). This is the Setup 3/3 behaviour — unchanged.
//   - Controlled (`fill` 0..1): the level is positioned directly from this value every render, with the
//     CSS rise disabled. The splash drives `fill` from a requestAnimationFrame loop so it tracks real
//     elapsed time and can hold at 100% for an indeterminate load.
// Either way the three wave layers scroll via CSS — that's decorative surface motion, independent of
// the fill level.
//
// Colors are hardcoded (not theme tokens) on purpose: the splash paints before the theme class is
// applied, and the effect is intentionally the same purple→blue in both light and dark.

// The 96px logo's water body sits at top:112px when empty and top:-14px when full (see the .wl-water
// rules below), so a 0..1 fill maps linearly onto that 126px travel.
const EMPTY_TOP = 112;
const FULL_TOP = -14;

export function WaterFillLogo({
  fill,
  durationMs = 2200,
  startOffsetMs = 0,
}: {
  // If provided (0..1), the water level is driven directly from this value (JS/real-time controlled).
  // If omitted, the level runs the one-shot CSS rise instead.
  fill?: number;
  durationMs?: number;
  startOffsetMs?: number;
}) {
  const controlled = fill != null;
  const clamped = Math.max(0, Math.min(1, fill ?? 0));
  const topPx = EMPTY_TOP + clamped * (FULL_TOP - EMPTY_TOP);

  return (
    <>
      <style>{`
        .wl { position: relative; height: 96px; width: 96px; }
        .wl-base { position: absolute; inset: 0; height: 96px; width: 96px; opacity: 0.14; }
        .wl-mask {
          position: absolute; inset: 0; overflow: hidden;
          -webkit-mask: url(/favicon.svg) no-repeat center / contain;
          mask: url(/favicon.svg) no-repeat center / contain;
        }
        .wl-water {
          position: absolute; left: 0; width: 100%; height: 200px;
          top: calc(100% + 16px);
          background: linear-gradient(180deg, #7C3AED 0%, #3B82F6 100%);
          animation: wl-rise 2.2s cubic-bezier(0.45, 0, 0.15, 1) forwards;
        }
        @keyframes wl-rise { to { top: -14px; } }
        .wl-wave {
          position: absolute; bottom: 100%; left: 0; width: 200%; height: 16px;
          background-repeat: repeat-x; background-size: 50% 100%; will-change: transform;
        }
        .wl-wave-1 {
          height: 16px; opacity: 0.5; animation: wl-scroll 3.6s linear infinite;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 16' preserveAspectRatio='none'%3E%3Cpath d='M0 8 Q12 2 24 8 T48 8 T72 8 T96 8 V16 H0 Z' fill='%238B5CF6'/%3E%3C/svg%3E");
        }
        .wl-wave-2 {
          height: 14px; opacity: 0.75; animation: wl-scroll 2.9s linear infinite reverse;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 16' preserveAspectRatio='none'%3E%3Cpath d='M0 8 Q12 3 24 8 T48 8 T72 8 T96 8 V16 H0 Z' fill='%237C3AED'/%3E%3C/svg%3E");
        }
        .wl-wave-3 {
          height: 12px; opacity: 1; animation: wl-scroll 2.3s linear infinite;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 16' preserveAspectRatio='none'%3E%3Cpath d='M0 8 Q12 4 24 8 T48 8 T72 8 T96 8 V16 H0 Z' fill='%236D5EF0'/%3E%3C/svg%3E");
        }
        @keyframes wl-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @media (prefers-reduced-motion: reduce) {
          .wl-wave { animation: none; }
        }
      `}</style>
      <div className="wl">
        <img src="/favicon.svg" alt="" aria-hidden="true" className="wl-base" />
        <div className="wl-mask">
          <div
            className="wl-water"
            style={
              controlled
                ? // Level driven by the real-time `fill` value; disable the CSS rise so it can't fight it.
                  { animation: "none", top: `${topPx}px` }
                : { animationDuration: `${durationMs}ms`, animationDelay: `-${startOffsetMs}ms` }
            }
          >
            <span className="wl-wave wl-wave-1" />
            <span className="wl-wave wl-wave-2" />
            <span className="wl-wave wl-wave-3" />
          </div>
        </div>
      </div>
    </>
  );
}
