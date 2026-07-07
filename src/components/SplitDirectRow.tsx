import { Users } from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import { splitRowAvatar, creatorDisplayName } from "@/lib/people";
import { useContactVisibility } from "@/hooks/useContactVisibility";
import { formatMoney, formatDateTime } from "@/lib/format";

// A split rendered as a feed row (Home / Person / Group / Account / History). `iconAvatar` shows a
// split type-icon instead of the counterparty photo (used on the person page).
export function SplitDirectRow({
  s,
  lentOweOverride,
  iconAvatar,
  onAvatarClick,
}: {
  s: any;
  lentOweOverride?: number;
  iconAvatar?: boolean;
  // When set, the avatar becomes a button (tapping it opens the person/group detail) while the rest
  // of the row keeps its own behavior.
  onAvatarClick?: () => void;
}) {
  const vis = useContactVisibility();
  const shares = (s.split_shares ?? []) as any[];
  const total = Number(s.total_amount);
  const totalShares = shares.reduce((sum: number, sh: any) => sum + Number(sh.share_amount), 0);
  const isGroup = s.type === "group";
  const isMulti = !isGroup && shares.length > 1;
  const isPerson = !isGroup && shares.length <= 1;
  const isIncoming = s._isIncoming === true; // must be explicitly true, not just truthy

  // Did the CURRENT VIEWER pay? For incoming, paid_by="me" means the CREATOR paid (not the viewer).
  const isMePaid = (() => {
    if (!isIncoming) return s.paid_by === "me";
    if (s.paid_by_person_id != null && s._myPersonId != null) {
      return s.paid_by_person_id === s._myPersonId;
    }
    return s.paid_by !== "me"; // fallback for old splits without paid_by_person_id
  })();

  // Counterpart label on line 2
  const groupName = s.groups?.name ?? "Unknown Group";
  // The creator's shown name honors profile visibility (falls back to the local name when hidden).
  const creatorName = creatorDisplayName(s, vis);
  const personLabel = isIncoming
    ? creatorName
    : (s.people?.name ?? shares[0]?.person_name ?? "");
  // People split names. Own split: all share names (creator = viewer, excluded already).
  // Incoming split: creator's name + other participants, EXCLUDING the viewer's own share
  // (share person_name is from the creator's contact list, so it's the viewer's own name — skip it).
  const peopleNames: string[] = isIncoming
    ? [
        creatorName,
        ...shares
          .filter((sh: any) => sh.person_id !== s._myPersonId)
          .map((sh: any) => sh.person_name),
      ].filter(Boolean)
    : shares.map((sh: any) => sh.person_name).filter(Boolean);
  const nameList =
    peopleNames.slice(0, 2).join(", ") +
    (peopleNames.length > 2 ? ` +${peopleNames.length - 2} more` : "");
  // Group → group name; People → participant names; Person → other party (creator for incoming)
  const line2Name = isGroup ? groupName : isPerson ? personLabel : nameList;

  const description =
    s.description ||
    (isGroup
      ? (s.groups?.name ?? "Group split")
      : isPerson
        ? `Split w/ ${shares[0]?.person_name ?? s.people?.name ?? ""}`
        : "Split");

  // Amounts
  const myShareAmt = isIncoming
    ? Number(shares.find((sh: any) => sh.person_id === s._myPersonId)?.share_amount ?? 0)
    : 0;
  const creatorImplicit = total - totalShares; // creator's own (unrecorded) portion
  const youLent = isIncoming ? total - myShareAmt : totalShares; // what others owe the viewer
  const youOwe = isIncoming ? myShareAmt : creatorImplicit; // what the viewer owes
  // Per-share = the actual recorded amount per participant (avoids guessing creator inclusion).
  const perShare = shares.length > 0 ? totalShares / shares.length : total;
  const owersCount = shares.length; // people who owe the viewer when the viewer paid

  // Account line — shown only when the viewer paid.
  const accountLabel = isMePaid ? (s.accounts?.label ?? "No account selected") : null;

  const dateNode = (
    <p className="text-[10px] text-muted-foreground font-mono mt-0.5 text-right">
      {formatDateTime(s.date, s.time)}
    </p>
  );

  const rowAv = splitRowAvatar(s, vis);
  const avatarNode = iconAvatar ? (
    <div className="h-10 w-10 rounded-full flex items-center justify-center bg-[var(--color-split-bg)] text-split shrink-0">
      <Users className="h-5 w-5" />
    </div>
  ) : rowAv.kind === "people" ? (
    <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0">
      <Users className="h-5 w-5" />
    </div>
  ) : (
    <UserAvatar url={rowAv.url} name={rowAv.name} size={40} className="shrink-0" />
  );

  return (
    <div className="bg-card">
      <div className="px-4 py-3 flex gap-3">
        {onAvatarClick ? (
          <button
            type="button"
            aria-label="Open details"
            className="shrink-0 rounded-full"
            onClick={(e) => {
              e.stopPropagation();
              onAvatarClick();
            }}
          >
            {avatarNode}
          </button>
        ) : (
          avatarNode
        )}
        <div className="flex-1 min-w-0">
          {/* Line 1: description + total */}
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-foreground truncate flex-1">{description}</p>
            <p className="text-sm font-mono font-semibold text-split shrink-0">
              {formatMoney(total)}
            </p>
          </div>

          {/* Person split */}
          {isPerson && (
            <>
              <div className="flex items-center justify-between gap-2 mt-0.5">
                <p className="text-[12px] text-muted-foreground truncate flex-1">{line2Name}</p>
                {isMePaid ? (
                  <p className="text-[12px] font-mono font-semibold text-settled shrink-0">
                    You lent {formatMoney(youLent)}
                  </p>
                ) : (
                  <p className="text-[12px] font-mono font-semibold text-split shrink-0">
                    You owe {formatMoney(youOwe)}
                  </p>
                )}
              </div>
              {isMePaid ? (
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <p className="text-[12px] text-muted-foreground truncate flex-1">
                    {accountLabel}
                  </p>
                  {dateNode}
                </div>
              ) : (
                dateNode
              )}
            </>
          )}

          {/* People / Group split */}
          {(isMulti || isGroup) && (
            <>
              <div className="flex items-center justify-between gap-2 mt-0.5">
                <p className="text-[12px] text-muted-foreground truncate flex-1">{line2Name}</p>
                <p className="text-[12px] font-mono text-muted-foreground shrink-0">
                  {isMePaid
                    ? `${owersCount} × ${formatMoney(perShare)}`
                    : `${formatMoney(perShare)} per share`}
                </p>
              </div>
              {isMePaid ? (
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <p className="text-[12px] text-muted-foreground truncate flex-1">
                    {accountLabel}
                  </p>
                  <p className="text-[12px] font-mono font-semibold text-settled shrink-0">
                    You lent {formatMoney(lentOweOverride ?? youLent)}
                  </p>
                </div>
              ) : (
                <div className="flex items-center justify-end gap-2 mt-0.5">
                  <p className="text-[12px] font-mono font-semibold text-split shrink-0">
                    You owe {formatMoney(lentOweOverride ?? youOwe)}
                  </p>
                </div>
              )}
              {dateNode}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
