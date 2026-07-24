import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { profileQuery, myPhoneQuery } from "@/lib/queries";
import { UserAvatar } from "@/components/UserAvatar";
import { ImageCropDialog } from "@/components/ImageCropDialog";
import { WaterFillLogo } from "@/components/WaterFillLogo";
import { toast } from "sonner";
import {
  Camera,
  Image as ImageIcon,
  Trash2,
  Loader2,
  ArrowLeft,
  ChevronDown,
  Check,
  X,
} from "lucide-react";
import {
  usernameAvailable,
  usernameFormatError,
  setUsername as setUsernameRpc,
} from "@/lib/connections";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CountryPickerSheet } from "@/components/CountryPickerSheet";
import { COUNTRY_DIAL_CODES } from "@/lib/countries";
import { currencyFlag } from "@/lib/format";

// Like SplashScreen / auth.tsx, guided setup renders before PrefsApplier applies the theme, so the
// light-theme token values are hardcoded here instead of using var(--…). Keeps it reliably light.
const LIGHT = {
  bg: "oklch(0.99 0 0)",
  fg: "oklch(0.15 0 0)",
  muted: "oklch(0.45 0.01 286)",
  border: "oklch(0.9 0 0)",
};
const GRADIENT = "linear-gradient(135deg, #7C3AED 0%, #3B82F6 100%)";
const GRADIENT_H = "linear-gradient(90deg, #7C3AED 0%, #3B82F6 100%)";

export default function SetupPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState(0); // 0 = profile info, 1 = done

  const [userId, setUserId] = useState<string | undefined>();
  const [googlePicture, setGooglePicture] = useState<string | null>(null);
  const [metaName, setMetaName] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id);
      const meta = (data.user?.user_metadata ?? {}) as Record<string, unknown>;
      const pic = (meta.avatar_url ?? meta.picture) as string | undefined;
      setGooglePicture(pic ?? null);
      // Name from signup metadata (email signUp passes full_name; Google provides full_name/name).
      const nm = (meta.full_name ?? meta.name) as string | undefined;
      setMetaName(nm ?? null);
    });
  }, []);

  const { data: profile } = useQuery(profileQuery(userId));

  return (
    <div
      style={{
        background: LIGHT.bg,
        // .phone-frame already reserves the top safe-area via padding-top, and demands min-height:100dvh.
        // Adding a second 100dvh here would overflow the viewport by exactly the top inset (measured),
        // pushing the bottom button off-screen. Subtract that inset so the page fits the visible area,
        // and pad the bottom for the home-indicator inset.
        minHeight: "calc(100dvh - env(safe-area-inset-top))",
        paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))",
      }}
      className="flex flex-col px-6"
    >
      {/* Header: back button on its own row, 2-segment progress bar centered full-width below it. */}
      <div className="shrink-0 pt-4">
        <div className="flex h-9 items-center">
          {step >= 1 && (
            <button
              type="button"
              aria-label="Back"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              style={{ color: LIGHT.fg }}
              className="-ml-1 p-1"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
        </div>
        <div className="mt-3 flex items-center gap-2">
          {[0, 1].map((i) => (
            <span
              key={i}
              className="h-1.5 flex-1 rounded-full transition-all"
              style={{ background: i <= step ? GRADIENT_H : LIGHT.border }}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-1 flex-col min-h-0">
        {step === 0 && (
          <ProfileStep
            userId={userId}
            profile={profile}
            googlePicture={googlePicture}
            metaName={metaName}
            onContinue={() => setStep(1)}
          />
        )}
        {step === 1 && (
          <DoneStep
            onFinish={async () => {
              if (!userId) return navigate("/home");
              try {
                // Mark onboarded (account-level flag, syncs across devices). Invalidate the profile
                // query BEFORE navigating so the App.tsx onboarding gate sees the new value and doesn't
                // bounce back to /setup.
                const { error } = await supabase
                  .from("profiles")
                  .update({ onboarded_at: new Date().toISOString() })
                  .eq("id", userId);
                if (error) throw error;
                await qc.invalidateQueries({ queryKey: ["profile"] });
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Could not finish setup");
              }
              // Onboarded — hand off to the intro carousel, which ends on /home.
              navigate("/welcome");
            }}
          />
        )}
      </div>
    </div>
  );
}

// ─── Step 1: Profile (photo, name, username, phone) ─────────────────────────────
// Photo + full name + username + phone in one step. Required: full name + an available username.
// Optional: photo + phone. Reuses the account-edit pick → crop → upload pipeline for the avatar.
function ProfileStep({
  userId,
  profile,
  googlePicture,
  metaName,
  onContinue,
}: {
  userId: string | undefined;
  profile: any;
  googlePicture: string | null;
  metaName: string | null;
  onContinue: () => void;
}) {
  const qc = useQueryClient();
  const { data: myPhone } = useQuery(myPhoneQuery());
  const [photo, setPhoto] = useState<string | null | undefined>(undefined); // undefined = not inited
  const [name, setName] = useState<string | undefined>(undefined); // undefined = not inited
  const [username, setUsername] = useState("");
  const [uStatus, setUStatus] = useState<
    "idle" | "checking" | "available" | "taken" | "invalid"
  >("idle");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  // Phone (optional) — same country-code picker used elsewhere.
  const [country, setCountry] = useState("LK");
  const [code, setCode] = useState("+94");
  const [number, setNumber] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const phoneInited = useRef(false);
  const dialItems = COUNTRY_DIAL_CODES.map((c) => ({
    key: c.country,
    flag: currencyFlag(c.country),
    name: c.name,
    trailing: c.dial,
  }));
  useEffect(() => {
    if (!phoneInited.current && myPhone) {
      setNumber(myPhone);
      phoneInited.current = true;
    }
  }, [myPhone]);

  // Username availability (debounced). Starts blank; the user must choose an available one.
  const normUser = username.trim().toLowerCase();
  const uFormatErr = usernameFormatError(normUser);
  useEffect(() => {
    if (!normUser) {
      setUStatus("idle");
      return;
    }
    if (uFormatErr) {
      setUStatus("invalid");
      return;
    }
    setUStatus("checking");
    const h = setTimeout(async () => {
      try {
        setUStatus((await usernameAvailable(normUser)) ? "available" : "taken");
      } catch {
        setUStatus("idle");
      }
    }, 350);
    return () => clearTimeout(h);
  }, [normUser, uFormatErr]);

  // Prefill once: existing profile avatar, else the Google photo (so Google users see theirs already).
  useEffect(() => {
    if (photo === undefined && (profile !== undefined || googlePicture !== null)) {
      setPhoto((profile?.avatar_url as string | null) ?? googlePicture ?? null);
    }
  }, [photo, profile, googlePicture]);

  // Prefill the name the same way: existing profile name, else the signup/Google metadata name.
  useEffect(() => {
    if (name === undefined && (profile !== undefined || metaName !== null)) {
      setName((profile?.full_name as string | null) ?? metaName ?? "");
    }
  }, [name, profile, metaName]);

  function pickPhoto(f: File) {
    if (f.size > 5 * 1024 * 1024) return toast.error("Image must be under 5MB");
    setCropFile(f);
    setCropOpen(true);
  }
  async function uploadPhoto(blob: Blob) {
    if (!userId) return;
    setBusy(true);
    try {
      const path = `${userId}/avatar-${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, blob, { upsert: true, contentType: "image/jpeg" });
      if (upErr) throw upErr;
      const publicUrl = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", userId);
      if (error) throw error;
      setPhoto(publicUrl);
      toast.success("Photo updated");
      qc.invalidateQueries({ queryKey: ["profile"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function removePhoto() {
    if (!userId) return;
    setBusy(true);
    try {
      const { data: files } = await supabase.storage.from("avatars").list(userId);
      if (files?.length)
        await supabase.storage.from("avatars").remove(files.map((f) => `${userId}/${f.name}`));
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: null })
        .eq("id", userId);
      if (error) throw error;
      setPhoto(null);
      toast.success("Photo removed");
      qc.invalidateQueries({ queryKey: ["profile"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  const canContinue = !!(name ?? "").trim() && uStatus === "available";

  async function handleContinue() {
    if (!userId) return onContinue();
    if (!canContinue) return;
    setSaving(true);
    try {
      // Username first (unique) — aborts here if it was taken in a race.
      await setUsernameRpc(normUser);

      const updates: { avatar_url?: string; full_name: string; phone_number: string | null } = {
        full_name: (name ?? "").trim(),
        phone_number: number.trim() ? `${code.trim()} ${number.trim()}`.trim() : null,
      };
      // Persist the Google-prefill photo if it isn't on the row yet.
      if (photo && photo === googlePicture && profile && profile.avatar_url !== photo) {
        updates.avatar_url = photo;
      }
      const { error } = await supabase.from("profiles").update(updates).eq("id", userId);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["my-phone"] });
      onContinue();
    } catch (e: any) {
      toast.error(e.message ?? "Could not save profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center text-center min-h-0">
      <style>{`
        .setup-field {
          background: #FFFFFF;
          border: 1px solid ${LIGHT.border};
          color: ${LIGHT.fg};
          border-radius: 13px;
        }
        .setup-field::placeholder { color: #9CA3AF; }
        .setup-field:focus {
          outline: none;
          border-color: #7C3AED;
          box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.15);
        }
      `}</style>
      <div className="flex flex-1 flex-col items-center min-h-0 overflow-y-auto pt-2">
        <h1 className="text-2xl font-bold" style={{ color: LIGHT.fg }}>
          Set up your profile
        </h1>
        <p className="mt-1.5 text-sm" style={{ color: LIGHT.muted }}>
          Help friends recognize you when you split
        </p>

        {/* Tap-to-change avatar with gradient ring + camera badge (optional) */}
        <div className="mt-6">
          <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" disabled={busy} className="relative" aria-label="Change photo">
              <span
                className="block rounded-full"
                style={{ background: GRADIENT, padding: 4 }}
              >
                <span
                  className="block rounded-full"
                  style={{ background: LIGHT.bg, padding: 3 }}
                >
                  <UserAvatar url={photo ?? undefined} name={profile?.full_name ?? "You"} size={112} />
                </span>
              </span>
              <span
                className="absolute bottom-1 right-1 grid h-10 w-10 place-items-center rounded-full border-2 text-white"
                style={{ background: GRADIENT, borderColor: LIGHT.bg }}
              >
                {busy ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Camera className="h-5 w-5" />
                )}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center">
            <DropdownMenuItem onClick={() => cameraRef.current?.click()}>
              <Camera className="mr-2 h-4 w-4" /> Camera
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => galleryRef.current?.click()}>
              <ImageIcon className="mr-2 h-4 w-4" /> Gallery
            </DropdownMenuItem>
            {photo && (
              <DropdownMenuItem className="text-expense" onClick={removePhoto}>
                <Trash2 className="mr-2 h-4 w-4" /> Remove
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

        {/* Fields: Full name (required) → Username (required, unique) → Phone (optional) */}
        <div className="mt-6 w-full space-y-3 text-left">
          <input
            type="text"
            placeholder="Full name"
            value={name ?? ""}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            className="setup-field w-full px-4 py-3.5 text-sm"
          />

          <div>
            <div className="relative">
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="setup-field w-full px-4 py-3.5 pr-10 text-sm"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                {uStatus === "checking" && (
                  <Loader2 className="h-4 w-4 animate-spin" style={{ color: LIGHT.muted }} />
                )}
                {uStatus === "available" && <Check className="h-4 w-4 text-income" />}
                {(uStatus === "taken" || uStatus === "invalid") && (
                  <X className="h-4 w-4 text-expense" />
                )}
              </span>
            </div>
            {uStatus === "invalid" && uFormatErr && (
              <p className="mt-1 text-xs text-expense">{uFormatErr}</p>
            )}
            {uStatus === "taken" && (
              <p className="mt-1 text-xs text-expense">That username is taken.</p>
            )}
            {uStatus === "available" && <p className="mt-1 text-xs text-income">Available.</p>}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              aria-label="Select country code"
              onClick={() => setPickerOpen(true)}
              className="setup-field flex shrink-0 items-center gap-1.5 px-3 py-3.5 text-sm"
            >
              <span className="text-lg leading-none">{currencyFlag(country)}</span>
              <span>{code}</span>
              <ChevronDown className="h-4 w-4" style={{ color: LIGHT.muted }} />
            </button>
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="Phone number (optional)"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              className="setup-field flex-1 min-w-0 px-4 py-3.5 text-sm"
            />
          </div>
          <p className="text-xs" style={{ color: LIGHT.muted }}>
            Your number is never shown to other users unless you turn sharing on.
          </p>
        </div>

        <CountryPickerSheet
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          title="Choose country"
          searchPlaceholder="Search country or code"
          items={dialItems}
          selectedKey={country}
          onSelect={(iso) => {
            const c = COUNTRY_DIAL_CODES.find((x) => x.country === iso);
            if (c) {
              setCountry(c.country);
              setCode(c.dial);
            }
          }}
        />
      </div>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) pickPhoto(f);
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) pickPhoto(f);
        }}
      />
      <ImageCropDialog
        file={cropFile}
        open={cropOpen}
        onOpenChange={setCropOpen}
        onCropped={uploadPhoto}
      />

      <div className="w-full pt-4 shrink-0">
        <PrimaryButton onClick={handleContinue} disabled={saving || busy || !canContinue}>
          {saving ? "Saving…" : "Continue"}
        </PrimaryButton>
      </div>
    </div>
  );
}

// ─── Step 3: Done (logo water-fill) ──────────────────────────────────────────
function DoneStep({ onFinish }: { onFinish: () => void }) {
  const [finishing, setFinishing] = useState(false);
  return (
    <div className="flex flex-1 flex-col items-center text-center">
      <div className="flex flex-1 flex-col items-center justify-center">
        <WaterFillLogo />

        <h1 className="mt-8 text-2xl font-bold" style={{ color: LIGHT.fg }}>
          You're all set!
        </h1>
        <p className="mt-1.5 text-sm" style={{ color: LIGHT.muted }}>
          Your Cash account is ready — start adding transactions and splitting with friends.
        </p>
      </div>

      <div className="w-full pt-6 shrink-0">
        <PrimaryButton
          onClick={() => {
            if (finishing) return;
            setFinishing(true);
            onFinish();
          }}
          disabled={finishing}
        >
          {finishing ? "Please wait…" : "Go to CashFlow"}
        </PrimaryButton>
      </div>
    </div>
  );
}

// ─── Shared bits ─────────────────────────────────────────────────────────────
function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-xl py-3.5 text-sm font-semibold text-white disabled:opacity-60"
      style={{ background: GRADIENT_H }}
    >
      {children}
    </button>
  );
}
