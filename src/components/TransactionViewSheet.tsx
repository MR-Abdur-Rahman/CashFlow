import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, ExternalLink, MapPin } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { AccountIcon } from "@/components/AccountIcon";
import { peopleQuery } from "@/lib/queries";
import { formatDateTime, formatMoney } from "@/lib/format";
import { listAttachments, mapsUrl, type SavedAttachment } from "@/lib/attachments";

// Read-only detail view for a plain transaction, opened by TAPPING a row. The swipe → Edit action
// still opens TransactionDetailSheet (the form); this one has no inputs, no mutation and no save.
//
// Deliberately a CENTERED DIALOG, not a bottom sheet — matching DeleteAccountDialog — so a glance
// is visibly a different kind of surface from the editable sheet rather than an identical-looking
// panel you might start typing into. TransactionDetailSheet stays a bottom Sheet.
//
// Degrades by page: reports.tsx selects transactions with a narrower join (no account icon fields,
// no sub-category icon) than transactionsQuery, so icons simply fall back rather than break.
// Transaction rows arrive from Supabase joins loosely typed, and the joined columns differ by page
// (reports selects fewer than transactionsQuery). One alias beats spreading `any` across the four
// call sites' state declarations.
export type TxnRow = any; // eslint-disable-line @typescript-eslint/no-explicit-any

export function TransactionViewSheet({
  txn,
  open,
  onOpenChange,
}: {
  txn: TxnRow;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [attachments, setAttachments] = useState<SavedAttachment[]>([]);
  const { data: people = [] } = useQuery(peopleQuery());

  // Signed URLs expire, so re-sign on every open rather than caching them with the transaction.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    listAttachments(txn.id).then((rows) => {
      if (alive) setAttachments(rows);
    });
    return () => {
      alive = false;
    };
  }, [open, txn.id]);

  const isIncome = txn.type === "income";
  const isExpense = txn.type === "expense";
  const isTransfer = txn.type === "transfer";

  // Same palette, glyph and sign rules as the list rows (home.tsx TxRowInner).
  const colorClass = isIncome ? "text-income" : isExpense ? "text-expense" : "text-transfer";
  const bgClass = isIncome
    ? "bg-[var(--color-income-bg)]"
    : isExpense
      ? "bg-[var(--color-expense-bg)]"
      : "bg-[var(--color-transfer-bg)]";
  const Glyph = isIncome ? ArrowDownLeft : isExpense ? ArrowUpRight : ArrowLeftRight;
  const sign = isIncome ? "+" : isTransfer ? "" : "-";

  const categoryLabel = txn.categories
    ? `${txn.sub_categories?.icon ?? txn.categories.icon ?? ""} ${txn.categories.name}${
        txn.sub_categories ? " · " + txn.sub_categories.name : ""
      }`.trim()
    : null;

  // transactionsQuery doesn't join people, so resolve the income person by id — same approach the
  // edit sheet takes.
  const incomeSource =
    txn.income_source_type === "person"
      ? ((people as { id: string; name: string }[]).find((p) => p.id === txn.income_person_id)
          ?.name ?? "Unknown person")
      : (txn.income_source_text ?? null);

  const location =
    txn.location_lat != null && txn.location_lng != null
      ? { lat: Number(txn.location_lat), lng: Number(txn.location_lng) }
      : null;

  const accountLabel = txn.accounts
    ? [txn.accounts.institution, txn.accounts.label].filter(Boolean).join(" · ")
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Same shell as DeleteAccountDialog: max-w-xs on the shared DialogContent, which supplies the
          rounded-2xl card, bg-background, the bg-black/80 overlay and the top-right X. Unlike
          SheetContent, DialogContent injects that close button itself — so there is none here.
          grid-rows keeps the title fixed while only the body scrolls, so the X can't scroll away. */}
      <DialogContent className="max-w-xs max-h-[85dvh] grid-rows-[auto_minmax(0,1fr)]">
        {/* Radix warns without a description; the fields below are the description. */}
        <DialogDescription className="sr-only">Transaction details</DialogDescription>
        <DialogTitle className="capitalize pr-8">{txn.type}</DialogTitle>

        <div className="overflow-y-auto">
          {/* Amount — colour-coded by type, matching the list rows */}
          <div className="flex flex-col items-center py-3">
            <div
              className={`h-12 w-12 rounded-full flex items-center justify-center mb-3 ${bgClass} ${colorClass}`}
            >
              <Glyph className="h-6 w-6" />
            </div>
            <p className={`text-4xl font-mono font-bold ${colorClass}`}>
              {sign}
              {formatMoney(txn.amount)}
            </p>
            {txn.description && (
              <p className="mt-2 text-center text-base font-medium">{txn.description}</p>
            )}
          </div>

          <div className="mt-2">
            {isExpense && categoryLabel && <Field label="Category">{categoryLabel}</Field>}

            {isIncome && incomeSource && (
              <Field label={txn.income_source_type === "person" ? "From person" : "Source"}>
                {incomeSource}
              </Field>
            )}

            {accountLabel && (
              <Field label={isTransfer ? "From account" : "Account"}>
                <span className="inline-flex items-center gap-2">
                  <AccountIcon
                    iconType={txn.accounts?.icon_type}
                    iconName={txn.accounts?.icon_name}
                    iconColor={txn.accounts?.icon_color}
                    iconUrl={txn.accounts?.icon_url}
                    fallback={txn.accounts?.label ?? ""}
                    size={20}
                    rounded="rounded-md"
                  />
                  {accountLabel}
                </span>
              </Field>
            )}

            {/* to_account is joined without icon fields, so the destination is text-only. */}
            {isTransfer && txn.to_account && (
              <Field label="To account">
                {[txn.to_account.institution, txn.to_account.label].filter(Boolean).join(" · ")}
              </Field>
            )}

            <Field label="Date">{formatDateTime(txn.date, txn.time)}</Field>

            {txn.note && <Field label="Note">{txn.note}</Field>}

            {attachments.length > 0 && (
              <Field label="Attachments">
                <span className="flex flex-wrap justify-end gap-1.5">
                  {attachments.map((a) =>
                    a.signedUrl ? (
                      <a
                        key={a.id}
                        href={a.signedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex max-w-[10rem] items-center gap-1 rounded-full bg-secondary px-2 py-1 text-xs"
                      >
                        <span className="truncate">
                          {a.type === "document" ? "📄 " : "🖼️ "}
                          {a.fileName ?? "Attachment"}
                        </span>
                        <ExternalLink className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />
                      </a>
                    ) : (
                      <span
                        key={a.id}
                        className="inline-flex max-w-[10rem] items-center rounded-full bg-secondary px-2 py-1 text-xs"
                      >
                        <span className="truncate">{a.fileName ?? "Attachment"}</span>
                      </span>
                    ),
                  )}
                </span>
              </Field>
            )}

            {location && (
              <Field label="Location">
                <a
                  href={mapsUrl(location)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-1 text-xs"
                >
                  <MapPin className="h-3 w-3 text-transfer" />
                  View location
                  <ExternalLink className="h-2.5 w-2.5 text-muted-foreground" />
                </a>
              </Field>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-border/60 last:border-0">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <div className="min-w-0 text-right text-sm break-words">{children}</div>
    </div>
  );
}
