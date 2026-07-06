import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Download, Upload } from "lucide-react";
import { SettingsHeader, Section, Row } from "@/components/SettingsRows";

function download(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function DataPage() {
  const qc = useQueryClient();

  async function exportJson() {
    const tables = [
      "accounts",
      "categories",
      "sub_categories",
      "transactions",
      "people",
      "groups",
      "group_members",
      "splits",
      "split_shares",
      "settlements",
      "settlement_reminders",
      "profiles",
    ];
    const out: Record<string, any> = {};
    for (const t of tables) {
      const { data } = await supabase.from(t as any).select("*");
      out[t] = data ?? [];
    }
    download(`cashflow-${Date.now()}.json`, JSON.stringify(out, null, 2), "application/json");
    toast.success("Backup downloaded");
  }

  async function exportCsv() {
    const { data } = await supabase
      .from("transactions")
      .select(
        "date,time,type,amount,note,accounts:account_id(label),categories:category_id(name),sub_categories:sub_category_id(name)",
      )
      .order("date", { ascending: false });
    const rows = (data ?? []).map((t: any) =>
      [
        t.date,
        t.time,
        t.type,
        t.amount,
        t.accounts?.label ?? "",
        t.categories?.name ?? "",
        t.sub_categories?.name ?? "",
        (t.note ?? "").replace(/"/g, '""'),
      ]
        .map((v) => `"${v}"`)
        .join(","),
    );
    const csv = `date,time,type,amount,account,category,sub_category,note\n${rows.join("\n")}`;
    download(`transactions-${Date.now()}.csv`, csv, "text/csv");
  }

  async function importJson(file: File) {
    try {
      const json = JSON.parse(await file.text());
      const order = [
        "categories",
        "sub_categories",
        "accounts",
        "people",
        "groups",
        "group_members",
        "transactions",
        "splits",
        "split_shares",
        "settlements",
        "settlement_reminders",
      ];
      for (const t of order) {
        if (Array.isArray(json[t]) && json[t].length) await supabase.from(t as any).upsert(json[t]);
      }
      toast.success("Imported");
      qc.invalidateQueries();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  return (
    <div className="px-4 pt-6 pb-24 space-y-6">
      <SettingsHeader title="Data & Backup" />
      <Section label="Data & backup">
        <Row
          icon={<Download className="h-4 w-4" />}
          label="Export transactions (CSV)"
          onClick={exportCsv}
        />
        <Row
          icon={<Download className="h-4 w-4" />}
          label="Export full data (JSON)"
          onClick={exportJson}
        />
        <Row
          icon={<Upload className="h-4 w-4" />}
          label="Import from JSON"
          onClick={() => document.getElementById("import-json")?.click()}
        />
        <input
          id="import-json"
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) importJson(f);
          }}
        />
      </Section>
    </div>
  );
}
