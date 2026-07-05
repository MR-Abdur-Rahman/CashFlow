export type MoneyFormatConfig = {
  symbol: string;
  thousandSeparator: "," | "." | " " | "";
  decimalPlaces: number;
};

let cfg: MoneyFormatConfig = { symbol: "LKR", thousandSeparator: ",", decimalPlaces: 2 };

export function setMoneyFormat(next: Partial<MoneyFormatConfig>) {
  cfg = { ...cfg, ...next };
}
export function getMoneyFormat(): MoneyFormatConfig {
  return cfg;
}

function applySeparator(intPart: string, sep: string): string {
  if (sep === "") return intPart;
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

export function formatMoney(
  amount: number | string | null | undefined,
  currencyOverride?: string,
): string {
  const n = typeof amount === "string" ? Number(amount) : (amount ?? 0);
  const abs = Math.abs(n);
  const fixed = abs.toFixed(cfg.decimalPlaces);
  const [intRaw, decRaw] = fixed.split(".");
  const intFmt = applySeparator(intRaw, cfg.thousandSeparator);
  const formatted = decRaw ? `${intFmt}.${decRaw}` : intFmt;
  return `${n < 0 ? "-" : ""}${currencyOverride ?? cfg.symbol} ${formatted}`;
}

export function formatMoneyShort(amount: number | string | null | undefined): string {
  const n = typeof amount === "string" ? Number(amount) : (amount ?? 0);
  const abs = Math.abs(n);
  const fixed = abs.toFixed(cfg.decimalPlaces);
  const [intRaw, decRaw] = fixed.split(".");
  const intFmt = applySeparator(intRaw, cfg.thousandSeparator);
  const out = decRaw ? `${intFmt}.${decRaw}` : intFmt;
  return n < 0 ? `-${out}` : out;
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export const CURRENCY_PRESETS: Array<{
  code: string;
  symbol: string;
  sep: "," | "." | " ";
  decimals: number;
}> = [
  { code: "LKR", symbol: "LKR", sep: ",", decimals: 2 },
  { code: "USD", symbol: "$", sep: ",", decimals: 2 },
  { code: "EUR", symbol: "€", sep: ".", decimals: 2 },
  { code: "GBP", symbol: "£", sep: ",", decimals: 2 },
  { code: "INR", symbol: "₹", sep: ",", decimals: 2 },
  { code: "AED", symbol: "د.إ", sep: ",", decimals: 2 },
  { code: "JPY", symbol: "¥", sep: ",", decimals: 0 },
  { code: "AUD", symbol: "A$", sep: ",", decimals: 2 },
  { code: "CAD", symbol: "C$", sep: ",", decimals: 2 },
];
