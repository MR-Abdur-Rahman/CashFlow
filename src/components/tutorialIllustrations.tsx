import type { ReactNode } from "react";
import { Plus, ChevronRight, ChevronDown, Check, Search, QrCode, Users, Wallet, Bell, Send } from "lucide-react";

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

// ─── Shared primitives for Batch 2 (people / groups / linking) ───────────────

// Dialog title — matches ui/dialog's DialogTitle (text-lg font-semibold tracking-tight).
function DlgTitle({ children }: { children: ReactNode }) {
  return <p className="text-lg font-semibold tracking-tight">{children}</p>;
}

// Bordered text input — matches ui/input (h-9 rounded-md border border-input bg-transparent px-3, text-sm).
function TextField({ value, placeholder }: { value?: string; placeholder?: string }) {
  return (
    <div className="flex h-9 items-center rounded-md border border-input px-3 text-sm">
      <span className={value ? "text-foreground" : "text-muted-foreground"}>
        {value ?? placeholder ?? ""}
      </span>
    </div>
  );
}

// Primary Save button — matches ui/button default (bg-primary rounded-md text-sm font-medium).
function SaveBtn({ label = "Save" }: { label?: string }) {
  return (
    <div className="w-full rounded-md bg-primary py-2 text-center text-sm font-medium text-white">
      {label}
    </div>
  );
}

// Initials avatar — matches UserAvatar's fallback (bg-primary/20 text-primary font-semibold, bordered).
function InitialsAvatar({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <div
      className="grid shrink-0 place-items-center rounded-full border border-border bg-primary/20 font-semibold text-primary"
      style={{ height: size, width: size, fontSize: Math.round(size * 0.4) }}
    >
      {name.trim()[0]?.toUpperCase() ?? "?"}
    </div>
  );
}

// A contact list row (avatar + name + optional 🔗 badge). The badge is an emoji appended to the name,
// exactly as the Split list renders it.
function PersonRow({ name, linked }: { name: string; linked?: boolean }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <InitialsAvatar name={name} />
      <p className="text-sm font-medium text-foreground">
        {name}
        {linked ? " 🔗" : ""}
      </p>
    </div>
  );
}

// Group-member checkbox row — matches ui/checkbox (h-4 w-4 rounded-sm border-primary, checked bg-primary).
function MemberCheck({ name, checked }: { name: string; checked: boolean }) {
  return (
    <div className="flex items-center gap-3 p-3">
      <div
        className={`grid h-4 w-4 place-items-center rounded-sm border border-primary ${
          checked ? "bg-primary" : ""
        }`}
      >
        {checked && <Check className="h-3 w-3 text-white" />}
      </div>
      <span className="text-sm text-foreground">{name}</span>
    </div>
  );
}

// List toolbar — matches ListToolbar (search pill + h-10 w-10 rounded-lg primary add, optional QR).
function Toolbar({ placeholder, scan }: { placeholder: string; scan?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <div className="w-full rounded-lg bg-secondary py-2 pl-9 pr-3 text-sm text-muted-foreground">
          {placeholder}
        </div>
      </div>
      <div className="relative">
        <span className="absolute inset-0 rounded-lg ring-4 ring-primary/20" />
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-white">
          <Plus className="h-5 w-5" />
        </div>
      </div>
      {scan && (
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-secondary text-foreground">
          <QrCode className="h-5 w-5" />
        </div>
      )}
    </div>
  );
}

// ─── Topic — Create a local person ───────────────────────────────────────────

export function IlloPeopleToolbar() {
  return (
    <Card className="p-4">
      <Toolbar placeholder="Search people" scan />
    </Card>
  );
}

export function IlloAddPersonDialog() {
  return (
    <Card className="space-y-4 p-4">
      <DlgTitle>Add person</DlgTitle>
      <div>
        <FieldLabel>Name</FieldLabel>
        <TextField value="Alex" />
      </div>
      <div>
        <FieldLabel>Phone (optional)</FieldLabel>
        <TextField placeholder="+94..." />
      </div>
      <SaveBtn />
    </Card>
  );
}

export function IlloLocalPersonRow() {
  return (
    <Card>
      <PersonRow name="Alex" />
    </Card>
  );
}

// ─── Topic — Create a group ──────────────────────────────────────────────────

export function IlloGroupToolbar() {
  return (
    <Card className="p-4">
      <Toolbar placeholder="Search groups" />
    </Card>
  );
}

export function IlloAddGroupDialog() {
  return (
    <Card className="space-y-4 p-4">
      <DlgTitle>Create group</DlgTitle>
      <div>
        <FieldLabel>Name</FieldLabel>
        <TextField value="Roomies" />
      </div>
      <div className="space-y-2">
        <FieldLabel>Members</FieldLabel>
        <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
          <MemberCheck name="Alex" checked />
          <MemberCheck name="Sam" checked />
          <MemberCheck name="Jordan" checked={false} />
        </div>
      </div>
      <SaveBtn />
    </Card>
  );
}

export function IlloGroupInList() {
  return (
    <Card>
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-split/20 text-split">
          <Users className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">Roomies</p>
          <p className="text-xs text-muted-foreground">3 members</p>
        </div>
        <div className="flex -space-x-2">
          {["A", "S", "J"].map((i) => (
            <div
              key={i}
              className="grid h-6 w-6 place-items-center rounded-full border-2 border-card bg-primary/20 text-[10px] font-semibold text-primary"
            >
              {i}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

// ─── Topic — Local vs CashFlow person ────────────────────────────────────────

export function IlloScanToLink() {
  return (
    <Card className="flex flex-col items-center gap-2 p-6 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-secondary text-foreground">
        <QrCode className="h-9 w-9" />
      </div>
      <p className="text-sm font-medium text-foreground">Scan their CashFlow QR</p>
      <p className="text-xs text-muted-foreground">Connects you both as linked contacts 🔗</p>
    </Card>
  );
}

export function IlloLinkedPersonRow() {
  return (
    <Card>
      <PersonRow name="Sam" linked />
    </Card>
  );
}

// ─── Shared primitives for Batch 3 (settlement / pending) ────────────────────

// Dropdown-style select trigger — matches ui/select's SelectTrigger (h-9 rounded-md border-input +
// a chevron), used for Method / Account pickers.
function SelectMock({ value }: { value: string }) {
  return (
    <div className="flex h-9 items-center justify-between rounded-md border border-input px-3 text-sm">
      <span className="text-foreground">{value}</span>
      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
    </div>
  );
}

// ─── Topic — Do a settlement ─────────────────────────────────────────────────

export function IlloSettleTrigger() {
  return (
    <Card className="space-y-3 p-4">
      {/* The person's net balance card (real .balance-gradient) — white text over the purple gradient. */}
      <div className="balance-gradient rounded-2xl p-4">
        <p className="font-mono text-xs uppercase text-white/70">Net balance</p>
        <p className="mt-1 font-mono text-2xl font-bold text-white">+1,000.00</p>
        <p className="mt-1 font-mono text-xs text-white/70">owes you</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-md border border-border py-2 text-center text-sm font-medium text-foreground">
          Add Split
        </div>
        <div className="rounded-md border border-border py-2 text-center text-sm font-medium text-income">
          Settle Up
        </div>
      </div>
    </Card>
  );
}

export function IlloSettleAmount() {
  return (
    <Card className="space-y-4 p-4">
      {/* Net summary — green when you're owed (You lent), red when you owe. */}
      <div className="flex items-center justify-between rounded-xl bg-secondary/50 px-4 py-3">
        <span className="text-sm text-muted-foreground">You lent</span>
        <span className="font-mono text-lg font-semibold text-income">1,000.00</span>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Amount to settle</span>
          <span className="text-[11px] text-primary underline">Full amount</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">LKR</span>
          <div className="flex-1 rounded-md border border-border bg-secondary px-3 py-2 text-right font-mono text-sm font-semibold text-income">
            600.00
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Records a payment against your net balance.
        </p>
      </div>
    </Card>
  );
}

export function IlloSettleMethod() {
  return (
    <Card className="space-y-4 p-4">
      <div>
        <FieldLabel>Method</FieldLabel>
        <SelectMock value="Bank transfer" />
      </div>
      <div>
        <FieldLabel>Account</FieldLabel>
        <SelectMock value="HNB · Savings" />
      </div>
    </Card>
  );
}

export function IlloSettleResult() {
  return (
    <Card className="divide-y divide-border">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-sm text-foreground">Paid in full</span>
        <span className="text-[12px] font-medium text-settled">Fully settled</span>
      </div>
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-sm text-foreground">Paid part</span>
        <span className="font-mono text-[12px] text-muted-foreground">Still lent · 400 remaining</span>
      </div>
    </Card>
  );
}

// ─── Topic — Pending account selection ───────────────────────────────────────

export function IlloPendingCard() {
  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-foreground">Pending</span>
        <span
          className="grid h-[18px] min-w-[18px] place-items-center rounded-full px-1.5 text-[10px] font-bold text-white"
          style={{ background: "#EF4444" }}
        >
          1
        </span>
      </div>
      <div className="space-y-2 rounded-xl border border-border p-3">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-foreground">Dinner</p>
          <span className="shrink-0 font-mono text-sm font-semibold text-split">1,250.00</span>
        </div>
        <p className="text-xs text-muted-foreground">Alex added this split</p>
      </div>
    </Card>
  );
}

export function IlloPendingConfirm() {
  return (
    <Card className="space-y-2.5 p-4">
      <SelectMock value="🍔 Food" />
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <SelectMock value="Cash" />
        </div>
        <div
          className="rounded-md px-4 py-2 text-sm font-medium text-white"
          style={{ background: "#78350F" }}
        >
          Confirm
        </div>
      </div>
    </Card>
  );
}

export function IlloAccountDeducted() {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-secondary text-foreground">
          <Wallet className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">Cash</p>
          <p className="text-xs text-expense">−1,250.00 recorded</p>
        </div>
        <span className="font-mono text-sm font-semibold text-foreground">8,750.00</span>
      </div>
    </Card>
  );
}

// ─── Topic — Schedule transactions ───────────────────────────────────────────

export function IlloScheduledToolbar() {
  return (
    <Card className="p-4">
      <Toolbar placeholder="Search scheduled" />
    </Card>
  );
}

export function IlloScheduledForm() {
  return (
    <Card className="space-y-3 p-4">
      {/* Scheduled sheet mirrors Add Transaction, minus Split — three type tabs. */}
      <div className="grid grid-cols-3 rounded-lg bg-secondary p-1 text-center text-sm font-medium">
        <div className="whitespace-nowrap rounded-md py-1 text-muted-foreground">Income</div>
        <div
          className="whitespace-nowrap rounded-md py-1 text-expense"
          style={{ background: "var(--color-expense-bg)" }}
        >
          Expense
        </div>
        <div className="whitespace-nowrap rounded-md py-1 text-muted-foreground">Transfer</div>
      </div>
      <div className="py-1 text-center">
        <p className="font-mono text-3xl font-semibold text-expense">15,000.00</p>
        <p className="mt-1 font-mono text-xs text-muted-foreground">LKR</p>
      </div>
      <div>
        <FieldLabel>Description</FieldLabel>
        <TextField value="Rent" />
      </div>
      <div>
        <FieldLabel>From account</FieldLabel>
        <SelectMock value="HNB · Savings" />
      </div>
      <div>
        <FieldLabel>Category</FieldLabel>
        <Pill label="🏠 Housing" />
      </div>
    </Card>
  );
}

export function IlloScheduledRecurrence() {
  return (
    <Card className="space-y-3 p-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel>Day of month</FieldLabel>
          <SelectMock value="15" />
        </div>
        <div>
          <FieldLabel>Time</FieldLabel>
          <SelectMock value="9:00 AM" />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Runs on day 15 each month.</p>
      <div
        className="w-full rounded-md py-2 text-center text-sm font-medium text-white"
        style={{ background: SAVE.expense }}
      >
        Create schedule
      </div>
    </Card>
  );
}

export function IlloScheduledDue() {
  return (
    <Card className="space-y-2 p-4">
      <p className="text-base font-semibold text-foreground">Scheduled transactions due</p>
      <p className="text-xs text-muted-foreground">Confirm to record them, or skip this month.</p>
      <div className="space-y-1 rounded-xl border border-border p-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">Rent</p>
          <span className="font-mono text-sm font-semibold text-expense">15,000.00</span>
        </div>
        <p className="text-xs text-muted-foreground">HNB · Savings · Jul 15</p>
        <div className="grid grid-cols-2 gap-2 pt-1.5">
          <div className="rounded-md py-1.5 text-center text-sm font-medium text-muted-foreground">
            Skip
          </div>
          <div className="rounded-md bg-primary py-1.5 text-center text-sm font-medium text-white">
            Confirm
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─── Topic — Reminders (send a payment reminder) ─────────────────────────────

export function IlloReminderTrigger() {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <InitialsAvatar name="Alex" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">Alex</p>
          <p className="text-xs text-income">owes you 1,000</p>
        </div>
        <div className="relative">
          <span className="absolute inset-0 rounded-full ring-4 ring-primary/20" />
          <div className="grid h-10 w-10 place-items-center rounded-full bg-secondary text-foreground">
            <Bell className="h-5 w-5" />
          </div>
        </div>
      </div>
    </Card>
  );
}

export function IlloReminderDialog() {
  return (
    <Card className="space-y-4 p-4">
      <DlgTitle>Send reminder</DlgTitle>
      <div>
        <FieldLabel>Message</FieldLabel>
        <div className="rounded-md border border-input px-3 py-2 text-sm leading-relaxed text-foreground">
          Hi Alex, friendly reminder you owe LKR 1,000.00 for Dinner. Thanks!
        </div>
      </div>
      <div className="flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2 text-sm font-medium text-white">
        <Send className="h-4 w-4" /> Send
      </div>
    </Card>
  );
}

export function IlloReminderNotification() {
  return (
    <Card className="p-4">
      <div className="flex gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
          <Bell className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">Payment reminder</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Hi Alex, friendly reminder you owe LKR 1,000.00 for Dinner. Thanks!
          </p>
        </div>
      </div>
    </Card>
  );
}
