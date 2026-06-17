import { useQuery } from "@tanstack/react-query";
import { personQuery, personSplitsQuery } from "@/lib/queries";
import { ArrowLeft, Bell, Plus } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { ShareList } from "@/components/ShareList";
import { Button } from "@/components/ui/button";
import { SendReminderDialog } from "@/components/SendReminderDialog";
import { AddTransactionSheet } from "@/components/AddTransactionSheet";
import { SettleUpDialog } from "@/components/SettleUpDialog";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

export default function PersonDetail() {
  const { personId } = useParams<{ personId: string }>();
  const { data: person } = useQuery(personQuery(personId!));
  const { data: splits = [] } = useQuery(personSplitsQuery(personId!));
  const [reminderOpen, setReminderOpen] = useState(false);
  const [addSplitOpen, setAddSplitOpen] = useState(false);
  const [settleOpen, setSettleOpen] = useState(false);

  const totals = splits.reduce((acc, s: any) => {
    for (const sh of (s.split_shares ?? [])) {
      if (sh.person_id !== personId) continue;
      const settled = (s.settlements ?? []).filter((x: any) => x.split_share_id === sh.id).reduce((a: number, x: any) => a + Number(x.amount), 0);
      acc.owed += Number(sh.share_amount);
      acc.paid += settled;
    }
    return acc;
  }, { owed: 0, paid: 0 });

  const balance = totals.owed - totals.paid;

  // Find first unsettled share for settle up
  const firstUnsettledShare = splits.flatMap((s: any) =>
    (s.split_shares ?? []).filter((sh: any) => sh.person_id === personId && !sh.is_settled)
      .map((sh: any) => ({ share: sh, split: s }))
  )[0];

  if (!person) return <div className="p-6">Person not found</div>;

  return (
    <div className="px-4 pt-4 pb-24 space-y-5">
      <Link to="/split" className="inline-flex items-center text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4 mr-1" /> Split
      </Link>

      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-lg">
          {person.name[0]?.toUpperCase()}
        </div>
        <div>
          <h1 className="text-xl font-semibold">{person.name}</h1>
          <p className="text-xs text-muted-foreground">{person.phone_number ?? "no phone"}{person.linked_user_id && " · 🔗 linked"}</p>
        </div>
      </div>

      <div className="balance-gradient rounded-2xl p-5">
        <p className="text-xs font-mono text-white/70 uppercase">Net balance</p>
        <p className="text-3xl font-mono font-bold text-white mt-1">{balance >= 0 ? "+" : ""}{formatMoney(balance)}</p>
        <p className="text-xs font-mono text-white/70 mt-1">{balance > 0 ? "owes you" : balance < 0 ? "you owe" : "settled"}</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" className="w-full" onClick={() => setAddSplitOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Add Split
        </Button>
        {firstUnsettledShare && (
          <Button variant="outline" className="w-full text-income" onClick={() => setSettleOpen(true)}>
            Settle Up
          </Button>
        )}
      </div>

      {balance > 0 && (
        <Button variant="outline" className="w-full" onClick={() => setReminderOpen(true)}>
          <Bell className="h-4 w-4 mr-2" /> Send reminder
        </Button>
      )}

      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2 px-1">Splits</p>
        <ShareList splits={splits} personId={personId} />
      </div>

      {splits[0] && (
        <SendReminderDialog
          open={reminderOpen}
          onOpenChange={setReminderOpen}
          person={{ id: person.id, name: person.name, phone_number: person.phone_number }}
          splitId={(splits[0] as any).id}
          amount={balance}
          description={(splits[0] as any).description}
        />
      )}

      <AddTransactionSheet
        open={addSplitOpen}
        onOpenChange={setAddSplitOpen}
        defaultTab="split"
      />

      {firstUnsettledShare && (
        <SettleUpDialog
          open={settleOpen}
          onOpenChange={setSettleOpen}
          share={firstUnsettledShare.share}
          split={firstUnsettledShare.split}
        />
      )}
    </div>
  );
}