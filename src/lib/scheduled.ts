import { supabase } from "@/integrations/supabase/client";

export type Scheduled = {
  id: string;
  user_id: string;
  type: "income" | "expense" | "transfer";
  amount: number;
  account_id: string;
  to_account_id: string | null;
  category_id: string | null;
  sub_category_id: string | null;
  note: string | null;
  description: string | null;
  day_of_month: number;
  scheduled_time: string;
  is_active: boolean;
  last_posted_date: string | null;
  pending_confirmation: boolean;
  created_at: string;
};

function daysInMonth(y: number, m0: number) {
  return new Date(y, m0 + 1, 0).getDate();
}
function pad(n: number) {
  return String(n).padStart(2, "0");
}
function ymd(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// The date this schedule is due in the CURRENT month. If day_of_month doesn't exist this month
// (e.g. 31 in February) it falls back to the last valid day of the month.
export function currentCycleDueDate(s: { day_of_month: number }, ref = new Date()): string {
  const y = ref.getFullYear();
  const m0 = ref.getMonth();
  const day = Math.min(s.day_of_month, daysInMonth(y, m0));
  return ymd(new Date(y, m0, day));
}

// Is the schedule awaiting confirmation right now? Active, this month's due date+time has passed,
// and it hasn't already been posted or skipped this month.
export function isDue(s: Scheduled, now = new Date()): boolean {
  if (!s.is_active) return false;
  const dueDate = currentCycleDueDate(s, now);
  const dueAt = new Date(`${dueDate}T${(s.scheduled_time ?? "00:00:00").slice(0, 8)}`);
  if (now < dueAt) return false;
  if (!s.last_posted_date) return true;
  const firstOfMonth = ymd(new Date(now.getFullYear(), now.getMonth(), 1));
  return s.last_posted_date < firstOfMonth; // nothing posted/skipped yet this month
}

// Confirm a due schedule → insert the real transaction (the balance trigger updates accounts) and
// stamp last_posted_date so it won't fire again until next month.
export async function postScheduled(s: Scheduled): Promise<void> {
  const dueDate = currentCycleDueDate(s);
  const time = (s.scheduled_time ?? "00:00:00").slice(0, 8);
  const row: Record<string, unknown> = {
    user_id: s.user_id,
    type: s.type,
    amount: Number(s.amount),
    account_id: s.account_id,
    date: dueDate,
    time,
    note: s.note || null,
  };
  if (s.type === "expense") {
    row.category_id = s.category_id;
    row.sub_category_id = s.sub_category_id;
  } else if (s.type === "transfer") {
    row.to_account_id = s.to_account_id;
  } else if (s.type === "income") {
    // Recurring income carries its category, and also posts a "source" label (the app's income feed
    // reads income_source_*), with the note doubling as that label.
    row.category_id = s.category_id;
    row.sub_category_id = s.sub_category_id;
    row.income_source_type = "source";
    row.income_source_text = s.note || "Scheduled income";
  }
  const { error } = await supabase.from("transactions").insert(row as never);
  if (error) throw error;
  const { error: uErr } = await supabase
    .from("scheduled_transactions")
    .update({ last_posted_date: dueDate, pending_confirmation: false } as never)
    .eq("id", s.id);
  if (uErr) throw uErr;
}

// Skip this cycle — stamp it so it won't prompt again until next month; no transaction created.
export async function skipScheduled(s: Scheduled): Promise<void> {
  const dueDate = currentCycleDueDate(s);
  const { error } = await supabase
    .from("scheduled_transactions")
    .update({ last_posted_date: dueDate, pending_confirmation: false } as never)
    .eq("id", s.id);
  if (error) throw error;
}

// Persist the pending_confirmation flag for rows whose stored value disagrees with reality, so a
// badge can read the column cheaply. Best-effort; failures are ignored.
export async function syncPendingFlags(list: Scheduled[]): Promise<void> {
  const now = new Date();
  const toTrue = list.filter((s) => isDue(s, now) && !s.pending_confirmation).map((s) => s.id);
  const toFalse = list.filter((s) => !isDue(s, now) && s.pending_confirmation).map((s) => s.id);
  try {
    if (toTrue.length)
      await supabase
        .from("scheduled_transactions")
        .update({ pending_confirmation: true } as never)
        .in("id", toTrue);
    if (toFalse.length)
      await supabase
        .from("scheduled_transactions")
        .update({ pending_confirmation: false } as never)
        .in("id", toFalse);
  } catch {
    /* advisory only */
  }
}
