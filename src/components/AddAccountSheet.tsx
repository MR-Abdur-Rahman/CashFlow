import { useState, useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AccountIcon, PRESET_ICONS, ICON_COLORS } from "./AccountIcon";
import { ImageCropDialog } from "./ImageCropDialog";
import { cn } from "@/lib/utils";

type Account = {
  id?: string;
  type: string;
  institution: string | null;
  label: string;
  opening_balance: number | string;
  icon_type: string;
  icon_name: string | null;
  icon_color: string | null;
  icon_url: string | null;
};

export function AddAccountSheet({
  open,
  onOpenChange,
  edit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  edit?: any;
}) {
  const qc = useQueryClient();
  const [a, setA] = useState<Account>({
    type: "bank",
    institution: "",
    label: "",
    opening_balance: "0",
    icon_type: "preset",
    icon_name: "wallet",
    icon_color: ICON_COLORS[0],
    icon_url: null,
  });
  const [iconCropFile, setIconCropFile] = useState<File | null>(null);
  const [iconCropOpen, setIconCropOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      if (edit)
        setA({
          ...edit,
          institution: edit.institution ?? "",
          opening_balance: String(edit.opening_balance ?? 0),
        });
      else
        setA({
          type: "bank",
          institution: "",
          label: "",
          opening_balance: "0",
          icon_type: "preset",
          icon_name: "wallet",
          icon_color: ICON_COLORS[0],
          icon_url: null,
        });
    }
  }, [open, edit]);

  const mutation = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const payload = {
        type: a.type,
        institution: a.institution || null,
        label: a.label,
        opening_balance: Number(a.opening_balance) || 0,
        icon_type: a.icon_type,
        icon_name: a.icon_name,
        icon_color: a.icon_color,
        icon_url: a.icon_url,
      };
      if (edit?.id) {
        const { error } = await supabase.from("accounts").update(payload).eq("id", edit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("accounts")
          .insert({ ...payload, user_id: u.user.id, current_balance: payload.opening_balance });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(edit ? "Account updated" : "Account added");
      qc.invalidateQueries({ queryKey: ["accounts"] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(e.message),
  });

  async function uploadIcon(blob: Blob) {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    // Reuse the public "avatars" bucket (account-icons subfolder) — public URL, never expires.
    const path = `${u.user.id}/account-icons/${Date.now()}.jpg`;
    const { error } = await supabase.storage
      .from("avatars")
      .upload(path, blob, { upsert: true, contentType: "image/jpeg" });
    if (error) {
      toast.error(error.message);
      return;
    }
    const publicUrl = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
    setA((s) => ({ ...s, icon_type: "upload", icon_url: publicUrl }));
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="bg-card border-border rounded-t-3xl h-[85dvh] flex flex-col p-0"
      >
        <SheetTitle className="p-4 border-b border-border">
          {edit ? "Edit account" : "Add account"}
        </SheetTitle>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
          className="flex flex-col flex-1 min-h-0"
        >
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div className="flex justify-center">
              <AccountIcon
                iconType={a.icon_type}
                iconName={a.icon_name}
                iconColor={a.icon_color}
                iconUrl={a.icon_url}
                size={64}
              />
            </div>

            {/* Upload an image / select an icon — [+] uploads, rest are presets */}
            <div className="space-y-2">
              <Label>Upload an image / select icon</Label>
              <div className="grid grid-cols-8 gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  aria-label="Upload image"
                  className={cn(
                    "aspect-square rounded-lg border-2 border-dashed border-border grid place-items-center overflow-hidden",
                    a.icon_type === "upload" && "ring-2 ring-primary border-solid",
                  )}
                >
                  {a.icon_type === "upload" && a.icon_url ? (
                    <img src={a.icon_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Plus className="h-5 w-5 text-muted-foreground" />
                  )}
                </button>
                {PRESET_ICONS.map((name) => (
                  <button
                    type="button"
                    key={name}
                    onClick={() =>
                      setA((s) => ({ ...s, icon_type: "preset", icon_name: name, icon_url: null }))
                    }
                    className={cn(
                      "rounded-lg p-1.5",
                      a.icon_type === "preset" && a.icon_name === name && "ring-2 ring-primary",
                    )}
                  >
                    <AccountIcon
                      iconType="preset"
                      iconName={name}
                      iconColor={a.icon_color}
                      size={32}
                    />
                  </button>
                ))}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) {
                    setIconCropFile(f);
                    setIconCropOpen(true);
                  }
                }}
              />
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2 flex-wrap">
                {ICON_COLORS.map((c) => (
                  <button
                    type="button"
                    key={c}
                    onClick={() => setA((s) => ({ ...s, icon_color: c }))}
                    style={{ backgroundColor: c }}
                    className={cn(
                      "h-8 w-8 rounded-full",
                      a.icon_color === c && "ring-2 ring-offset-2 ring-offset-card ring-primary",
                    )}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                required
                value={a.label}
                onChange={(e) => setA((s) => ({ ...s, label: e.target.value }))}
                placeholder="e.g. HSBC"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Institution (optional)</Label>
              <Input
                value={a.institution ?? ""}
                onChange={(e) => setA((s) => ({ ...s, institution: e.target.value }))}
                placeholder="e.g. Saving account / Current Account"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={a.type} onValueChange={(v) => setA((s) => ({ ...s, type: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank">Bank</SelectItem>
                  <SelectItem value="e-wallet">E-wallet</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>{edit ? "Current balance (read-only)" : "Opening balance"}</Label>
              <Input
                inputMode="decimal"
                disabled={!!edit}
                value={edit ? edit.current_balance : String(a.opening_balance)}
                onChange={(e) =>
                  setA((s) => ({ ...s, opening_balance: e.target.value.replace(/[^\d.-]/g, "") }))
                }
              />
            </div>
          </div>
          <div className="p-4 border-t border-border">
            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {edit ? "Save" : "Add account"}
            </Button>
          </div>
        </form>
      </SheetContent>
      <ImageCropDialog
        file={iconCropFile}
        open={iconCropOpen}
        onOpenChange={setIconCropOpen}
        onCropped={uploadIcon}
      />
    </Sheet>
  );
}
