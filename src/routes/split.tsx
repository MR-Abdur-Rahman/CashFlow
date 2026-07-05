import { useQuery, useQueryClient } from "@tanstack/react-query";
import { peopleQuery, groupsQuery, splitBalancesQuery, pendingSplitsQuery, pendingSettlementsQuery, accountsQuery, categoriesQuery, subCategoriesQuery } from "@/lib/queries";
import { bilateralBalance } from "@/lib/balance";
import { Users, Plus, ChevronRight, Archive, QrCode, History, CheckCircle } from "lucide-react";
import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AccountIcon } from "@/components/AccountIcon";
import { AddPersonDialog } from "@/components/AddPersonDialog";
import { AddGroupDialog } from "@/components/AddGroupDialog";
import { QrScannerDialog } from "@/components/QrScannerDialog";
import { formatMoney } from "@/lib/format";
import { methodToAccountType } from "@/lib/settlement";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link, useSearchParams } from "react-router-dom";

export default function SplitPage() {
  const { data: people = [] } = useQuery(peopleQuery());
  const { data: groups = [] } = useQuery(groupsQuery());
  const { data: balanceData } = useQuery(splitBalancesQuery());
  const allSplits = balanceData?.splits ?? [];
  const allSettlements = balanceData?.settlements ?? [];
  const myPersonIds = balanceData?.myPersonIds ?? [];
  const currentUserId = balanceData?.currentUserId ?? null;
  const [addPerson, setAddPerson] = useState(false);
  const [addGroup, setAddGroup] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanned, setScanned] = useState<{ name?: string; phone?: string } | undefined>();
  const { data: pendingSplits = [] } = useQuery(pendingSplitsQuery());
  const { data: pendingSettlements = [] } = useQuery(pendingSettlementsQuery());
  const pendingCount = (pendingSplits as any[]).length + (pendingSettlements as any[]).length;
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initialTab = tabParam === "pending" ? "pending" : tabParam === "groups" ? "groups" : "people";
  const [tab, setTab] = useState<"people" | "groups" | "pending">(initialTab);

  function handleScan(text: string) {
    let obj: any;
    try { obj = JSON.parse(text); } catch { return toast.error("Not a valid QR code"); }
    if (obj?.app !== "cashflow") return toast.error("That doesn't look like a CashFlow QR");
    const name = typeof obj.name === "string" ? obj.name.trim().slice(0, 80) : "";
    const phoneRaw = typeof obj.phone === "string" ? obj.phone.trim() : "";
    const phone = phoneRaw && /^\+?[0-9 ()-]{6,20}$/.test(phoneRaw) ? phoneRaw : undefined;
    if (!name && !phone) return toast.error("QR is missing name and phone");
    setScanned({ name: name || undefined, phone });
    setAddPerson(true);
    toast.success("QR scanned — review and save");
  }

  function personBalance(person: any): number {
    return bilateralBalance(allSplits, allSettlements, person, currentUserId, myPersonIds);
  }

  return (
    <div className="px-4 pt-6 space-y-4 pb-24">
      {/* Header: title + history only */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Split</h1>
        <Link to="/settings/history?filter=split" className="h-9 w-9 flex items-center justify-center rounded-full bg-secondary text-foreground">
          <History className="h-5 w-5" />
        </Link>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="people">People</TabsTrigger>
          <TabsTrigger value="groups">Groups</TabsTrigger>
          <TabsTrigger value="pending">
            Pending
            {pendingCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center rounded-full text-[10px] font-bold text-white px-1.5 min-w-[18px] h-[18px] leading-none" style={{ background: "#EF4444" }}>
                {pendingCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* People */}
        <TabsContent value="people" className="space-y-3">
          <div className="flex justify-end gap-2">
            <button onClick={() => setScanOpen(true)} className="h-9 w-9 flex items-center justify-center rounded-full bg-secondary text-foreground">
              <QrCode className="h-5 w-5" />
            </button>
            <button onClick={() => { setScanned(undefined); setAddPerson(true); }} className="h-9 w-9 flex items-center justify-center rounded-full bg-secondary text-foreground">
              <Plus className="h-5 w-5" />
            </button>
          </div>
          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
            {people.length === 0 ? <Empty text="No people yet" /> : (
              <div className="divide-y divide-border">
                {(people as any[]).map((p) => {
                  const bal = personBalance(p);
                  return (
                    <Link key={p.id} to={`/split/person/${p.id}`} className="flex items-center gap-3 p-4 active:bg-secondary/40">
                      <Avatar name={p.name} />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{p.name}{p.linked_user_id && " 🔗"}</p>
                        <p className="text-xs text-muted-foreground">{p.phone_number ?? "no phone"}</p>
                      </div>
                      {Math.abs(bal) >= 0.005 && (
                        <span className="text-sm font-mono font-semibold" style={{ color: bal > 0 ? "#22C55E" : "#EF4444" }}>
                          {bal > 0 ? "+" : "-"}{formatMoney(Math.abs(bal))}
                        </span>
                      )}
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Groups */}
        <TabsContent value="groups" className="space-y-3">
          <div className="flex justify-end">
            <button onClick={() => setAddGroup(true)} className="h-9 w-9 flex items-center justify-center rounded-full bg-secondary text-foreground">
              <Plus className="h-5 w-5" />
            </button>
          </div>
          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
            {groups.length === 0 ? <Empty text="No groups yet" /> : (
              <div className="divide-y divide-border">
                {(groups as any[]).map((g) => (
                  <Link key={g.id} to={`/split/group/${g.id}`} className="flex items-center gap-3 p-4 active:bg-secondary/40">
                    <div className="h-10 w-10 rounded-full bg-split/20 flex items-center justify-center text-split">
                      <Users className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium flex items-center gap-2">
                        {g.name} {g.is_archived && <Archive className="h-3 w-3 text-muted-foreground" />}
                      </p>
                      <p className="text-xs text-muted-foreground">{g.group_members?.length ?? 0} members</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Pending — account selection for splits where I paid */}
        <TabsContent value="pending">
          <PendingTab pendingSplits={pendingSplits as any[]} pendingSettlements={pendingSettlements as any[]} />
        </TabsContent>
      </Tabs>

      <AddPersonDialog open={addPerson} onOpenChange={setAddPerson} initial={scanned} />
      <AddGroupDialog open={addGroup} onOpenChange={setAddGroup} />
      <QrScannerDialog open={scanOpen} onOpenChange={setScanOpen} onScan={handleScan} />
    </div>
  );
}


function PendingTab({ pendingSplits, pendingSettlements }: { pendingSplits: any[]; pendingSettlements: any[] }) {
  const { data: accounts = [] } = useQuery(accountsQuery());

  if (pendingSplits.length === 0 && pendingSettlements.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center" style={{ padding: "60px 16px", gap: 12 }}>
        <CheckCircle style={{ width: 48, height: 48, color: "#6B7280" }} />
        <p className="text-sm" style={{ color: "#9CA3AF" }}>No pending payments</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {pendingSplits.map((s) => (
        <PendingRow key={s.id} split={s} accounts={accounts as any[]} />
      ))}
      {pendingSettlements.map((s) => (
        <PendingSettlementRow key={s.id} settlement={s} accounts={accounts as any[]} />
      ))}
    </div>
  );
}

function PendingSettlementRow({ settlement, accounts }: { settlement: any; accounts: any[] }) {
  const qc = useQueryClient();
  const [accountId, setAccountId] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Only accounts whose type matches how the payment was made can receive it
  // (cash → cash, bank_transfer → bank, e-wallet → e-wallet).
  const allowedType = methodToAccountType[settlement.method as string];
  const filteredAccounts = allowedType ? accounts.filter((a) => a.type === allowedType) : accounts;
  const selectedAccount = filteredAccounts.find((a) => a.id === accountId);
  const settlerName = settlement.creator?.full_name ?? "Someone";
  const desc = settlement.splits?.description || "Settlement";
  const methodLabel = String(settlement.method ?? "transfer").replace("_", " ");
  // When the SETTLER was the creditor, the prompted party (me) is the DEBTOR: the money left
  // MY account, so record an outflow. Otherwise I'm the creditor recording an inflow.
  const iPaidOut = settlement.settler_is_creditor === true;

  async function confirmSelection() {
    if (!selectedAccount || saving) return;
    setSaving(true);
    try {
      // The receiver's account is credited by the settlement_receiver_balance DB trigger on this update.
      const { error } = await supabase
        .from("settlements")
        .update({
          receiver_account_id: selectedAccount.id,
          receiver_account_pending: false,
          receiver_confirmed_at: new Date().toISOString(),
        })
        .eq("id", settlement.id);
      if (error) throw error;

      qc.invalidateQueries({ queryKey: ["pending-settlements"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["settlements"] });
      qc.invalidateQueries({ queryKey: ["splits"] });
      toast.success("Account confirmed");
      setConfirmOpen(false);
    } catch (err: any) {
      toast.error(err.message ?? "Could not confirm");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl p-4 space-y-3" style={{ background: "#1A1A1A", border: "1px solid #2A2A2A" }}>
      {/* Line 1: description + amount (inflow green / outflow red) */}
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-white">{desc}</p>
        <span className="text-sm font-mono font-semibold shrink-0" style={{ color: iPaidOut ? "#EF4444" : "#10B981" }}>
          {iPaidOut ? "−" : "+"}{formatMoney(Number(settlement.amount))}
        </span>
      </div>

      {/* Line 2: direction + date */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs" style={{ color: "#9CA3AF" }}>
          {iPaidOut ? `You paid ${settlerName} via ${methodLabel}` : `${settlerName} paid you via ${methodLabel}`}
        </p>
        <span className="text-xs shrink-0" style={{ color: "#6B7280" }}>{format(new Date(settlement.created_at), "MMM d, yyyy")}</span>
      </div>

      {/* Line 3: receiving account dropdown + confirm */}
      {filteredAccounts.length === 0 ? (
        <p className="text-xs" style={{ color: "#9CA3AF" }}>
          No {allowedType ?? "matching"} accounts found — add one in the Accounts tab.
        </p>
      ) : (
        <div className="flex items-center gap-2">
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger className="flex-1"><SelectValue placeholder="Select account" /></SelectTrigger>
            <SelectContent>
              {filteredAccounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  <span className="flex items-center gap-2">
                    <AccountIcon iconType={a.icon_type} iconName={a.icon_name} iconColor={a.icon_color} iconUrl={a.icon_url} size={20} rounded="rounded-md" />
                    <span>{[a.institution, a.label].filter(Boolean).join(" · ")}</span>
                    <span className="text-muted-foreground">{formatMoney(Number(a.current_balance))}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button disabled={!accountId} onClick={() => setConfirmOpen(true)} className="text-white shrink-0" style={{ background: "#064E3B" }}>
            Confirm
          </Button>
        </div>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogTitle>Confirm Account Selection</DialogTitle>
          <DialogDescription>
            The amount {formatMoney(Number(settlement.amount))} will be {iPaidOut ? "deducted from" : "added to"}{" "}
            {selectedAccount ? [selectedAccount.institution, selectedAccount.label].filter(Boolean).join(" · ") : "the selected account"}. This cannot be changed later.
          </DialogDescription>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={confirmSelection} disabled={saving} className="text-white" style={{ background: "#064E3B" }}>
              {saving ? "Confirming…" : "Confirm"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PendingRow({ split, accounts }: { split: any; accounts: any[] }) {
  const qc = useQueryClient();
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [subCatId, setSubCatId] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // The payer (current user) picks their OWN category — the creator didn't set one for "other paid".
  const { data: categories = [] } = useQuery(categoriesQuery("expense"));
  const { data: subCategories = [] } = useQuery(subCategoriesQuery(categoryId || null));

  const selectedAccount = accounts.find((a) => a.id === accountId);
  const selectedCategory = (categories as any[]).find((c) => c.id === categoryId);
  const creatorName = split.creator?.full_name ?? "Someone";
  const ddStyle = { background: "#0A0A0A", borderColor: "#2A2A2A", color: "#FFFFFF" } as const;

  async function confirmSelection() {
    if (!selectedAccount || !categoryId || saving) return;
    setSaving(true);
    try {
      const { error: e1 } = await supabase
        .from("splits")
        .update({
          account_id: selectedAccount.id,
          account_pending: false,
          account_confirmed_at: new Date().toISOString(),
          category_id: categoryId,
          sub_category_id: subCatId || null,
        })
        .eq("id", split.id);
      if (e1) throw e1;

      const { error: e2 } = await supabase
        .from("accounts")
        .update({ current_balance: Number(selectedAccount.current_balance) - Number(split.total_amount) })
        .eq("id", selectedAccount.id);
      if (e2) throw e2;

      qc.invalidateQueries({ queryKey: ["pending-splits"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["splits"] });
      toast.success("Account confirmed");
      setConfirmOpen(false);
    } catch (err: any) {
      toast.error(err.message ?? "Could not confirm");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl p-4 space-y-3" style={{ background: "#1A1A1A", border: "1px solid #2A2A2A" }}>
      {/* Line 1: description + amount */}
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-white">{split.description || "Untitled"}</p>
        <span className="text-sm font-mono font-semibold shrink-0" style={{ color: "#F59E0B" }}>
          {formatMoney(Number(split.total_amount))}
        </span>
      </div>

      {/* Line 2: creator + date */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs" style={{ color: "#9CA3AF" }}>{creatorName} added this split</p>
        <span className="text-xs shrink-0" style={{ color: "#6B7280" }}>{format(new Date(split.created_at), "MMM d, yyyy")}</span>
      </div>

      {/* Line 3: category + sub-category (sub appears after a category is chosen) */}
      <div className="space-y-2">
        <Select value={categoryId} onValueChange={(v) => { setCategoryId(v); setSubCatId(""); }}>
          <SelectTrigger className="w-full" style={ddStyle}><SelectValue placeholder="Select category" /></SelectTrigger>
          <SelectContent>
            {(categories as any[]).map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ""}{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {categoryId && (
          <Select value={subCatId} onValueChange={setSubCatId}>
            <SelectTrigger className="w-full" style={ddStyle}><SelectValue placeholder="Sub-category (optional)" /></SelectTrigger>
            <SelectContent>
              {(subCategories as any[]).map((sc) => (
                <SelectItem key={sc.id} value={sc.id}>{sc.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Line 4: account dropdown + confirm */}
      <div className="flex items-center gap-2">
        <Select value={accountId} onValueChange={setAccountId}>
          <SelectTrigger className="flex-1" style={ddStyle}><SelectValue placeholder="Select account" /></SelectTrigger>
          <SelectContent>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                <span className="flex items-center gap-2">
                  <AccountIcon iconType={a.icon_type} iconName={a.icon_name} iconColor={a.icon_color} iconUrl={a.icon_url} size={20} rounded="rounded-md" />
                  <span>{[a.institution, a.label].filter(Boolean).join(" · ")}</span>
                  <span className="text-muted-foreground">{formatMoney(Number(a.current_balance))}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          disabled={!accountId || !categoryId}
          onClick={() => setConfirmOpen(true)}
          className="text-white shrink-0"
          style={{ background: "#78350F" }}
        >
          Confirm
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogTitle>Confirm Account Selection</DialogTitle>
          <DialogDescription>
            The amount {formatMoney(Number(split.total_amount))} will be deducted from{" "}
            {selectedAccount ? [selectedAccount.institution, selectedAccount.label].filter(Boolean).join(" · ") : "the selected account"}
            {selectedCategory ? ` under ${selectedCategory.name}` : ""}. This cannot be changed later.
          </DialogDescription>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={confirmSelection} disabled={saving} className="text-white" style={{ background: "#78350F" }}>
              {saving ? "Confirming…" : "Confirm"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold">
      {name[0]?.toUpperCase()}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground text-center py-8">{text}</p>;
}

