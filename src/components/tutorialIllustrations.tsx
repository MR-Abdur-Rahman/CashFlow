import type { ReactNode } from "react";
import { Plus, ChevronRight, Check } from "lucide-react";

// Simplified, recreated mockups of the real Add Transaction / Split UI for the Tutorial guides. Built
// entirely from the app's design tokens (bg-card, bg-secondary, text-foreground, text-income, etc.) so
// they render correctly in BOTH light and dark theme — this page follows the normal theme, unlike the
// always-light pre-login carousel. Styling mirrors the real primitives (ui/tabs, ui/button, ui/label,
// AmountInput, AddTransactionSheet toggles/pills) for visual accuracy. Not interactive; illustrative.

// Exact save-button fills from AddTransactionSheet's FormShell `color` prop, per type.
const SAVE = {
  income: "oklch(0.40 0.13 145)",
  expense: "oklch(0.40 0.18 25)",
  transfer: "oklch(0.40 0.13 252)",
};

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-border bg-card ${className}`}>
      {children}
    </div>
  );
}

// Matches the app's <Label>: text-sm font-medium, foreground colour.
function FieldLabel({ children }: { children: ReactNode }) {
  return <p className="mb-1.5 text-sm font-medium">{children}</p>;
}

// Segmented control — matches the `flex gap-2 rounded-lg bg-secondary p-1` toggles. Default buttons are
// text-sm; `small` gives the text-xs font-medium variant used by the "Split with" toggle. Active =
// primary purple, like the real UI.
function Seg({
  items,
  small,
}: {
  items: { label: string; active?: boolean }[];
  small?: boolean;
}) {
  return (
    <div className="flex gap-2 rounded-lg bg-secondary p-1">
      {items.map((it, i) => (
        <div
          key={i}
          className={`flex-1 rounded-md py-1.5 text-center ${
            small ? "text-xs font-medium" : "text-sm"
          } ${it.active ? "bg-primary text-white" : "text-muted-foreground"}`}
        >
          {it.label}
        </div>
      ))}
    </div>
  );
}

// A tappable field pill (label + chevron) — matches px-3 py-2.5 bg-secondary rounded-lg text-sm.
function Pill({ label, muted = false }: { label: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2.5 text-sm">
      <span className={muted ? "text-muted-foreground" : "text-foreground"}>{label}</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </div>
  );
}

// Bottom-sheet header — matches the px-5 pt-5 pb-3 text-base font-semibold row (approximated to p-4).
function SheetHeader({ title }: { title: string }) {
  return <div className="border-b border-border px-4 py-3 text-base font-semibold">{title}</div>;
}

// The four transaction tabs — matches TabsList (grid-cols-4 rounded-lg bg-secondary p-1) + TabsTrigger
// (rounded-md py-1 text-sm font-medium), with the active tab in its type colour.
function TxnTabs({ active }: { active: "income" | "expense" | "transfer" | "split" }) {
  const tabs = [
    { key: "income", label: "Income", bg: "var(--color-income-bg)", cls: "text-income" },
    { key: "expense", label: "Expense", bg: "var(--color-expense-bg)", cls: "text-expense" },
    { key: "transfer", label: "Transfer", bg: "var(--color-transfer-bg)", cls: "text-transfer" },
    { key: "split", label: "Split", bg: "var(--color-split-bg)", cls: "text-split" },
  ] as const;
  return (
    <div className="grid grid-cols-4 rounded-lg bg-secondary p-1 text-center text-sm font-medium">
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <div
            key={t.key}
            className={`whitespace-nowrap rounded-md py-1 ${on ? t.cls : "text-muted-foreground"}`}
            style={on ? { background: t.bg } : undefined}
          >
            {t.label}
          </div>
        );
      })}
    </div>
  );
}

// ─── Topic 1 — Add a transaction ─────────────────────────────────────────────

export function IlloFab() {
  return (
    <Card className="relative h-40 p-3">
      {/* faux screen content */}
      <div className="space-y-2 opacity-70">
        <div className="h-3 w-20 rounded bg-secondary" />
        <div className="h-14 rounded-xl bg-primary/15" />
        <div className="h-3 w-28 rounded bg-secondary" />
        <div className="h-8 rounded-lg bg-secondary" />
      </div>
      {/* the + FAB, highlighted */}
      <div className="absolute bottom-3 right-3">
        <span className="absolute inset-0 rounded-full ring-4 ring-primary/20" />
        <div
          className="grid h-14 w-14 place-items-center rounded-full bg-primary text-white"
          style={{ boxShadow: "0 6px 20px rgba(124,58,237,0.45)" }}
        >
          <Plus className="h-7 w-7" />
        </div>
      </div>
    </Card>
  );
}

export function IlloTxnTabs() {
  return (
    <Card className="p-4">
      <TxnTabs active="expense" />
    </Card>
  );
}

export function IlloExpenseForm() {
  return (
    <Card className="space-y-3 p-4">
      {/* Matches AmountInput: big centered mono figure in the type accent, "LKR" muted below. */}
      <div className="py-1 text-center">
        <p className="font-mono text-4xl font-semibold text-expense">1,200.00</p>
        <p className="mt-1 font-mono text-xs text-muted-foreground">LKR</p>
      </div>
      <div>
        <FieldLabel>From account</FieldLabel>
        <Pill label="Cash" />
      </div>
      <div>
        <FieldLabel>Category</FieldLabel>
        <Pill label="🍔 Food · Lunch" />
      </div>
    </Card>
  );
}

export function IlloSaveButtons() {
  const btns = [
    { label: "Save income", bg: SAVE.income },
    { label: "Save expense", bg: SAVE.expense },
    { label: "Save transfer", bg: SAVE.transfer },
  ];
  return (
    <Card className="space-y-2.5 p-4">
      {btns.map((b) => (
        <div
          key={b.label}
          className="w-full rounded-md py-2 text-center text-sm font-medium text-white"
          style={{ background: b.bg }}
        >
          {b.label}
        </div>
      ))}
    </Card>
  );
}

// ─── Topic 2 — Add a split ───────────────────────────────────────────────────

export function IlloSplitTab() {
  return (
    <Card className="p-4">
      <TxnTabs active="split" />
    </Card>
  );
}

export function IlloSplitWith() {
  return (
    <Card className="space-y-2 p-4">
      <FieldLabel>Split with</FieldLabel>
      <Seg small items={[{ label: "Person", active: true }, { label: "People" }, { label: "Group" }]} />
      <Pill label="Select person" muted />
    </Card>
  );
}

export function IlloSplitPick() {
  const rows = [
    { name: "Alex", checked: true },
    { name: "Sam", checked: true },
    { name: "Jordan", checked: false },
  ];
  return (
    <Card>
      <SheetHeader title="Select People" />
      <div className="divide-y divide-border">
        {rows.map((r) => (
          <div key={r.name} className="flex items-center gap-3 px-4 py-3">
            <div
              className={`grid h-5 w-5 place-items-center rounded border-2 ${
                r.checked ? "border-primary bg-primary" : "border-border"
              }`}
            >
              {r.checked && <Check className="h-3 w-3 text-white" />}
            </div>
            <span className="text-sm font-medium text-foreground">{r.name}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function IlloWhoPaid() {
  return (
    <Card className="space-y-3 p-4">
      <div>
        <FieldLabel>Who paid?</FieldLabel>
        <Seg items={[{ label: "You paid", active: true }, { label: "Other paid" }]} />
      </div>
      <div>
        <FieldLabel>Paid from</FieldLabel>
        <Pill label="Cash" />
      </div>
      <p className="text-xs text-muted-foreground">
        The account field appears only when <span className="font-medium text-foreground">You paid</span>{" "}
        is selected.
      </p>
    </Card>
  );
}

// ─── Topic 3 — Split types ───────────────────────────────────────────────────

export function IlloSplitTypeToggle() {
  return (
    <Card className="space-y-2 p-4">
      <FieldLabel>Split type</FieldLabel>
      <Seg items={[{ label: "Equal", active: true }, { label: "Custom" }]} />
    </Card>
  );
}

export function IlloEqualShare() {
  return (
    <Card className="space-y-3 p-4">
      <Seg items={[{ label: "Equal", active: true }, { label: "Custom" }]} />
      <p className="text-xs text-muted-foreground">
        Each person pays: <span className="font-mono text-foreground">LKR 400.00</span>
      </p>
      <div className="grid grid-cols-3 gap-2">
        {["You", "Alex", "Sam"].map((n) => (
          <div key={n} className="rounded-lg bg-secondary p-2 text-center">
            <p className="text-[11px] text-muted-foreground">{n}</p>
            <p className="font-mono text-sm font-semibold text-foreground">400</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function IlloCustomSplit() {
  const rows: [string, string][] = [
    ["Alex", "500.00"],
    ["Sam", "300.00"],
  ];
  return (
    <Card>
      <SheetHeader title="Custom Split" />
      <div className="border-b border-border bg-secondary/30 px-4 py-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Total</span>
          <span className="font-mono font-semibold text-foreground">1,200.00</span>
        </div>
        <div className="mt-1 flex justify-between">
          <span className="text-muted-foreground">Your share</span>
          <span className="font-mono font-semibold text-income">400.00</span>
        </div>
      </div>
      <div className="divide-y divide-border">
        {rows.map(([n, v]) => (
          <div key={n} className="flex items-center justify-between px-4 py-3">
            <span className="text-sm font-medium text-foreground">{n}</span>
            <div className="flex items-center gap-1">
              <span className="font-mono text-xs text-muted-foreground">LKR</span>
              <span className="w-24 rounded-md border border-border bg-secondary px-2 py-1.5 text-right font-mono text-sm text-foreground">
                {v}
              </span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
