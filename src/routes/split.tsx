import { useQuery } from "@tanstack/react-query";
import { peopleQuery, groupsQuery, splitsQuery, incomingSplitsQuery } from "@/lib/queries";
import { Users, Plus, ChevronRight, Archive, QrCode, History } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AddPersonDialog } from "@/components/AddPersonDialog";
import { AddGroupDialog } from "@/components/AddGroupDialog";
import { QrScannerDialog } from "@/components/QrScannerDialog";
import { formatMoney } from "@/lib/format";
import { toast } from "sonner";
import { Link } from "react-router-dom";

export default function SplitPage() {
  const { data: people = [] } = useQuery(peopleQuery());
  const { data: groups = [] } = useQuery(groupsQuery());
  const { data: splits = [] } = useQuery(splitsQuery());
  const { data: incomingSplits = [] } = useQuery(incomingSplitsQuery());
  const [addPerson, setAddPerson] = useState(false);
  const [addGroup, setAddGroup] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanned, setScanned] = useState<{ name?: string; phone?: string } | undefined>();

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

  function personBalance(personId: string) {
    let owed = 0;
    for (const s of splits as any[]) {
      for (const sh of (s.split_shares ?? [])) {
        if (sh.person_id !== personId) continue;
        const settled = (s.settlements ?? []).filter((x: any) => x.split_share_id === sh.id)
          .reduce((a: number, x: any) => a + Number(x.amount), 0);
        owed += Number(sh.share_amount) - settled;
      }
    }
    const person = (people as any[]).find((p) => p.id === personId);
    if (person?.linked_user_id) {
      for (const s of incomingSplits as any[]) {
        if (s._createdByUserId !== person.linked_user_id) continue;
        const myPersonId = s._myPersonId;
        if (!myPersonId) continue;
        for (const sh of (s.split_shares ?? [])) {
          if (sh.person_id !== myPersonId) continue;
          const settled = (s.settlements ?? []).filter((x: any) => x.split_share_id === sh.id)
            .reduce((a: number, x: any) => a + Number(x.amount), 0);
          owed -= Number(sh.share_amount) - settled;
        }
      }
    }
    return owed;
  }

  return (
    <div className="px-4 pt-6 space-y-5 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Split</h1>
        <Link
          to="/settings/history?filter=split"
          className="h-9 w-9 flex items-center justify-center rounded-full bg-secondary text-foreground"
        >
          <History className="h-5 w-5" />
        </Link>
      </div>

      {/* People */}
      <Section title="People" action={
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => setScanOpen(true)}><QrCode className="h-4 w-4" /></Button>
          <Button size="sm" variant="ghost" onClick={() => { setScanned(undefined); setAddPerson(true); }}><Plus className="h-4 w-4" /></Button>
        </div>
      }>
        {people.length === 0 ? <Empty text="No people yet" /> : (
          <div className="divide-y divide-border">
            {(people as any[]).map((p) => {
              const bal = personBalance(p.id);
              return (
                <Link key={p.id} to={`/split/person/${p.id}`} className="flex items-center gap-3 p-4 active:bg-secondary/40">
                  <Avatar name={p.name} />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{p.name}{p.linked_user_id && " 🔗"}</p>
                    <p className="text-xs text-muted-foreground">{p.phone_number ?? "no phone"}</p>
                  </div>
                  {bal !== 0 && (
                    <span className={`text-sm font-mono font-semibold ${bal > 0 ? "text-income" : "text-expense"}`}>
                      {bal > 0 ? "+" : ""}{formatMoney(bal)}
                    </span>
                  )}
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              );
            })}
          </div>
        )}
      </Section>

      {/* Groups */}
      <Section title="Groups" action={
        <Button size="sm" variant="ghost" onClick={() => setAddGroup(true)}><Plus className="h-4 w-4" /></Button>
      }>
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
      </Section>

      <AddPersonDialog open={addPerson} onOpenChange={setAddPerson} initial={scanned} />
      <AddGroupDialog open={addGroup} onOpenChange={setAddGroup} />
      <QrScannerDialog open={scanOpen} onOpenChange={setScanOpen} onScan={handleScan} />
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

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2 px-1">
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{title}</p>
        {action}
      </div>
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">{children}</div>
    </div>
  );
}
