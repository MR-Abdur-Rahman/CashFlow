import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { accountsQuery, peopleQuery } from "@/lib/queries";
import { Sheet, SheetContent, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TransactionAttachments } from "@/components/TransactionAttachments";
import {
  listAttachments,
  uploadPending,
  type Coords,
  type PendingAttachment,
  type SavedAttachment,
} from "@/lib/attachments";

// Detail + edit sheet for a single plain transaction (income / expense / transfer).
// Extracted verbatim from home.tsx so account-detail, reports and history can all reach it — it
// never depended on anything in home.tsx, only on shared modules.
//
// Opened two ways: the swipe-revealed Edit button (as before) and now a tap on the row itself.
// Splits and settlements have their own sheets and stay swipe-only.
export function TransactionDetailSheet({
  txn,
  open,
  onOpenChange,
}: {
  txn: any;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState(String(txn.amount));
  const [note, setNote] = useState(txn.note ?? "");
  const [date, setDate] = useState(txn.date ?? format(new Date(), "yyyy-MM-dd"));
  const [time, setTime] = useState(txn.time?.slice(0, 5) ?? format(new Date(), "HH:mm"));
  const [accountId, setAccountId] = useState(txn.account_id ?? "");
  const [toAccountId, setToAccountId] = useState(txn.to_account_id ?? "");
  const [categoryId, setCategoryId] = useState(txn.category_id ?? "");
  const [subCatId, setSubCatId] = useState(txn.sub_category_id ?? "");

  // Income source fields
  const [sourceType, setSourceType] = useState<"person" | "source">(
    txn.income_source_type ?? "source",
  );
  const [personId, setPersonId] = useState(txn.income_person_id ?? "");
  const [sourceText, setSourceText] = useState(txn.income_source_text ?? "");

  const [description, setDescription] = useState(txn.description ?? "");
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [saved, setSaved] = useState<SavedAttachment[]>([]);
  const [location, setLocation] = useState<Coords | null>(
    txn.location_lat != null && txn.location_lng != null
      ? { lat: Number(txn.location_lat), lng: Number(txn.location_lng) }
      : null,
  );

  // Signed URLs expire, so re-sign on each open rather than caching them with the transaction.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    listAttachments(txn.id).then((rows) => {
      if (alive) setSaved(rows);
    });
    return () => {
      alive = false;
    };
  }, [open, txn.id]);

  const { data: accounts = [] } = useQuery(accountsQuery());
  const { data: people = [] } = useQuery(peopleQuery());
  const { data: cats = [] } = useQuery({
    queryKey: ["categories", "expense"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
  const { data: subs = [] } = useQuery({
    queryKey: ["sub_categories", categoryId || "none"],
    queryFn: async () => {
      if (!categoryId) return [];
      const { data, error } = await supabase
        .from("sub_categories")
        .select("*")
        .eq("category_id", categoryId)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!categoryId,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("transactions")
        .update({
          amount: Number(amount),
          account_id: accountId || null,
          to_account_id: txn.type === "transfer" && toAccountId ? toAccountId : undefined,
          category_id: categoryId || null,
          sub_category_id: subCatId || null,
          note: note || null,
          description: description.trim() || null,
          location_lat: location?.lat ?? null,
          location_lng: location?.lng ?? null,
          date,
          time,
          ...(txn.type === "income"
            ? {
                income_source_type: sourceType,
                income_person_id: sourceType === "person" && personId ? personId : null,
                income_source_text: sourceType === "source" ? sourceText : null,
              }
            : {}),
        })
        .eq("id", txn.id);
      if (error) throw error;

      // Unlike a new transaction, the id already exists — anything newly attached in this session
      // can upload straight away.
      if (pending.length) {
        const { data: u } = await supabase.auth.getUser();
        if (u.user) {
          const { failed } = await uploadPending(u.user.id, txn.id, pending);
          if (failed.length) toast.error(`Couldn't attach: ${failed.join(", ")}`);
        }
      }
    },
    onSuccess: () => {
      toast.success("Transaction updated");
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="bg-card border-border rounded-t-3xl p-0 h-[80dvh] flex flex-col"
      >
        <SheetTitle className="sr-only">Edit transaction</SheetTitle>
        <div className="px-5 pt-5 pb-3 border-b border-border flex items-center justify-between gap-3">
          <span className="capitalize text-base font-semibold">
            {txn.is_split ? "Split" : txn.type} — Edit
          </span>
          {/* ui/sheet's SheetContent renders bare children — it injects no close button — and the
              sheet has no swipe-to-dismiss, so without this the only exits were the overlay, Esc
              and Save. SheetClose is Radix's own close trigger, so it routes through onOpenChange. */}
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
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="text-center py-2">
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
              className="w-full bg-transparent text-center text-5xl font-mono font-semibold outline-none text-foreground"
            />
            <p className="text-xs text-muted-foreground mt-1 font-mono">LKR</p>
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            {/* Plain <input> matching SplitForm's filled-field style, not the shadcn <Input>. */}
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Dinner, Groceries, Trip"
              className="w-full text-sm text-foreground placeholder:text-muted-foreground outline-none px-3 py-2.5 bg-secondary border border-border rounded-lg"
            />
          </div>

          <div className="space-y-1.5">
            <Label>{txn.type === "transfer" ? "From account" : "Account"}</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {(accounts as any[]).map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {[a.institution, a.label].filter(Boolean).join(" · ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {txn.type === "income" && (
            <div className="space-y-1.5">
              <Label>From</Label>
              <div className="flex gap-2 rounded-lg bg-secondary p-1">
                {(["person", "source"] as const).map((m) => (
                  <button
                    type="button"
                    key={m}
                    onClick={() => setSourceType(m)}
                    className={cn(
                      "flex-1 rounded-md py-1.5 text-sm capitalize",
                      sourceType === m && "bg-primary text-white",
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
              {sourceType === "person" && (
                <Select value={personId} onValueChange={setPersonId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select person" />
                  </SelectTrigger>
                  <SelectContent>
                    {(people as any[]).map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {sourceType === "source" && (
                <Input
                  value={sourceText}
                  onChange={(e) => setSourceText(e.target.value)}
                  placeholder="e.g. Salary, Freelance, Gift"
                />
              )}
            </div>
          )}

          {txn.type === "transfer" && (
            <div className="space-y-1.5">
              <Label>To account</Label>
              <Select value={toAccountId} onValueChange={setToAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {(accounts as any[]).map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {[a.institution, a.label].filter(Boolean).join(" · ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {(txn.type === "expense" || txn.is_split) && (
            <>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select
                  value={categoryId}
                  onValueChange={(v) => {
                    setCategoryId(v);
                    setSubCatId("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {(cats as any[]).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.icon} {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {categoryId && subs.length > 0 && (
                <div className="space-y-1.5">
                  <Label>Sub-category</Label>
                  <Select value={subCatId} onValueChange={setSubCatId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select sub-category" />
                    </SelectTrigger>
                    <SelectContent>
                      {(subs as any[]).map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Time</Label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground outline-none"
              />
            </div>
          </div>

          <TransactionAttachments
            pending={pending}
            onPendingChange={setPending}
            saved={saved}
            onSavedChange={setSaved}
            location={location}
            onLocationChange={setLocation}
          >
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </TransactionAttachments>
        </div>
        <div className="p-4 pt-2 border-t border-border bg-card">
          <Button
            className="w-full bg-primary text-white"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
