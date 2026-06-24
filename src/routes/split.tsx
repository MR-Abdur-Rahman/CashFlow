import { useQuery } from "@tanstack/react-query";
import { peopleQuery, groupsQuery, splitBalancesQuery } from "@/lib/queries";
import { Users, Plus, ChevronRight, Archive, QrCode, History } from "lucide-react";
import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AddPersonDialog } from "@/components/AddPersonDialog";
import { AddGroupDialog } from "@/components/AddGroupDialog";
import { QrScannerDialog } from "@/components/QrScannerDialog";
import { formatMoney } from "@/lib/format";
import { toast } from "sonner";
import { Link } from "react-router-dom";

export default function SplitPage() {
  const { data: people = [] } = useQuery(peopleQuery());
  const { data: groups = [] } = useQuery(groupsQuery());
  const { data: balanceData } = useQuery(splitBalancesQuery());
  const allSplits = balanceData?.splits ?? [];
  const myPersonIds = balanceData?.myPersonIds ?? [];
  const currentUserId = balanceData?.currentUserId ?? null;
  const [addPerson, setAddPerson] = useState(false);
  const [addGroup, setAddGroup] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanned, setScanned] = useState<{ name?: string; phone?: string } | undefined>();
  const [tab, setTab] = useState<"people" | "groups" | "pending">("people");

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
    return bilateralBalance(allSplits, person, currentUserId, myPersonIds);
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
          <TabsTrigger value="pending">Pending</TabsTrigger>
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

        {/* Pending — placeholder until the account-selection system is built */}
        <TabsContent value="pending">
          <div className="rounded-2xl p-10 text-center" style={{ background: "#1A1A1A" }}>
            <p className="text-sm" style={{ color: "#9CA3AF" }}>No pending payments</p>
          </div>
        </TabsContent>
      </Tabs>

      <AddPersonDialog open={addPerson} onOpenChange={setAddPerson} initial={scanned} />
      <AddGroupDialog open={addGroup} onOpenChange={setAddGroup} />
      <QrScannerDialog open={scanOpen} onOpenChange={setScanOpen} onScan={handleScan} />
    </div>
  );
}

// Resolve a split's payer to an auth user id (creator paid / a participant paid / a third party).
function getPayerAuthId(split: any): string | null {
  if (split.paid_by_person_id) {
    const ps = (split.split_shares ?? []).find((ss: any) => ss.person_id === split.paid_by_person_id);
    if (ps?.person?.linked_user_id) return ps.person.linked_user_id;
  }
  if (split.paid_by === "me") return split.created_by; // "me" always means the creator
  if (split.paid_by) {
    const m = (split.split_shares ?? []).find((ss: any) => ss.person?.name === split.paid_by || ss.person_name === split.paid_by);
    if (m?.person?.linked_user_id) return m.person.linked_user_id;
  }
  return null;
}

// Bilateral net balance between current user and a target contact.
// Positive = target owes me; negative = I owe target. Third-party-paid splits are skipped.
function bilateralBalance(splits: any[], target: any, currentUserId: string | null, myPersonIds: string[]): number {
  let net = 0;
  const targetLui = target.linked_user_id;
  for (const s of splits) {
    const shares = (s.split_shares ?? []) as any[];
    const settlements = (s.settlements ?? []) as any[];
    const total = Number(s.total_amount);
    const sumShares = shares.reduce((a: number, sh: any) => a + Number(sh.share_amount), 0);
    const settledOf = (ss: any) => !ss ? 0 :
      settlements.filter((x: any) => x.split_share_id === ss.id).reduce((a: number, x: any) => a + Number(x.amount), 0);

    // Only count splits where the target is actually involved.
    const creatorIsTarget = !!targetLui && s.created_by === targetLui;
    const targetShareEntry = shares.find((ss: any) =>
      (targetLui && ss.person?.linked_user_id === targetLui) || ss.person_id === target.id);
    if (!creatorIsTarget && !targetShareEntry) continue;

    const payerAuthId = getPayerAuthId(s);
    const myShareEntry = shares.find((ss: any) =>
      myPersonIds.includes(ss.person_id) || ss.person?.linked_user_id === currentUserId);

    if (payerAuthId && payerAuthId === currentUserId) {
      // I paid → target owes me their share (or their implicit creator share)
      if (targetShareEntry) net += Number(targetShareEntry.share_amount) - settledOf(targetShareEntry);
      else if (creatorIsTarget) net += total - sumShares;
    } else if (payerAuthId && targetLui && payerAuthId === targetLui) {
      // Target paid → I owe my share (or my implicit creator share)
      if (myShareEntry) net -= Number(myShareEntry.share_amount) - settledOf(myShareEntry);
      else if (s.created_by === currentUserId) net -= total - sumShares;
    }
    // Third party paid → skip
  }
  return net;
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

