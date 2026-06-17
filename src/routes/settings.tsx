import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { profileQuery } from "@/lib/queries";
import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ChevronRight, Download, Upload, QrCode, ScanLine, Sun, Moon, LogOut, Pencil } from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import { QrScannerDialog } from "@/components/QrScannerDialog";
import { CURRENCY_PRESETS, setMoneyFormat } from "@/lib/format";
import { Link, useNavigate } from "react-router-dom";

export default function SettingsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | undefined>();
  const [email, setEmail] = useState<string | undefined>();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id);
      setEmail(data.user?.email ?? undefined);
    });
  }, []);

  const { data: profile } = useQuery(profileQuery(userId));
  const [qrOpen, setQrOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const updateProfile = useMutation({
    mutationFn: async (patch: Record<string, any>) => {
      if (!userId) throw new Error("Not signed in");
      const { error } = await supabase.from("profiles").update(patch as any).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
    onError: (e) => toast.error(e.message),
  });

  async function signOut() {
    await qc.cancelQueries(); qc.clear();
    await supabase.auth.signOut();
    navigate("/auth");
  }

  async function deleteAccount() {
    if (!userId || deleteConfirm !== "DELETE") return;
    const { data: blocked } = await supabase.rpc("has_unsettled_splits", { _user_id: userId });
    if (blocked) return toast.error("Settle all splits before deleting your account");
    const { error } = await supabase.from("profiles").delete().eq("id", userId);
    if (error) return toast.error(error.message);
    await supabase.auth.signOut();
    navigate("/auth");
  }

  async function handleScannedQr(text: string) {
    let payload: any;
    try { payload = JSON.parse(text); } catch { return toast.error("Not a valid QR code"); }
    if (payload?.app !== "cashflow") return toast.error("Not a CashFlow QR");
    const name = typeof payload.name === "string" ? payload.name.trim().slice(0, 80) : "";
    const phoneRaw = typeof payload.phone === "string" ? payload.phone.trim() : "";
    const phone = phoneRaw && /^\+?[0-9 ()-]{6,20}$/.test(phoneRaw) ? phoneRaw : null;
    if (!name && !phone) return toast.error("QR is missing name and phone");
    if (payload.id && payload.id === userId) return toast.error("That's your own QR");
    const { error } = await supabase.from("people").upsert(
      { name: name || "Friend", phone_number: phone, user_id: userId! },
      { onConflict: "user_id,phone_number", ignoreDuplicates: false },
    );
    if (error) return toast.error(error.message);
    toast.success(`Added ${name || phone}`);
    qc.invalidateQueries({ queryKey: ["people"] });
  }

  async function exportJson() {
    const tables = ["accounts","categories","sub_categories","transactions","people","groups","group_members","splits","split_shares","settlements","settlement_reminders","profiles"];
    const out: Record<string, any> = {};
    for (const t of tables) {
      const { data } = await supabase.from(t as any).select("*");
      out[t] = data ?? [];
    }
    download(`cashflow-${Date.now()}.json`, JSON.stringify(out, null, 2), "application/json");
    toast.success("Backup downloaded");
  }

  async function exportCsv() {
    const { data } = await supabase.from("transactions").select("date,time,type,amount,note,accounts:account_id(label),categories:category_id(name),sub_categories:sub_category_id(name)").order("date", { ascending: false });
    const rows = (data ?? []).map((t: any) => [t.date, t.time, t.type, t.amount, t.accounts?.label ?? "", t.categories?.name ?? "", t.sub_categories?.name ?? "", (t.note ?? "").replace(/"/g, '""')].map((v) => `"${v}"`).join(","));
    const csv = `date,time,type,amount,account,category,sub_category,note\n${rows.join("\n")}`;
    download(`transactions-${Date.now()}.csv`, csv, "text/csv");
  }

  async function importJson(file: File) {
    try {
      const json = JSON.parse(await file.text());
      const order = ["categories","sub_categories","accounts","people","groups","group_members","transactions","splits","split_shares","settlements","settlement_reminders"];
      for (const t of order) {
        if (Array.isArray(json[t]) && json[t].length) await supabase.from(t as any).upsert(json[t]);
      }
      toast.success("Imported");
      qc.invalidateQueries();
    } catch (err: any) { toast.error(err.message); }
  }

  const fullName = profile?.full_name ?? "";
  const phone = profile?.phone_number ?? "";
  const google = profile?.google_email ?? email ?? "—";
  const theme = (profile as any)?.theme ?? "dark";
  const currencyCode = (profile as any)?.currency_code ?? "LKR";
  const thousand = (profile as any)?.thousand_separator ?? ",";
  const decimals = (profile as any)?.decimal_places ?? 2;
  const notifySplits = (profile as any)?.notify_splits ?? true;
  const notifySettle = (profile as any)?.notify_settlement ?? true;
  const notifyDaily = (profile as any)?.notify_daily ?? false;
  const dailyTime = (profile as any)?.daily_reminder_time ?? "20:00";

  function pickCurrency(code: string) {
    const preset = CURRENCY_PRESETS.find((c) => c.code === code) ?? CURRENCY_PRESETS[0];
    const patch = {
      currency_code: preset.code,
      currency_symbol: preset.symbol,
      thousand_separator: preset.sep,
      decimal_places: preset.decimals,
    };
    setMoneyFormat({ symbol: preset.symbol, thousandSeparator: preset.sep, decimalPlaces: preset.decimals });
    updateProfile.mutate(patch);
  }

  return (
    <div className="px-4 pt-6 pb-24 space-y-6">
      <h1 className="text-xl font-semibold">Settings</h1>

      <Section label="Profile">
        <div className="p-4 flex items-start gap-4">
          <UserAvatar url={profile?.avatar_url} name={fullName || email} size={64} />
          <div className="flex-1 min-w-0 space-y-1">
            <p className="text-base font-semibold truncate">{fullName || "Add your name"}</p>
            <p className="text-sm text-muted-foreground truncate">{phone || "No phone number"}</p>
            <p className="text-xs text-muted-foreground truncate">{google}</p>
          </div>
        </div>
        <div className="px-4 pb-3 flex justify-end">
          <Link to="/settings/profile">
            <Button size="sm" variant="ghost" className="h-8 text-xs">
              <Pencil className="h-3 w-3 mr-1" /> Edit account
            </Button>
          </Link>
        </div>
      </Section>

      <Section label="QR code">
        <Row icon={<QrCode className="h-4 w-4" />} label="My code" onClick={() => setQrOpen(true)} />
        <Row icon={<ScanLine className="h-4 w-4" />} label="Scan code" onClick={() => setScanOpen(true)} />
      </Section>

      <Section label="Appearance">
        <div className="p-3 grid grid-cols-2 gap-2">
          <ThemeChoice active={theme === "dark"} icon={<Moon className="h-4 w-4" />} label="Dark" onClick={() => updateProfile.mutate({ theme: "dark" })} />
          <ThemeChoice active={theme === "light"} icon={<Sun className="h-4 w-4" />} label="Light" onClick={() => updateProfile.mutate({ theme: "light" })} />
        </div>
      </Section>

      <Section label="Currency format">
        <div className="p-4 space-y-4">
          <div className="space-y-1.5">
            <Label>Currency</Label>
            <Select value={currencyCode} onValueChange={pickCurrency}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CURRENCY_PRESETS.map((c) => (
                  <SelectItem key={c.code} value={c.code}>{c.code} — {c.symbol}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Thousand separator</Label>
            <Select value={thousand} onValueChange={(v) => { setMoneyFormat({ thousandSeparator: v as any }); updateProfile.mutate({ thousand_separator: v }); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value=",">Comma (1,234)</SelectItem>
                <SelectItem value=".">Period (1.234)</SelectItem>
                <SelectItem value=" ">Space (1 234)</SelectItem>
                <SelectItem value="">None (1234)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Decimal places</Label>
            <Select value={String(decimals)} onValueChange={(v) => { setMoneyFormat({ decimalPlaces: Number(v) }); updateProfile.mutate({ decimal_places: Number(v) }); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[0, 1, 2, 3].map((d) => <SelectItem key={d} value={String(d)}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Section>

      <Section label="Notifications">
        <ToggleRow label="Split notifications" checked={notifySplits} onChange={(v) => updateProfile.mutate({ notify_splits: v })} />
        <ToggleRow label="Settlement reminders" checked={notifySettle} onChange={(v) => updateProfile.mutate({ notify_settlement: v })} />
        <ToggleRow label="Daily expense reminder" checked={notifyDaily} onChange={(v) => updateProfile.mutate({ notify_daily: v })} />
        {notifyDaily && (
          <div className="p-4 flex items-center justify-between border-t border-border">
            <Label htmlFor="daily-time" className="text-sm">Reminder time</Label>
            <input
              id="daily-time"
              type="time"
              value={String(dailyTime).slice(0, 5)}
              onChange={(e) => updateProfile.mutate({ daily_reminder_time: e.target.value })}
              className="bg-secondary text-foreground rounded-md px-3 py-1.5 text-sm font-mono"
            />
          </div>
        )}
      </Section>

      <Section label="Data & backup">
        <Link to="/settings/history">
          <Row icon={<ChevronRight className="h-4 w-4" />} label="Transaction history" />
        </Link>
        <Row icon={<Download className="h-4 w-4" />} label="Export transactions (CSV)" onClick={exportCsv} />
        <Row icon={<Download className="h-4 w-4" />} label="Export full data (JSON)" onClick={exportJson} />
        <Row icon={<Upload className="h-4 w-4" />} label="Import from JSON" onClick={() => document.getElementById("import-json")?.click()} />
        <input id="import-json" type="file" accept="application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) importJson(f); }} />
      </Section>

      <div className="space-y-2">
        <Button variant="outline" className="w-full" onClick={signOut}>
          <LogOut className="h-4 w-4 mr-2" /> Sign out
        </Button>
        <button onClick={() => setDeleteOpen(true)} className="block w-full text-center text-xs text-expense underline-offset-4 hover:underline pt-1">
          Delete account
        </button>
      </div>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent>
          <DialogTitle>My QR</DialogTitle>
          <div className="flex flex-col items-center gap-3 p-4">
            <div className="bg-white p-4 rounded-xl">
              <QRCodeSVG value={JSON.stringify({ app: "cashflow", id: userId, name: fullName, phone })} size={200} />
            </div>
            <p className="text-xs text-muted-foreground text-center">Have a friend scan this to add you as a contact.</p>
          </div>
        </DialogContent>
      </Dialog>

      <QrScannerDialog open={scanOpen} onOpenChange={setScanOpen} onScan={handleScannedQr} />

      <Dialog open={deleteOpen} onOpenChange={(v) => { setDeleteOpen(v); if (!v) setDeleteConfirm(""); }}>
        <DialogContent>
          <DialogTitle>Delete account</DialogTitle>
          <p className="text-sm text-muted-foreground">This permanently deletes all your data. Type <b>DELETE</b> to confirm.</p>
          <Input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder="DELETE" className="mt-2" />
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled={deleteConfirm !== "DELETE"} onClick={deleteAccount}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2 px-1">{label}</p>
      <div className="surface-card divide-y divide-border overflow-hidden">{children}</div>
    </section>
  );
}

function Row({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 p-4 text-sm hover:bg-secondary/40 text-left">
      <span className="text-muted-foreground">{icon}</span>
      <span className="flex-1">{label}</span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between p-4">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function ThemeChoice({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-2 py-3 rounded-lg border text-sm transition-colors ${
        active ? "border-primary bg-primary/10 text-foreground" : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon} {label}
    </button>
  );
}

function download(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}