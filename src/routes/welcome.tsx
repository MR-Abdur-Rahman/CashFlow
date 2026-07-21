import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";

// Post-onboarding intro carousel: shown after guided Setup completes (Setup's Done button routes here
// with onboarded_at already set) and re-shown on demand via Settings → Tutorial → "Replay intro".
// Finishing the last slide goes to /home. There's no localStorage gate — appearance is driven by the
// Setup flow (onboarded_at, one-time per account) and by explicit replay navigation.

// Always-light, like SplashScreen / auth / setup — these render before the theme is applied, so the
// light-theme token values are hardcoded rather than read from var(--…).
const LIGHT = {
  bg: "oklch(0.99 0 0)",
  fg: "oklch(0.15 0 0)",
  muted: "oklch(0.45 0.01 286)",
  border: "oklch(0.9 0 0)",
};
const PURPLE = "#7C3AED";
const BLUE = "#3B82F6";
const EMERALD = "#10B981";
const AMBER = "#F59E0B";
const GRADIENT_H = "linear-gradient(90deg, #7C3AED 0%, #3B82F6 100%)";

const SLIDES = [
  {
    title: "Every account, one clear balance",
    subtitle: "Track cash, bank and e-wallet side by side, always up to date.",
  },
  {
    title: "Split bills, skip the awkward math",
    subtitle: "Share expenses with friends and groups — CashFlow does the settling up.",
  },
  {
    title: "See where your money actually goes",
    subtitle: "Clear charts turn your spending into insight you can act on.",
  },
];

export default function IntroCarousel() {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef<number | null>(null);
  const last = SLIDES.length - 1;

  function finish() {
    navigate("/home");
  }
  const goNext = () => setIndex((i) => Math.min(last, i + 1));

  function onPointerDown(e: React.PointerEvent) {
    startX.current = e.clientX;
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (startX.current == null) return;
    let dx = e.clientX - startX.current;
    // Resistance at the ends so the track can't be dragged past the first/last slide.
    if ((index === 0 && dx > 0) || (index === last && dx < 0)) dx *= 0.3;
    setDrag(dx);
  }
  function onPointerUp(e: React.PointerEvent) {
    if (startX.current == null) return;
    const dx = e.clientX - startX.current;
    startX.current = null;
    setDragging(false);
    const threshold = 50;
    if (dx <= -threshold && index < last) setIndex((i) => i + 1);
    else if (dx >= threshold && index > 0) setIndex((i) => i - 1);
    setDrag(0);
  }

  return (
    <div
      className="relative overflow-hidden"
      style={{ background: LIGHT.bg, height: "100dvh", touchAction: "pan-y" }}
    >
      <Styles />

      {/* Swipe track */}
      <div
        className="flex h-full"
        style={{
          transform: `translateX(calc(${-index * 100}% + ${drag}px))`,
          transition: dragging ? "none" : "transform 0.35s ease",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {SLIDES.map((s, i) => (
          <section
            key={i}
            className={`intro-slide ${i === index ? "intro-slide--active" : ""} w-full shrink-0 h-full flex flex-col items-center justify-center px-8 pb-36 text-center`}
          >
            <div className="flex h-56 w-full items-center justify-center">
              {i === 0 && <SlideTrack />}
              {i === 1 && <SlideSplit />}
              {i === 2 && <SlideInsights />}
            </div>
            <h1 className="anim-rise mt-8 text-2xl font-bold" style={{ color: LIGHT.fg }}>
              {s.title}
            </h1>
            <p
              className="anim-rise anim-d1 mt-2 max-w-xs text-sm leading-relaxed"
              style={{ color: LIGHT.muted }}
            >
              {s.subtitle}
            </p>
          </section>
        ))}
      </div>

      {/* Bottom controls: dots + next arrow, or the final CTA on the last slide */}
      <div className="absolute inset-x-0 bottom-0 px-8 pb-10">
        <div className="flex items-center justify-center gap-2">
          {SLIDES.map((_, i) => (
            <span
              key={i}
              className="h-2 rounded-full transition-all"
              style={{
                width: i === index ? 22 : 8,
                background: i === index ? PURPLE : LIGHT.border,
              }}
            />
          ))}
        </div>

        {index < last ? (
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              aria-label="Next"
              onClick={goNext}
              className="grid h-14 w-14 place-items-center rounded-full text-white"
              style={{ background: GRADIENT_H }}
            >
              <ArrowRight className="h-6 w-6" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={finish}
            className="mt-6 w-full rounded-xl py-3.5 text-sm font-semibold text-white"
            style={{ background: GRADIENT_H }}
          >
            Go to CashFlow
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Slide 1: Track (floating balance card + account chips + sparkles) ────────
function SlideTrack() {
  return (
    <svg viewBox="0 0 280 210" width="100%" height="100%" role="img" aria-label="Balance overview">
      <defs>
        <linearGradient id="balGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={PURPLE} />
          <stop offset="1" stopColor={BLUE} />
        </linearGradient>
      </defs>

      {/* Balance card */}
      <g className="anim-float">
        <rect x="42" y="14" width="196" height="92" rx="18" fill="url(#balGrad)" />
        <text x="62" y="46" fill="#FFFFFF" fillOpacity="0.85" fontSize="10" letterSpacing="1.5">
          TOTAL BALANCE
        </text>
        <text x="62" y="82" fill="#FFFFFF" fontSize="26" fontWeight="700">
          LKR 128,450
        </text>
      </g>

      {/* Sparkles */}
      <g fill="#FFFFFF">
        <path className="anim-spark" d="M228 26 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 z" />
        <path className="anim-spark anim-d2" d="M56 96 l1.5 4 4 1.5 -4 1.5 -1.5 4 -1.5 -4 -4 -1.5 4 -1.5 z" fill={AMBER} />
      </g>

      {/* Account chips */}
      <g className="anim-rise anim-d1">
        <rect x="42" y="132" width="94" height="46" rx="13" fill="#FFFFFF" stroke={LIGHT.border} />
        <circle cx="62" cy="155" r="7" fill={EMERALD} />
        <text x="78" y="151" fill={LIGHT.fg} fontSize="12" fontWeight="600">Cash</text>
        <text x="78" y="167" fill={LIGHT.muted} fontSize="10">24,000</text>
      </g>
      <g className="anim-rise anim-d2">
        <rect x="144" y="132" width="94" height="46" rx="13" fill="#FFFFFF" stroke={LIGHT.border} />
        <circle cx="164" cy="155" r="7" fill={BLUE} />
        <text x="180" y="151" fill={LIGHT.fg} fontSize="12" fontWeight="600">Bank</text>
        <text x="180" y="167" fill={LIGHT.muted} fontSize="10">104,450</text>
      </g>
    </svg>
  );
}

// ─── Slide 2: Split (linked avatars + traveling dot + expense rows) ───────────
function SlideSplit() {
  return (
    <svg viewBox="0 0 280 210" width="100%" height="100%" role="img" aria-label="Splitting expenses">
      {/* Connection line + traveling dot */}
      <line x1="96" y1="42" x2="184" y2="42" stroke="#C4B5FD" strokeWidth="2" strokeDasharray="5 5" />
      <circle className="anim-travel" cx="96" cy="42" r="4" fill={PURPLE} />

      {/* Avatars */}
      <g className="anim-rise">
        <circle cx="70" cy="42" r="26" fill={PURPLE} />
        <text x="70" y="49" textAnchor="middle" fill="#FFFFFF" fontSize="20" fontWeight="700">A</text>
      </g>
      <g className="anim-rise anim-d1">
        <circle cx="210" cy="42" r="26" fill={BLUE} />
        <text x="210" y="49" textAnchor="middle" fill="#FFFFFF" fontSize="20" fontWeight="700">B</text>
      </g>

      {/* Expense rows */}
      <g className="anim-drop anim-d1">
        <rect x="26" y="96" width="228" height="42" rx="13" fill="#FFFFFF" stroke={LIGHT.border} />
        <text x="42" y="122" fill={LIGHT.fg} fontSize="12">🍽  Dinner · split equally</text>
        <text x="238" y="122" textAnchor="end" fill={EMERALD} fontSize="12" fontWeight="700">+1,250</text>
      </g>
      <g className="anim-drop anim-d2">
        <rect x="26" y="146" width="228" height="42" rx="13" fill="#FFFFFF" stroke={LIGHT.border} />
        <text x="42" y="172" fill={LIGHT.fg} fontSize="12">🚕  Taxi · you paid</text>
        <text x="238" y="172" textAnchor="end" fill={AMBER} fontSize="12" fontWeight="700">−600</text>
      </g>
    </svg>
  );
}

// ─── Slide 3: Insights (self-drawing donut + growing bars) ────────────────────
function SlideInsights() {
  // Donut: r=46 → circumference ≈ 289.03. Segments 35 / 28 / 22 / 15 %.
  const segs = [
    { color: PURPLE, len: 101.16, rot: -90, cls: "donut-1" },
    { color: BLUE, len: 80.93, rot: 36, cls: "donut-2" },
    { color: EMERALD, len: 63.59, rot: 136.8, cls: "donut-3" },
    { color: AMBER, len: 43.35, rot: 216, cls: "donut-4" },
  ];
  const bars = [
    { x: 176, y: 130, h: 40, color: PURPLE, cls: "bar-1" },
    { x: 196, y: 106, h: 64, color: BLUE, cls: "bar-2" },
    { x: 216, y: 118, h: 52, color: EMERALD, cls: "bar-3" },
    { x: 236, y: 92, h: 78, color: AMBER, cls: "bar-4" },
  ];
  return (
    <svg viewBox="0 0 280 200" width="100%" height="100%" role="img" aria-label="Spending insights">
      {/* Donut */}
      <g>
        {segs.map((s) => (
          <circle
            key={s.cls}
            className={`donut-seg ${s.cls}`}
            cx="90"
            cy="96"
            r="46"
            fill="none"
            stroke={s.color}
            strokeWidth="22"
            strokeDasharray={`${s.len} 289.03`}
            transform={`rotate(${s.rot} 90 96)`}
          />
        ))}
        <text x="90" y="100" textAnchor="middle" fill={LIGHT.muted} fontSize="11" fontWeight="600">
          Spending
        </text>
      </g>

      {/* Bars (baseline y = 170) */}
      <g>
        {bars.map((b) => (
          <rect
            key={b.cls}
            className={`bar ${b.cls}`}
            x={b.x}
            y={b.y}
            width="14"
            height={b.h}
            rx="4"
            fill={b.color}
          />
        ))}
        <line x1="170" y1="171" x2="252" y2="171" stroke={LIGHT.border} strokeWidth="1.5" />
      </g>
    </svg>
  );
}

// ─── Animation styles ────────────────────────────────────────────────────────
// Base states are the FINAL/visible state, so off-screen slides and reduced-motion users render
// correctly. The entrance animations start from a hidden state and only run while a slide is active,
// re-playing each time it becomes active.
function Styles() {
  return (
    <style>{`
      @keyframes intro-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
      @keyframes intro-drop { from { opacity: 0; transform: translateY(-14px); } to { opacity: 1; transform: none; } }
      @keyframes intro-spark { 0%,100% { opacity: 0; transform: scale(0.4); } 50% { opacity: 1; transform: scale(1); } }
      @keyframes intro-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
      @keyframes intro-travel { 0% { transform: translateX(0); } 50% { transform: translateX(88px); } 100% { transform: translateX(0); } }
      @keyframes intro-donut { from { stroke-dashoffset: var(--len); } to { stroke-dashoffset: 0; } }
      @keyframes intro-bar { from { transform: scaleY(0); } to { transform: scaleY(1); } }

      .anim-d1 { animation-delay: 0.12s; }
      .anim-d2 { animation-delay: 0.24s; }

      /* Entrance elements: hidden until their slide is active. */
      .intro-slide:not(.intro-slide--active) .anim-rise,
      .intro-slide:not(.intro-slide--active) .anim-drop,
      .intro-slide:not(.intro-slide--active) .anim-spark { opacity: 0; }

      .intro-slide--active .anim-rise { animation-name: intro-rise; animation-duration: 0.6s; animation-fill-mode: both; animation-timing-function: cubic-bezier(0.22, 1, 0.36, 1); }
      .intro-slide--active .anim-drop { animation-name: intro-drop; animation-duration: 0.55s; animation-fill-mode: both; animation-timing-function: cubic-bezier(0.22, 1, 0.36, 1); }
      .intro-slide--active .anim-spark { animation-name: intro-spark; animation-duration: 1.8s; animation-iteration-count: infinite; }
      .intro-slide--active .anim-float { animation: intro-float 3s ease-in-out infinite; }
      .intro-slide--active .anim-travel { animation: intro-travel 1.9s ease-in-out infinite; }

      .donut-seg { stroke-dashoffset: 0; }
      .intro-slide--active .donut-seg { animation-name: intro-donut; animation-duration: 0.9s; animation-fill-mode: both; animation-timing-function: ease-out; }
      .donut-1 { --len: 101.16; }
      .donut-2 { --len: 80.93; animation-delay: 0.15s; }
      .donut-3 { --len: 63.59; animation-delay: 0.3s; }
      .donut-4 { --len: 43.35; animation-delay: 0.45s; }

      .bar { transform-box: fill-box; transform-origin: bottom; }
      .intro-slide--active .bar { animation-name: intro-bar; animation-duration: 0.6s; animation-fill-mode: both; animation-timing-function: cubic-bezier(0.22, 1, 0.36, 1); }
      .bar-1 { animation-delay: 0.1s; }
      .bar-2 { animation-delay: 0.22s; }
      .bar-3 { animation-delay: 0.34s; }
      .bar-4 { animation-delay: 0.46s; }

      @media (prefers-reduced-motion: reduce) {
        .intro-slide .anim-rise, .intro-slide .anim-drop, .intro-slide .anim-spark,
        .intro-slide .anim-float, .intro-slide .anim-travel, .donut-seg, .bar { animation: none !important; opacity: 1 !important; transform: none !important; }
        .donut-seg { stroke-dashoffset: 0 !important; }
      }
    `}</style>
  );
}
