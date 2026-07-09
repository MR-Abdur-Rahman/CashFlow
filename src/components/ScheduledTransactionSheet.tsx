import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TimePicker } from "@/components/TimePicker";
import { DayOfMonthPicker } from "@/components/DayOfMonthPicker";
import { AmountInput } from "@/components/AmountInput";
import { accountsQuery, categoriesQuery, subCategoriesQuery } from "@/lib/queries";
import type { Scheduled } from "@/lib/scheduled";

type TxType = "income" | "expense" | "transfer";

// Create or edit a scheduled (recurring monthly) transaction. On save it writes the template only —
// it never posts a real transaction; that happens on confirmation when the schedule is due.
export function ScheduledTransactionSheet({
  open,
  onOpenChange,
  edit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  edit?: Scheduled | null;
}) {
  const qc = useQueryClient();
  const { data: accounts = [] } = useQuery(accountsQuery());

  const [type, setType] = useState<TxType>("expense");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [subCategoryId, setSubCategoryId] = useState("");
  const [note, setNote] = useState("");
  const [description, setDescription] = useState("");
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [time, setTime] = useState("09:00");
  const [saving, setSaving] = useState(false);

  // Categories are per-type (income vs expense); transfers have none.
  const { data: categories = [] } = useQuery(
    categoriesQuery(type === "transfer" ? undefined : type),
  );
  const { data: subCategories = [] } = useQuery(subCategoriesQuery(categoryId || null));
  const needsCategory = type === "income" || type === "expense";

  useEffect(() => {
    if (!open) return;
    if (edit) {
      setType(edit.type);
      setAmount(String(edit.amount));
      setAccountId(edit.account_id);
      setToAccountId(edit.to_account_id ?? "");
      setCategoryId(edit.category_id ?? "");
      setSubCategoryId(edit.sub_category_id ?? "");
      setNote(edit.note ?? "");
      setDescription(edit.description ?? "");
      setDayOfMonth(edit.day_of_month);
      setTime((edit.scheduled_time ?? "09:00").slice(0, 5));
    } else {
      setType("expense");
      setAmount("");
      setAccountId("");
      setToAccountId("");
      setCategoryId("");
      setSubCategoryId("");
      setNote("");
      setDescription("");
      setDayOfMonth(1);
      setTime("09:00");
    }
  }, [open, edit]);

  const accountLabel = type === "income" ? "To account" : "From account";
  const amountAccent =
    type === "income" ? "text-income" : type === "transfer" ? "text-transfer" : "text-expense";
  const validSub = useMemo(
    () => (subCategories as any[]).some((s) => s.id === subCategoryId),
    [subCategories, subCategoryId],
  );

  async function save() {
    const amt = Number(amount);
    if (!amt || amt <= 0) return toast.error("Enter an amount");
    if (!description.trim()) return toast.error("Enter a description");
    if (!accountId) return toast.error(`Choose the ${accountLabel.toLowerCase()}`);
    if (type === "transfer") {
      if (!toAccountId) return toast.error("Choose the destination account");
      if (toAccountId === accountId) return toast.error("Pick two different accounts");
    }
    if (needsCategory && !categoryId) return toast.error("Choose a category");
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const payload = {
        user_id: u.user.id,
        type,
        amount: amt,
        account_id: accountId,
        to_account_id: type === "transfer" ? toAccountId : null,
        category_id: needsCategory ? categoryId || null : null,
        sub_category_id: needsCategory && validSub ? subCategoryId : null,
        note: note.trim() || null,
        description: description.trim(),
        day_of_month: dayOfMonth,
        scheduled_time: `${time}:00`,
      };
      const { error } = edit
        ? await supabase
            .from("scheduled_transactions")
            .update(payload as never)
            .eq("id", edit.id)
        : await supabase.from("scheduled_transactions").insert(payload as never);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["scheduled_transactions"] });
      toast.success(edit ? "Schedule updated" : "Schedule created");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>{edit ? "Edit scheduled transaction" : "New scheduled transaction"}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Type — same segmented toggle as the Manage page tabs */}
          <Tabs
            value={type}
            onValueChange={(v) => {
              setType(v as TxType);
              // Categories differ by type, so a stale selection must clear.
              setCategoryId("");
              setSubCategoryId("");
            }}
          >
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="income">Income</TabsTrigger>
              <TabsTrigger value="expense">Expense</TabsTrigger>
              <TabsTrigger value="transfer">Transfer</TabsTrigger>
            </TabsList>
          </Tabs>

          <AmountInput value={amount} onChange={setAmount} accent={amountAccent} />

          {/* Required. Kept separate from `note`, which becomes the posted income's
              income_source_text and so can't carry longer prose. */}
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Salary / Rent / etc..."
            />
          </div>

          <div className="space-y-1.5">
            <Label>{accountLabel}</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {(accounts as any[]).map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {type === "transfer" && (
            <div className="space-y-1.5">
              <Label>To account</Label>
              <Select value={toAccountId} onValueChange={setToAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {(accounts as any[])
                    .filter((a) => a.id !== accountId)
                    .map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {needsCategory && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select
                  value={categoryId}
                  onValueChange={(v) => {
                    setCategoryId(v);
                    setSubCategoryId("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Required" />
                  </SelectTrigger>
                  <SelectContent>
                    {(categories as any[]).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.icon ? `${c.icon} ` : ""}
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Sub-category</Label>
                <Select
                  value={subCategoryId}
                  onValueChange={setSubCategoryId}
                  disabled={!categoryId || (subCategories as any[]).length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    {(subCategories as any[]).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.icon ? `${s.icon} ` : ""}
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1.5">
              <Label>Day of month</Label>
              <div>
                <DayOfMonthPicker value={dayOfMonth} onChange={setDayOfMonth} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Time</Label>
              <div>
                <TimePicker value={time} onChange={setTime} />
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Runs on day {dayOfMonth} each month. Months without that day use their last day.
          </p>

          <div className="space-y-1.5">
            <Label>Note</Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={type === "income" ? "e.g. Salary" : "Optional"}
            />
          </div>

          <Button className="w-full" onClick={save} disabled={saving}>
            {saving ? "Saving…" : edit ? "Save changes" : "Create schedule"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
