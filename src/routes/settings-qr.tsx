import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { profileQuery } from "@/lib/queries";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QrScannerDialog } from "@/components/QrScannerDialog";
import { SettingsHeader, Section } from "@/components/SettingsRows";

export default function QrPage() {
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | undefined>();
  const userIdRef = useRef<string | undefined>();
  const profileRef = useRef<any>(null);
  const [scanOpen, setScanOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id);
      userIdRef.current = data.user?.id;
    });
  }, []);

  const { data: profile } = useQuery(profileQuery(userId));
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  const fullName = profile?.full_name ?? "";
  const phone = profile?.phone_number ?? "";

  async function handleScannedQr(text: string) {
    let payload: any;
    try {
      payload = JSON.parse(text);
    } catch {
      return toast.error("Not a valid QR code");
    }
    if (payload?.app !== "cashflow") return toast.error("Not a CashFlow QR");

    const scannedName =
      typeof payload.name === "string" ? payload.name.trim().slice(0, 80) : "Friend";
    const phoneRaw = typeof payload.phone === "string" ? payload.phone.trim() : "";
    const scannedPhone = phoneRaw && /^\+?[0-9 ()-]{6,20}$/.test(phoneRaw) ? phoneRaw : null;
    const scannedUserId = typeof payload.id === "string" ? payload.id : null;

    if (!scannedUserId) return toast.error("QR is missing user ID");

    const currentUserId = userIdRef.current;
    if (!currentUserId) return toast.error("Not signed in");
    if (scannedUserId === currentUserId) return toast.error("That's your own QR");

    const currentProfile = profileRef.current;
    const myName = currentProfile?.full_name || "Friend";
    const myPhone = currentProfile?.phone_number || null;

    const { error } = await supabase.rpc("create_mutual_connection", {
      scanner_user_id: currentUserId,
      scanner_name: myName,
      scanner_phone: myPhone,
      scanned_user_id: scannedUserId,
      scanned_name: scannedName || "Friend",
      scanned_phone: scannedPhone,
    });

    if (error) return toast.error(error.message);

    toast.success(`Connected with ${scannedName || "friend"} 🔗`);
    qc.invalidateQueries({ queryKey: ["people"] });
    qc.invalidateQueries({ queryKey: ["splits"] });
  }

  return (
    <div className="px-4 pt-6 pb-24 space-y-6">
      <SettingsHeader title="QR Code" />

      <Section label="My code">
        <div className="flex flex-col items-center gap-3 p-5">
          <div className="bg-white p-4 rounded-xl">
            <QRCodeSVG
              value={JSON.stringify({
                app: "cashflow",
                id: userId,
                name: fullName,
                phone: phone || "",
              })}
              size={200}
            />
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Have a friend scan this to add you as a contact.
          </p>
        </div>
      </Section>

      <Button className="w-full" onClick={() => setScanOpen(true)}>
        <ScanLine className="h-4 w-4 mr-2" /> Scan code
      </Button>

      <QrScannerDialog open={scanOpen} onOpenChange={setScanOpen} onScan={handleScannedQr} />
    </div>
  );
}
