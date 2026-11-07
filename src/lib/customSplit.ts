// Shared validation for custom-split amounts — used by CustomSplitSheet (AddTransactionSheet.tsx)
// and EditSplitSheet (home.tsx) so the create and edit paths enforce the exact same rule: the sum
// of OTHER participants' amounts must not exceed the total, which keeps the creator's implicit
// share (total - sum(others), see lib/balance.ts) from going negative and corrupting bilateral
// balance math.

import { formatMoney } from "@/lib/format";

export type SplitParticipant = { id: string; name: string };

export type CustomSplitResult = {
  valid: boolean;
  /** total - sum(entered amounts), rounded to 2dp. Meaningful even when invalid, for display. */
  creatorShare: number;
  message: string | null;
};

// Half a cent — absorbs float rounding noise, not real discrepancies.
const EPSILON = 0.005;

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// Input filter: digits and at most one decimal point, max 2 decimal places. No minus sign, no
// letters. Intended for onChange on a type="text" input (type="number" can't be filtered this way).
export function sanitizeAmountInput(raw: string): string {
  let v = raw.replace(/[^0-9.]/g, "");
  const firstDot = v.indexOf(".");
  if (firstDot !== -1) {
    v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, "");
  }
  const [intPart, decPart] = v.split(".");
  if (decPart !== undefined) v = `${intPart}.${decPart.slice(0, 2)}`;
  return v;
}

/**
 * Validates a custom split's entered amounts against the total.
 *
 * `amounts` may hold raw input strings (live UI) or already-resolved numbers (e.g. re-checking a
 * parent's resolved state) — either is coerced the same way. An empty/missing entry is "not yet
 * entered", never treated as 0.
 *
 * `requireAllFilled`: false lets the live UI compute a running share without flagging untouched
 * fields; true additionally rejects any empty field (used at confirm/submit time).
 */
export function validateCustomSplit(
  amounts: Record<string, string | number | null | undefined>,
  participants: SplitParticipant[],
  total: number,
  requireAllFilled: boolean,
): CustomSplitResult {
  const roundedTotal = round2(total);
  let sum = 0;

  for (const p of participants) {
    const raw = String(amounts[p.id] ?? "").trim();
    if (raw === "") {
      if (requireAllFilled) {
        return { valid: false, creatorShare: roundedTotal, message: `Enter an amount for ${p.name}` };
      }
      continue; // not yet entered — excluded from the running sum, not treated as 0
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) {
      return {
        valid: false,
        creatorShare: roundedTotal,
        message: `Enter a valid amount for ${p.name}`,
      };
    }
    sum = round2(sum + round2(n));
  }

  const creatorShare = round2(roundedTotal - sum);
  if (sum > roundedTotal + EPSILON) {
    return {
      valid: false,
      creatorShare,
      message: `Entered amounts exceed the total by ${formatMoney(round2(sum - roundedTotal))}`,
    };
  }
  return { valid: true, creatorShare, message: null };
}

// Final numeric amounts to persist, once validateCustomSplit (requireAllFilled: true) has passed.
export function resolveCustomAmounts(
  amounts: Record<string, string | number | null | undefined>,
  participants: SplitParticipant[],
): Record<string, number> {
  const result: Record<string, number> = {};
  participants.forEach((p) => {
    result[p.id] = round2(Number(amounts[p.id]) || 0);
  });
  return result;
}
