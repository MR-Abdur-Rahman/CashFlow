// Shared period selector used by the person / group / history pages. One definition so the
// options (Daily / Weekly / Monthly / Annually) stay in sync everywhere.
import {
  startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear,
  addDays, subDays, addWeeks, subWeeks, addMonths, subMonths, addYears, subYears,
  format, isToday,
} from "date-fns";

export type Period = "daily" | "weekly" | "monthly" | "annually";
export const PERIODS: Period[] = ["daily", "weekly", "monthly", "annually"];

// Display label for the dropdown/button. "daily" shows as "Today" to match the anchor label.
export function periodLabel(p: Period): string {
  return p === "daily" ? "Today" : p.charAt(0).toUpperCase() + p.slice(1);
}

export function getPeriodRange(period: Period, anchor: Date) {
  if (period === "daily") return { from: startOfDay(anchor), to: endOfDay(anchor) };
  if (period === "weekly") return { from: startOfWeek(anchor, { weekStartsOn: 1 }), to: endOfWeek(anchor, { weekStartsOn: 1 }) };
  if (period === "monthly") return { from: startOfMonth(anchor), to: endOfMonth(anchor) };
  return { from: startOfYear(anchor), to: endOfYear(anchor) };
}

export function navigateAnchor(period: Period, anchor: Date, dir: -1 | 1): Date {
  if (period === "daily") return dir === -1 ? subDays(anchor, 1) : addDays(anchor, 1);
  if (period === "weekly") return dir === -1 ? subWeeks(anchor, 1) : addWeeks(anchor, 1);
  if (period === "monthly") return dir === -1 ? subMonths(anchor, 1) : addMonths(anchor, 1);
  return dir === -1 ? subYears(anchor, 1) : addYears(anchor, 1);
}

export function formatAnchorLabel(period: Period, anchor: Date) {
  if (period === "daily") return isToday(anchor) ? "Today" : format(anchor, "MMM d, yyyy");
  if (period === "weekly") return `${format(startOfWeek(anchor, { weekStartsOn: 1 }), "MMM d")} – ${format(endOfWeek(anchor, { weekStartsOn: 1 }), "MMM d, yyyy")}`;
  if (period === "monthly") return format(anchor, "MMM yyyy");
  return format(anchor, "yyyy");
}
