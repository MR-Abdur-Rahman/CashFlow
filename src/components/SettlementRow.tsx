import { formatMoney } from "@/lib/format";
import { format } from "date-fns";
import { ArrowLeftRight } from "lucide-react";
import { UserAvatar } from "./UserAvatar";

// Shared settlement row used on Home, Account detail, Person detail and History so the
// format stays identical everywhere. Direction is from the VIEWER's perspective:
//   iPaid  → "You → Other"  + "Still owes"   (the viewer is the one who paid / owes)
//   !iPaid → "Other → You"  + "Still lent"   (the other person paid; the viewer is owed)
export function SettlementRow({
  description,
  iPaid,
  otherName,
  amount,
  remaining,
  fullySettled,
  createdAt,
  netAfter,
  avatarUrl,
  iconAvatar,
}: {
  description?: string | null;
  iPaid: boolean;
  otherName: string;
  amount: number;
  remaining?: number;
  fullySettled?: boolean;
  createdAt?: string;
  // Person page: show a settlement TYPE icon instead of the counterparty photo.
  iconAvatar?: boolean;
  // Optional (person detail): the running NET balance right after this settlement, from the
  // viewer's perspective (+ = otherName owes you, − = you owe). When passed, line 3 shows the
  // overall balance at that point (the newest row equals the top card) instead of per-split remaining.
  netAfter?: number;
  // The counterparty's avatar (settlements are person-to-person → shows the other party).
  avatarUrl?: string | null;
}) {
  const dateStr = createdAt ? format(new Date(createdAt), "MMM dd, yyyy · hh:mm a") : "";
  return (
    <div className="bg-card">
      <div className="px-4 py-3 flex gap-3">
        {iconAvatar ? (
          <div
            className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
              iPaid
                ? "bg-[var(--color-expense-bg)] text-expense"
                : "bg-[var(--color-income-bg)] text-income"
            }`}
          >
            <ArrowLeftRight className="h-5 w-5" />
          </div>
        ) : (
          <UserAvatar url={avatarUrl} name={otherName} size={40} className="shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          {/* Line 1: description (defaults to "Settlement") */}
          <p className="text-sm font-medium text-foreground truncate">
            {description?.trim() || "Settlement"}
          </p>
          {/* Line 2: payer → receiver + amount */}
          <div className="flex items-start justify-between gap-2 mt-0.5">
            <p className="text-[12px] text-muted-foreground truncate flex-1">
              {iPaid ? `You → ${otherName}` : `${otherName} → You`}
            </p>
            <p
              className={`text-sm font-mono font-semibold shrink-0 ${
                iPaid ? "text-expense" : "text-income"
              }`}
            >
              {formatMoney(amount)}
            </p>
          </div>
          {/* Line 3: balance after this settlement.
            netAfter present (person detail) → the overall running NET balance;
            otherwise → the legacy per-split "remaining". */}
          <div className="flex items-center justify-between gap-2 mt-0.5">
            {netAfter !== undefined ? (
              Math.abs(netAfter) < 0.005 ? (
                <p className="text-[12px] font-medium text-settled">Fully settled</p>
              ) : (
                <>
                  <p className="text-[12px] text-muted-foreground">
                    {netAfter > 0 ? "Still lent" : "Still owes"}
                  </p>
                  <p className="text-[12px] font-mono text-muted-foreground shrink-0">
                    {formatMoney(Math.abs(netAfter))}
                  </p>
                </>
              )
            ) : fullySettled ? (
              <p className="text-[12px] font-medium text-settled">Fully settled</p>
            ) : (
              <>
                <p className="text-[12px] text-muted-foreground">
                  {iPaid ? "Still owes" : "Still lent"}
                </p>
                <p className="text-[12px] font-mono text-muted-foreground shrink-0">
                  {formatMoney(remaining ?? 0)} remaining
                </p>
              </>
            )}
          </div>
          {/* Line 4: date · time */}
          <p className="text-[10px] text-muted-foreground font-mono mt-0.5 text-right">{dateStr}</p>
        </div>
      </div>
    </div>
  );
}
