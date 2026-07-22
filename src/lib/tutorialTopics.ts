import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Receipt,
  Split,
  Users,
  UserPlus,
  Handshake,
  Wallet,
  CalendarClock,
  Bell,
  Contact,
  Scale,
} from "lucide-react";
import {
  IlloFab,
  IlloTxnTabs,
  IlloExpenseForm,
  IlloSaveButtons,
  IlloSplitTab,
  IlloSplitWith,
  IlloSplitPick,
  IlloWhoPaid,
  IlloSplitTypeToggle,
  IlloEqualShare,
  IlloCustomSplit,
} from "@/components/tutorialIllustrations";

// Data model for the Tutorial guides. Both the list (settings-tutorial.tsx) and the shared detail page
// (settings-tutorial-detail.tsx) read from this single source. Topics without an `illustration` on a
// step still render the grey placeholder box — filled in topic-by-topic.
export type TutorialStep = {
  caption: string;
  // A recreated-mockup illustration component (see components/tutorialIllustrations.tsx). When absent,
  // the detail page shows a grey [illustration] placeholder.
  illustration?: ComponentType;
};

export type TutorialTopic = {
  id: string; // slug used in /settings/tutorial/:topicId
  icon: LucideIcon;
  title: string;
  desc: string; // one-line description shown in the list
  intro: string; // short intro paragraph on the detail page
  steps: TutorialStep[];
};

export const TUTORIAL_TOPICS: TutorialTopic[] = [
  {
    id: "add-transaction",
    icon: Receipt,
    title: "Add a transaction",
    desc: "Record income, an expense, or a transfer",
    intro: "Log money coming in, going out, or moving between your own accounts.",
    steps: [
      { caption: "Tap + to open Add Transaction.", illustration: IlloFab },
      { caption: "Choose a tab: Income, Expense, Transfer, or Split.", illustration: IlloTxnTabs },
      { caption: "Enter the amount, account, and category.", illustration: IlloExpenseForm },
      { caption: "Save — colour shows the type, balance updates instantly.", illustration: IlloSaveButtons },
    ],
  },
  {
    id: "add-split",
    icon: Split,
    title: "Add a split",
    desc: "Split an expense with a person, people, or a group",
    intro: "Share a cost with others and let CashFlow keep track of who owes what.",
    steps: [
      { caption: "Open the Split tab.", illustration: IlloSplitTab },
      { caption: "Choose Person, People, or Group.", illustration: IlloSplitWith },
      { caption: "Pick who's in the split.", illustration: IlloSplitPick },
      { caption: "Set who paid — “You paid” shows the account field.", illustration: IlloWhoPaid },
    ],
  },
  {
    id: "create-group",
    icon: Users,
    title: "Create a group",
    desc: "Group people for shared, recurring splits",
    intro: "Bundle people together for trips, households, or anything you split often.",
    steps: [
      { caption: "On the Split tab, open Groups and tap Add." },
      { caption: "Name the group and add its members." },
      { caption: "Save — you can now split expenses across the whole group at once." },
    ],
  },
  {
    id: "create-local-person",
    icon: UserPlus,
    title: "Create a local person",
    desc: "Add someone who isn't on CashFlow",
    intro: "Track splits with friends who don't use the app — no account needed.",
    steps: [
      { caption: "On the Split tab (People), tap Add." },
      { caption: "Enter their name, and an optional nickname." },
      { caption: "Save — they appear as a local person you can split with." },
    ],
  },
  {
    id: "do-settlement",
    icon: Handshake,
    title: "Do a settlement",
    desc: "Record a payment that clears a balance",
    intro: "When money changes hands to settle up, record it so the balance zeroes out.",
    steps: [
      { caption: "Open a person with an outstanding balance and tap Settle up." },
      { caption: "Enter the amount and how it was paid — cash, bank, or e-wallet." },
      { caption: "Confirm — the balance and the account update accordingly." },
    ],
  },
  {
    id: "pending-account-selection",
    icon: Wallet,
    title: "Pending account selection",
    desc: "Why some splits and settlements wait for you",
    intro: "When you owe on a split someone else created, CashFlow waits for you to say which account it came out of.",
    steps: [
      { caption: "Open the Pending tab on the Split screen to see items awaiting your input." },
      { caption: "Pick the account (and category) the money moved through." },
      { caption: "Confirm — the amount is deducted and the item leaves Pending." },
    ],
  },
  {
    id: "schedule-transactions",
    icon: CalendarClock,
    title: "Schedule transactions",
    desc: "Automate recurring income, bills and transfers",
    intro: "Set up transactions that recur on a chosen day each month.",
    steps: [
      { caption: "Go to Settings → Scheduled transactions and tap Add." },
      { caption: "Choose the type, amount, account, and day of the month." },
      { caption: "On the due day, CashFlow prompts you to confirm and post it." },
    ],
  },
  {
    id: "reminders",
    icon: Bell,
    title: "Reminders",
    desc: "Get nudged about payments and daily logging",
    intro: "Choose which reminders and alerts CashFlow sends you.",
    steps: [
      { caption: "Go to Settings → Notifications." },
      { caption: "Toggle reminders for splits, settlements, and a daily logging nudge." },
      { caption: "Set your preferred daily reminder time." },
    ],
  },
  {
    id: "local-vs-cashflow-person",
    icon: Contact,
    title: "Local vs CashFlow person",
    desc: "The difference between the two kinds of people",
    intro: "The people you split with come in two kinds — here's how they differ.",
    steps: [
      { caption: "A local person exists only in your app; you track their balance yourself." },
      { caption: "A CashFlow person is linked to a real account, so splits sync both ways." },
      { caption: "Connect via QR or phone number to turn a contact into a linked CashFlow person." },
    ],
  },
  {
    id: "split-types",
    icon: Scale,
    title: "Split types — Equal vs Custom",
    desc: "Choose how a cost is divided",
    intro: "CashFlow can divide a split evenly, or by exact amounts you set.",
    steps: [
      { caption: "Toggle Equal or Custom.", illustration: IlloSplitTypeToggle },
      { caption: "Equal: split evenly, shares auto-calculated.", illustration: IlloEqualShare },
      { caption: "Custom: set each amount; must total the full amount.", illustration: IlloCustomSplit },
    ],
  },
];
