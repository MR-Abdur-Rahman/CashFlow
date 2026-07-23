import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { profileQuery, myPhoneQuery } from "@/lib/queries";
import { UserAvatar } from "@/components/UserAvatar";
import { ImageCropDialog } from "@/components/ImageCropDialog";
import { toast } from "sonner";
import { Camera, Image as ImageIcon, Trash2, Loader2, ArrowLeft, ChevronDown } from "lucide-react";
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
  const [step, setStep] = useState(0); // 0 = photo, 1 = phone, 2 = done

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
      {/* Header: back button on its own row, 3-segment progress bar centered full-width below it. */}
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
          {[0, 1, 2].map((i) => (
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
          <PhotoStep
            userId={userId}
            profile={profile}
            googlePicture={googlePicture}
            metaName={metaName}
            onContinue={() => setStep(1)}
          />
        )}
        {step === 1 && <PhoneStep userId={userId} onContinue={() => setStep(2)} />}
        {step === 2 && (
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

// ─── Step 1: Profile photo ───────────────────────────────────────────────────
// Reuses the account-edit pick → crop → upload pipeline (same avatars bucket, same ImageCropDialog).
function PhotoStep({
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
  const [photo, setPhoto] = useState<string | null | undefined>(undefined); // undefined = not inited
  const [name, setName] = useState<string | undefined>(undefined); // undefined = not inited
  const [busy, setBusy] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

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

  async function handleContinue() {
    if (!userId) return onContinue();
    const trimmed = (name ?? "").trim();
    const updates: { avatar_url?: string; full_name?: string } = {};
    // Persist the Google-prefill photo if it isn't on the row yet (so they keep it without re-picking).
    if (photo && photo === googlePicture && profile && profile.avatar_url !== photo) {
      updates.avatar_url = photo;
    }
    // Save the (possibly edited) name; skip the write if unchanged from what's stored.
    if (trimmed && trimmed !== (profile?.full_name ?? "")) {
      updates.full_name = trimmed;
    }
    if (Object.keys(updates).length) {
      try {
        await supabase.from("profiles").update(updates).eq("id", userId);
        qc.invalidateQueries({ queryKey: ["profile"] });
      } catch {
        /* non-fatal — both are editable later in Settings */
      }
    }
    onContinue();
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
      <div className="flex flex-1 flex-col items-center justify-center min-h-0">
        <h1 className="text-2xl font-bold" style={{ color: LIGHT.fg }}>
          Set up your profile
        </h1>
        <p className="mt-1.5 text-sm" style={{ color: LIGHT.muted }}>
          Help friends recognize you when you split
        </p>

        {/* Tap-to-change avatar with gradient ring + camera badge */}
        <div className="mt-8">
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
                  <UserAvatar url={photo ?? undefined} name={profile?.full_name ?? "You"} size={128} />
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

        {/* Full name — pre-filled from signup/Google, editable. Photo stays optional (avatar menu). */}
        <input
          type="text"
          placeholder="Full name"
          value={name ?? ""}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          className="setup-field mt-6 w-full px-4 py-3.5 text-center text-sm"
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

      <div className="w-full pt-6 shrink-0">
        <PrimaryButton onClick={handleContinue} disabled={busy || !(name ?? "").trim()}>
          Continue
        </PrimaryButton>
      </div>
    </div>
  );
}

// ─── Step 2: Phone number ────────────────────────────────────────────────────
// Writes phone_number via the same direct profiles update account-edit uses (read stays via my_phone()).
function PhoneStep({
  userId,
  onContinue,
}: {
  userId: string | undefined;
  onContinue: () => void;
}) {
  const qc = useQueryClient();
  const { data: myPhone } = useQuery(myPhoneQuery());
  const [country, setCountry] = useState("LK"); // ISO code — drives the flag + dial code
  const [code, setCode] = useState("+94");
  const [number, setNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const inited = useRef(false);

  const dialItems = COUNTRY_DIAL_CODES.map((c) => ({
    key: c.country,
    flag: currencyFlag(c.country),
    name: c.name,
    trailing: c.dial,
  }));

  // Best-effort prefill if a number already exists (new users have none).
  useEffect(() => {
    if (!inited.current && myPhone) {
      setNumber(myPhone);
      inited.current = true;
    }
  }, [myPhone]);

  async function savePhone() {
    if (!userId) return onContinue();
    const combined = number.trim() ? `${code.trim()} ${number.trim()}`.trim() : null;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ phone_number: combined })
        .eq("id", userId);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["my-phone"] });
      onContinue();
    } catch (err: any) {
      toast.error(err.message ?? "Could not save number");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col text-center min-h-0">
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

      <div className="flex flex-1 flex-col justify-center min-h-0">
        <h1 className="text-2xl font-bold" style={{ color: LIGHT.fg }}>
          Add your phone number
        </h1>
        <p className="mt-1.5 text-sm" style={{ color: LIGHT.muted }}>
          So friends can find and connect with you
        </p>

        <div className="mt-10 flex gap-2 text-left">
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
            placeholder="Phone number"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            className="setup-field flex-1 px-4 py-3.5 text-sm"
          />
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

        <p className="mt-4 text-left text-xs" style={{ color: LIGHT.muted }}>
          Your number is never shown to other users unless you turn sharing on.
        </p>
      </div>

      <div className="w-full space-y-3 pt-6 shrink-0">
        <PrimaryButton onClick={savePhone} disabled={saving || !number.trim()}>
          {saving ? "Saving…" : "Continue"}
        </PrimaryButton>
        <SkipLink onClick={onContinue} />
      </div>
    </div>
  );
}

// ─── Step 3: Done (logo water-fill) ──────────────────────────────────────────
function DoneStep({ onFinish }: { onFinish: () => void }) {
  const [finishing, setFinishing] = useState(false);
  return (
    <div className="flex flex-1 flex-col items-center text-center">
      {/* Sea-wave liquid fill: the favicon.svg silhouette is used as a CSS mask over a rising
          purple→blue body, with three overlapping wave layers scrolling horizontally at different
          speeds/opacities so the surface reads like real ocean waves climbing to fill the logo. */}
      <style>{`
        .wl { position: relative; height: 96px; width: 96px; }
        .wl-base { position: absolute; inset: 0; height: 96px; width: 96px; opacity: 0.14; }
        .wl-mask {
          position: absolute; inset: 0; overflow: hidden;
          -webkit-mask: url(/favicon.svg) no-repeat center / contain;
          mask: url(/favicon.svg) no-repeat center / contain;
        }
        .wl-water {
          position: absolute; left: 0; width: 100%; height: 200px;
          top: calc(100% + 16px);
          background: linear-gradient(180deg, #7C3AED 0%, #3B82F6 100%);
          animation: wl-rise 2.2s cubic-bezier(0.45, 0, 0.15, 1) forwards;
        }
        @keyframes wl-rise { to { top: -14px; } }
        .wl-wave {
          position: absolute; bottom: 100%; left: 0; width: 200%; height: 16px;
          background-repeat: repeat-x; background-size: 50% 100%; will-change: transform;
        }
        .wl-wave-1 {
          height: 16px; opacity: 0.5; animation: wl-scroll 3.6s linear infinite;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 16' preserveAspectRatio='none'%3E%3Cpath d='M0 8 Q12 2 24 8 T48 8 T72 8 T96 8 V16 H0 Z' fill='%238B5CF6'/%3E%3C/svg%3E");
        }
        .wl-wave-2 {
          height: 14px; opacity: 0.75; animation: wl-scroll 2.9s linear infinite reverse;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 16' preserveAspectRatio='none'%3E%3Cpath d='M0 8 Q12 3 24 8 T48 8 T72 8 T96 8 V16 H0 Z' fill='%237C3AED'/%3E%3C/svg%3E");
        }
        .wl-wave-3 {
          height: 12px; opacity: 1; animation: wl-scroll 2.3s linear infinite;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 16' preserveAspectRatio='none'%3E%3Cpath d='M0 8 Q12 4 24 8 T48 8 T72 8 T96 8 V16 H0 Z' fill='%236D5EF0'/%3E%3C/svg%3E");
        }
        @keyframes wl-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @media (prefers-reduced-motion: reduce) {
          .wl-water { top: -14px; animation: none; }
          .wl-wave { animation: none; }
        }
      `}</style>
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="wl">
          <img src="/favicon.svg" alt="" aria-hidden="true" className="wl-base" />
          <div className="wl-mask">
            <div className="wl-water">
              <span className="wl-wave wl-wave-1" />
              <span className="wl-wave wl-wave-2" />
              <span className="wl-wave wl-wave-3" />
            </div>
          </div>
        </div>

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

function SkipLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-sm font-medium"
      style={{ color: LIGHT.muted }}
    >
      Skip for now
    </button>
  );
}
