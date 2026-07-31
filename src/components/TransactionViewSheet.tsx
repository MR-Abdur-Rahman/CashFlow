import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, ExternalLink, MapPin, X } from "lucide-react";
import { Sheet, SheetClose, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { AccountIcon } from "@/components/AccountIcon";
import { peopleQuery } from "@/lib/queries";
import { formatDateTime, formatMoney } from "@/lib/format";
import { listAttachments, mapsUrl, type SavedAttachment } from "@/lib/attachments";

// Read-only detail view for a plain transaction, opened by TAPPING a row. The swipe → Edit action
// still opens TransactionDetailSheet (the form); this one has no inputs, no mutation and no save.
//
// Shares TransactionDetailSheet's shell exactly (bottom sheet, bg-card, rounded-t-3xl, X top-right)
// so the two read as the same surface in two modes.
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="bg-card border-border rounded-t-3xl p-0 h-[80dvh] flex flex-col"
      >
        <SheetTitle className="sr-only">Transaction details</SheetTitle>

        <div className="px-5 pt-5 pb-3 border-b border-border flex items-center justify-between gap-3">
          <span className="capitalize text-base font-semibold">{txn.type}</span>
          <SheetClose asChild>
            <button
              type="button"
              aria-label="Close"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground active:bg-secondary/60"
            >
              <X className="h-4 w-4" />
            </button>
          </SheetClose>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
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
      </SheetContent>
    </Sheet>
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
