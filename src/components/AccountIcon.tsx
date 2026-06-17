import { Wallet, Landmark, CreditCard, Coins, PiggyBank, Smartphone, Star, Banknote } from "lucide-react";

const PRESETS: Record<string, React.ComponentType<{ className?: string }>> = {
  wallet: Wallet,
  bank: Landmark,
  card: CreditCard,
  coin: Coins,
  piggy: PiggyBank,
  phone: Smartphone,
  star: Star,
  cash: Banknote,
};

export const PRESET_ICONS = Object.keys(PRESETS);
export const ICON_COLORS = ["#166534", "#1E3A5F", "#7C3AED", "#7F1D1D", "#78350F", "#0F766E", "#9333EA", "#B45309"];

export function AccountIcon({
  iconType,
  iconName,
  iconColor,
  iconUrl,
  fallback,
  size = 40,
  rounded = "rounded-xl",
}: {
  iconType?: string | null;
  iconName?: string | null;
  iconColor?: string | null;
  iconUrl?: string | null;
  fallback?: string;
  size?: number;
  rounded?: string;
}) {
  if (iconType === "upload" && iconUrl) {
    return <img src={iconUrl} alt="" style={{ width: size, height: size }} className={`${rounded} object-cover`} />;
  }
  const Icon = PRESETS[iconName ?? "wallet"] ?? Wallet;
  const bg = iconColor ?? "#7C3AED";
  return (
    <div
      style={{ width: size, height: size, backgroundColor: bg }}
      className={`${rounded} flex items-center justify-center text-white`}
    >
      {fallback ? (
        <span className="font-semibold">{fallback}</span>
      ) : (
        <Icon className="w-1/2 h-1/2" />
      )}
    </div>
  );
}
