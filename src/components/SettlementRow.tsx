import { formatMoney } from "@/lib/format";
import { format } from "date-fns";

// Shared settlement row used on Home, Account detail, Person detail and History so the
// format stays identical everywhere. Direction is from the VIEWER's perspective:
//   iPaid  → "You → Other"  + "Still owes"   (the viewer is the one who paid / owes)
//   !iPaid → "Other → You"  + "Still lent"   (the other person paid; the viewer is owed)
export function SettlementRow({
  iPaid, otherName, amount, remaining, fullySettled, createdAt,
}: {
  iPaid: boolean;
  otherName: string;
  amount: number;
  remaining: number;
  fullySettled: boolean;
  createdAt?: string;
}) {
  const dateStr = createdAt ? format(new Date(createdAt), "MMM dd, yyyy · hh:mm a") : "";
  return (
    <div className="bg-card" style={{ borderLeft: "3px solid #10B981" }}>
      <div className="px-4 py-3">
        {/* Line 1: payer → receiver + amount */}
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium truncate flex-1">
            {iPaid ? `You → ${otherName}` : `${otherName} → You`}
          </p>
          <p className="text-sm font-mono text-[#9CA3AF] shrink-0">{formatMoney(amount)}</p>
        </div>
        {/* Line 2: viewer-relative status + remaining */}
        <div className="flex items-center justify-between gap-2 mt-0.5">
          {fullySettled ? (
            <p className="text-[12px] font-medium text-[#10B981]">Fully settled</p>
          ) : (
            <>
              <p className="text-[12px] text-[#9CA3AF]">{iPaid ? "Still owes" : "Still lent"}</p>
              <p className="text-[12px] font-mono text-[#9CA3AF] shrink-0">{formatMoney(remaining)} remaining</p>
            </>
          )}
        </div>
        {/* Line 3: date · time */}
        <p className="text-[10px] text-[#9CA3AF] font-mono mt-0.5 text-right">{dateStr}</p>
      </div>
    </div>
  );
}
