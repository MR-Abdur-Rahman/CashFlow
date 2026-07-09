import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { accountsQuery, peopleQuery, categoriesQuery, allSubCategoriesQuery } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import { AmountInput } from "@/components/AmountInput";
import { TimePicker } from "@/components/TimePicker";
import { DayOfMonthPicker } from "@/components/DayOfMonthPicker";
import {
  FormShell,
  CategoryPickerSheet,
  PersonPickerSheet,
  SourcePickerSheet,
} from "@/components/AddTransactionSheet";
import type { Scheduled } from "@/lib/scheduled";

type TxType = "income" | "expense" | "transfer";

// Create or edit a scheduled (recurring monthly) transaction. Deliberately mirrors
// AddTransactionSheet — same tabs, same FormShell, same pickers — minus the Split tab, and with a
// day-of-month + time selector in place of that sheet's date + time.
export function ScheduledTransactionSheet({
  open,
  onOpenChange,
  edit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  edit?: Scheduled | null;
}) {
  const [tab, setTab] = useState<TxType>("expense");

  useEffect(() => {
    if (open) setTab((edit?.type as TxType) ?? "expense");
  }, [open, edit]);

  const close = () => onOpenChange(false);
  // While editing, the type is fixed: each form only knows how to update its own shape, and a form
  // that didn't receive `edit` would insert a duplicate rather than update.
  const locked = !!edit;
  const tabDisabled = (t: TxType) => locked && edit?.type !== t;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="bg-card border-border rounded-t-3xl p-0 h-[80dvh] max-h-[80dvh] flex flex-col"
      >
        <SheetTitle className="sr-only">
          {edit ? "Edit scheduled transaction" : "New scheduled transaction"}
        </SheetTitle>
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as TxType)}
          className="flex flex-col flex-1 min-h-0"
        >
          <div className="p-4 pb-2">
            <TabsList className="grid grid-cols-3 w-full bg-secondary">
              <TabsTrigger
                value="income"
                disabled={tabDisabled("income")}
                className="data-[state=active]:bg-[var(--color-income-bg)] data-[state=active]:text-income"
              >
                Income
              </TabsTrigger>
              <TabsTrigger
                value="expense"
                disabled={tabDisabled("expense")}
                className="data-[state=active]:bg-[var(--color-expense-bg)] data-[state=active]:text-expense"
              >
                Expense
              </TabsTrigger>
              <TabsTrigger
                value="transfer"
                disabled={tabDisabled("transfer")}
                className="data-[state=active]:bg-[var(--color-transfer-bg)] data-[state=active]:text-transfer"
              >
                Transfer
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="income" className="flex-1 min-h-0 mt-0">
            <ScheduledIncomeForm onClose={close} edit={edit?.type === "income" ? edit : null} />
          </TabsContent>
          <TabsContent value="expense" className="flex-1 min-h-0 mt-0">
            <ScheduledExpenseForm onClose={close} edit={edit?.type === "expense" ? edit : null} />
          </TabsContent>
          <TabsContent value="transfer" className="flex-1 min-h-0 mt-0">
            <ScheduledTransferForm onClose={close} edit={edit?.type === "transfer" ? edit : null} />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

// Stands in for AddTransactionSheet's DateTime row: a schedule recurs monthly, so it has no date.
function DayTime({
  dayOfMonth,
  time,
  setDayOfMonth,
  setTime,
}: {
  dayOfMonth: number;
  time: string;
  setDayOfMonth: (n: number) => void;
  setTime: (s: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-2 gap-3">
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
    </div>
  );
}

function DescriptionField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>Description</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Salary / Rent / etc..."
      />
    </div>
  );
}

function NoteField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>Note</Label>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2} />
    </div>
  );
}

// Insert a new schedule or update the one being edited. Shared by all three forms.
function useSaveSchedule(edit: Scheduled | null, onClose: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { error } = edit
        ? await supabase
            .from("scheduled_transactions")
            .update(payload as never)
            .eq("id", edit.id)
        : await supabase
            .from("scheduled_transactions")
            .insert({ ...payload, user_id: u.user.id } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(edit ? "Schedule updated" : "Schedule created");
      qc.invalidateQueries({ queryKey: ["scheduled_transactions"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

const hhmm = (t: string | null | undefined) => (t ?? "09:00").slice(0, 5);

// ─── Income ────────────────────────────────────────────────────────────────
function ScheduledIncomeForm({
  onClose,
  edit,
}: {
  onClose: () => void;
  edit: Scheduled | null;
}) {
  const { data: accounts = [] } = useQuery(accountsQuery());
  // Only the person id is stored, so the picker label has to be resolved back to a name on edit.
  const { data: people = [] } = useQuery(peopleQuery());
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [sourceType, setSourceType] = useState<"person" | "source">("source");
  const [personId, setPersonId] = useState("");
  const [personName, setPersonName] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [accountId, setAccountId] = useState("");
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [time, setTime] = useState("09:00");
  const [note, setNote] = useState("");
  const [personPickerOpen, setPersonPickerOpen] = useState(false);
  const [sourcePickerOpen, setSourcePickerOpen] = useState(false);
  const save = useSaveSchedule(edit, onClose);

  useEffect(() => {
    if (edit) {
      setAmount(String(edit.amount));
      setDescription(edit.description ?? "");
      setSourceType(edit.income_source_type ?? "source");
      setPersonId(edit.income_person_id ?? "");
      setPersonName(
        (people as { id: string; name: string }[]).find((p) => p.id === edit.income_person_id)
          ?.name ?? "",
      );
      setSourceText(edit.income_source_text ?? "");
      setAccountId(edit.account_id);
      setDayOfMonth(edit.day_of_month);
      setTime(hhmm(edit.scheduled_time));
      setNote(edit.note ?? "");
    } else if (accounts[0]?.id) {
      setAccountId((a) => a || (accounts[0] as { id: string }).id);
    }
  }, [edit, accounts, people]);

  return (
    <>
      <FormShell
        color="bg-[oklch(0.40_0.13_145)] hover:bg-[oklch(0.45_0.13_145)]"
        button={edit ? "Update schedule" : "Create schedule"}
        disabled={save.isPending}
        onSubmit={(e) => {
          e.preventDefault();
          const amt = Number(amount);
          if (!amount || isNaN(amt) || amt <= 0) return toast.error("Amount must be greater than 0");
          if (!description.trim()) return toast.error("Enter a description");
          if (sourceType === "person" && !personId) return toast.error("Please select a person");
          if (sourceType === "source" && !sourceText.trim())
            return toast.error("Please enter or select a source");
          if (!accountId) return toast.error("Please select an account");
          save.mutate({
            type: "income",
            amount: amt,
            description: description.trim(),
            account_id: accountId,
            to_account_id: null,
            category_id: null,
            sub_category_id: null,
            income_source_type: sourceType,
            income_person_id: sourceType === "person" ? personId : null,
            income_source_text: sourceType === "source" ? sourceText.trim() : null,
            note: note.trim() || null,
            day_of_month: dayOfMonth,
            scheduled_time: `${time}:00`,
          });
        }}
      >
        <AmountInput value={amount} onChange={setAmount} accent="text-income" />
        <DescriptionField value={description} onChange={setDescription} />
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
            <button
              type="button"
              onClick={() => setPersonPickerOpen(true)}
              className="w-full flex items-center justify-between px-3 py-2.5 bg-secondary rounded-lg text-sm"
            >
              <span className={personName ? "text-foreground" : "text-muted-foreground"}>
                {personName || (personId ? "Person selected" : "Select person")}
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
          {sourceType === "source" && (
            <button
              type="button"
              onClick={() => setSourcePickerOpen(true)}
              className="w-full flex items-center justify-between px-3 py-2.5 bg-secondary rounded-lg text-sm"
            >
              <span className={sourceText ? "text-foreground" : "text-muted-foreground"}>
                {sourceText || "Select source"}
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
        <div className="space-y-1.5">
          <Label>To account</Label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger>
              <SelectValue placeholder="Select account" />
            </SelectTrigger>
            <SelectContent>
              {(accounts as { id: string; institution: string | null; label: string }[]).map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {[a.institution, a.label].filter(Boolean).join(" · ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DayTime
          dayOfMonth={dayOfMonth}
          time={time}
          setDayOfMonth={setDayOfMonth}
          setTime={setTime}
        />
        <NoteField value={note} onChange={setNote} />
      </FormShell>
      <PersonPickerSheet
        open={personPickerOpen}
        onOpenChange={setPersonPickerOpen}
        onSelect={(id, name) => {
          setPersonId(id);
          setPersonName(name);
        }}
      />
      <SourcePickerSheet
        open={sourcePickerOpen}
        onOpenChange={setSourcePickerOpen}
        onSelect={(s) => setSourceText(s)}
      />
    </>
  );
}

// ─── Expense ───────────────────────────────────────────────────────────────
function ScheduledExpenseForm({
  onClose,
  edit,
}: {
  onClose: () => void;
  edit: Scheduled | null;
}) {
  const { data: accounts = [] } = useQuery(accountsQuery());
  // Only ids are stored, so the picker label has to be resolved back to names on edit.
  const { data: categories = [] } = useQuery(categoriesQuery());
  const { data: subCategories = [] } = useQuery(allSubCategoriesQuery());
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [categoryIcon, setCategoryIcon] = useState("");
  const [subCatId, setSubCatId] = useState("");
  const [subCatName, setSubCatName] = useState("");
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [time, setTime] = useState("09:00");
  const [note, setNote] = useState("");
  const [catPickerOpen, setCatPickerOpen] = useState(false);
  const save = useSaveSchedule(edit, onClose);

  useEffect(() => {
    if (edit) {
      setAmount(String(edit.amount));
      setDescription(edit.description ?? "");
      setAccountId(edit.account_id);
      setCategoryId(edit.category_id ?? "");
      setSubCatId(edit.sub_category_id ?? "");
      const cat = (categories as { id: string; name: string; icon: string | null }[]).find(
        (c) => c.id === edit.category_id,
      );
      setCategoryName(cat?.name ?? "");
      setCategoryIcon(cat?.icon ?? "");
      setSubCatName(
        (subCategories as { id: string; name: string }[]).find((s) => s.id === edit.sub_category_id)
          ?.name ?? "",
      );
      setDayOfMonth(edit.day_of_month);
      setTime(hhmm(edit.scheduled_time));
      setNote(edit.note ?? "");
    } else if (accounts[0]?.id) {
      setAccountId((a) => a || (accounts[0] as { id: string }).id);
    }
  }, [edit, accounts, categories, subCategories]);

  return (
    <>
      <FormShell
        color="bg-[oklch(0.40_0.18_25)] hover:bg-[oklch(0.45_0.18_25)]"
        button={edit ? "Update schedule" : "Create schedule"}
        disabled={save.isPending}
        onSubmit={(e) => {
          e.preventDefault();
          const amt = Number(amount);
          if (!amount || isNaN(amt) || amt <= 0) return toast.error("Amount must be greater than 0");
          if (!description.trim()) return toast.error("Enter a description");
          if (!accountId) return toast.error("Please select an account");
          if (!categoryId) return toast.error("Please select a category");
          save.mutate({
            type: "expense",
            amount: amt,
            description: description.trim(),
            account_id: accountId,
            to_account_id: null,
            category_id: categoryId,
            sub_category_id: subCatId || null,
            income_source_type: null,
            income_person_id: null,
            income_source_text: null,
            note: note.trim() || null,
            day_of_month: dayOfMonth,
            scheduled_time: `${time}:00`,
          });
        }}
      >
        <AmountInput value={amount} onChange={setAmount} accent="text-expense" />
        <DescriptionField value={description} onChange={setDescription} />
        <div className="space-y-1.5">
          <Label>From account</Label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger>
              <SelectValue placeholder="Select account" />
            </SelectTrigger>
            <SelectContent>
              {(accounts as { id: string; institution: string | null; label: string }[]).map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {[a.institution, a.label].filter(Boolean).join(" · ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Category</Label>
          <button
            type="button"
            onClick={() => setCatPickerOpen(true)}
            className="w-full flex items-center justify-between px-3 py-2.5 bg-secondary rounded-lg text-sm"
          >
            <span className={categoryId ? "text-foreground" : "text-muted-foreground"}>
              {categoryId
                ? categoryName
                  ? `${categoryIcon} ${categoryName}${subCatName ? " · " + subCatName : ""}`
                  : "Category selected"
                : "Select category"}
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <DayTime
          dayOfMonth={dayOfMonth}
          time={time}
          setDayOfMonth={setDayOfMonth}
          setTime={setTime}
        />
        <NoteField value={note} onChange={setNote} />
      </FormShell>
      <CategoryPickerSheet
        open={catPickerOpen}
        onOpenChange={setCatPickerOpen}
        onSelect={(cId, cName, cIcon, sId, sName) => {
          setCategoryId(cId);
          setCategoryName(cName);
          setCategoryIcon(cIcon);
          setSubCatId(sId ?? "");
          setSubCatName(sName ?? "");
        }}
      />
    </>
  );
}

// ─── Transfer ──────────────────────────────────────────────────────────────
function ScheduledTransferForm({
  onClose,
  edit,
}: {
  onClose: () => void;
  edit: Scheduled | null;
}) {
  const { data: accounts = [] } = useQuery(accountsQuery());
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [time, setTime] = useState("09:00");
  const [note, setNote] = useState("");
  const save = useSaveSchedule(edit, onClose);

  useEffect(() => {
    if (edit) {
      setAmount(String(edit.amount));
      setDescription(edit.description ?? "");
      setFromId(edit.account_id);
      setToId(edit.to_account_id ?? "");
      setDayOfMonth(edit.day_of_month);
      setTime(hhmm(edit.scheduled_time));
      setNote(edit.note ?? "");
    } else {
      const list = accounts as { id: string }[];
      if (list[0]?.id) setFromId((v) => v || list[0].id);
      if (list[1]?.id) setToId((v) => v || list[1].id);
    }
  }, [edit, accounts]);

  return (
    <FormShell
      color="bg-[oklch(0.40_0.13_252)] hover:bg-[oklch(0.45_0.13_252)]"
      button={edit ? "Update schedule" : "Create schedule"}
      disabled={save.isPending}
      onSubmit={(e) => {
        e.preventDefault();
        const amt = Number(amount);
        if (!amount || isNaN(amt) || amt <= 0) return toast.error("Amount must be greater than 0");
        if (!description.trim()) return toast.error("Enter a description");
        if (!fromId) return toast.error("Please select a from account");
        if (!toId) return toast.error("Please select a to account");
        if (fromId === toId) return toast.error("From and To accounts must be different");
        save.mutate({
          type: "transfer",
          amount: amt,
          description: description.trim(),
          account_id: fromId,
          to_account_id: toId,
          category_id: null,
          sub_category_id: null,
          income_source_type: null,
          income_person_id: null,
          income_source_text: null,
          note: note.trim() || null,
          day_of_month: dayOfMonth,
          scheduled_time: `${time}:00`,
        });
      }}
    >
      <AmountInput value={amount} onChange={setAmount} accent="text-transfer" />
      <DescriptionField value={description} onChange={setDescription} />
      <div className="space-y-1.5">
        <Label>From account</Label>
        <Select value={fromId} onValueChange={setFromId}>
          <SelectTrigger>
            <SelectValue placeholder="Select account" />
          </SelectTrigger>
          <SelectContent>
            {(accounts as { id: string; institution: string | null; label: string }[]).map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {[a.institution, a.label].filter(Boolean).join(" · ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>To account</Label>
        <Select value={toId} onValueChange={setToId}>
          <SelectTrigger>
            <SelectValue placeholder="Select account" />
          </SelectTrigger>
          <SelectContent>
            {(accounts as { id: string; institution: string | null; label: string }[]).map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {[a.institution, a.label].filter(Boolean).join(" · ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <DayTime dayOfMonth={dayOfMonth} time={time} setDayOfMonth={setDayOfMonth} setTime={setTime} />
      <NoteField value={note} onChange={setNote} />
    </FormShell>
  );
}
