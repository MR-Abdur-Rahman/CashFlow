import { format } from "date-fns";

// "MMM dd, yyyy · hh:mm a" from a date (YYYY-MM-DD) + optional time (HH:mm).
export function formatDateTime(date?: string, time?: string): string {
  if (!date) return "";
  const t = time?.slice(0, 5) ?? "00:00";
  return format(new Date(`${date}T${t}`), "MMM dd, yyyy · hh:mm a");
}

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

export type CurrencyPreset = {
  code: string; // ISO 4217
  symbol: string;
  name: string; // country / region — shown in the picker
  country: string; // ISO 3166-1 alpha-2, for the flag emoji
  sep: "," | "." | " ";
  decimals: number;
};

// Emoji flag from an ISO 3166-1 alpha-2 code (two regional-indicator letters).
export function currencyFlag(country: string): string {
  return country
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .replace(/./g, (c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65));
}

export const CURRENCY_PRESETS: CurrencyPreset[] = [
  { code: "LKR", symbol: "LKR", name: "Sri Lanka", country: "LK", sep: ",", decimals: 2 },
  { code: "USD", symbol: "$", name: "United States", country: "US", sep: ",", decimals: 2 },
  { code: "EUR", symbol: "€", name: "European Union", country: "EU", sep: ".", decimals: 2 },
  { code: "GBP", symbol: "£", name: "United Kingdom", country: "GB", sep: ",", decimals: 2 },
  { code: "INR", symbol: "₹", name: "India", country: "IN", sep: ",", decimals: 2 },
  { code: "AED", symbol: "د.إ", name: "United Arab Emirates", country: "AE", sep: ",", decimals: 2 },
  { code: "JPY", symbol: "¥", name: "Japan", country: "JP", sep: ",", decimals: 0 },
  { code: "AUD", symbol: "A$", name: "Australia", country: "AU", sep: ",", decimals: 2 },
  { code: "CAD", symbol: "C$", name: "Canada", country: "CA", sep: ",", decimals: 2 },
  { code: "CNY", symbol: "¥", name: "China", country: "CN", sep: ",", decimals: 2 },
  { code: "CHF", symbol: "Fr", name: "Switzerland", country: "CH", sep: ",", decimals: 2 },
  { code: "HKD", symbol: "HK$", name: "Hong Kong", country: "HK", sep: ",", decimals: 2 },
  { code: "SGD", symbol: "S$", name: "Singapore", country: "SG", sep: ",", decimals: 2 },
  { code: "NZD", symbol: "NZ$", name: "New Zealand", country: "NZ", sep: ",", decimals: 2 },
  { code: "SEK", symbol: "kr", name: "Sweden", country: "SE", sep: ",", decimals: 2 },
  { code: "NOK", symbol: "kr", name: "Norway", country: "NO", sep: ",", decimals: 2 },
  { code: "DKK", symbol: "kr", name: "Denmark", country: "DK", sep: ",", decimals: 2 },
  { code: "ZAR", symbol: "R", name: "South Africa", country: "ZA", sep: ",", decimals: 2 },
  { code: "BRL", symbol: "R$", name: "Brazil", country: "BR", sep: ",", decimals: 2 },
  { code: "MXN", symbol: "Mex$", name: "Mexico", country: "MX", sep: ",", decimals: 2 },
  { code: "RUB", symbol: "₽", name: "Russia", country: "RU", sep: ",", decimals: 2 },
  { code: "KRW", symbol: "₩", name: "South Korea", country: "KR", sep: ",", decimals: 0 },
  { code: "TRY", symbol: "₺", name: "Turkey", country: "TR", sep: ",", decimals: 2 },
  { code: "SAR", symbol: "﷼", name: "Saudi Arabia", country: "SA", sep: ",", decimals: 2 },
  { code: "QAR", symbol: "﷼", name: "Qatar", country: "QA", sep: ",", decimals: 2 },
  { code: "KWD", symbol: "د.ك", name: "Kuwait", country: "KW", sep: ",", decimals: 3 },
  { code: "BHD", symbol: ".د.ب", name: "Bahrain", country: "BH", sep: ",", decimals: 3 },
  { code: "OMR", symbol: "﷼", name: "Oman", country: "OM", sep: ",", decimals: 3 },
  { code: "PKR", symbol: "₨", name: "Pakistan", country: "PK", sep: ",", decimals: 2 },
  { code: "BDT", symbol: "৳", name: "Bangladesh", country: "BD", sep: ",", decimals: 2 },
  { code: "NPR", symbol: "₨", name: "Nepal", country: "NP", sep: ",", decimals: 2 },
  { code: "IDR", symbol: "Rp", name: "Indonesia", country: "ID", sep: ",", decimals: 0 },
  { code: "MYR", symbol: "RM", name: "Malaysia", country: "MY", sep: ",", decimals: 2 },
  { code: "THB", symbol: "฿", name: "Thailand", country: "TH", sep: ",", decimals: 2 },
  { code: "PHP", symbol: "₱", name: "Philippines", country: "PH", sep: ",", decimals: 2 },
  { code: "VND", symbol: "₫", name: "Vietnam", country: "VN", sep: ",", decimals: 0 },
  { code: "EGP", symbol: "E£", name: "Egypt", country: "EG", sep: ",", decimals: 2 },
  { code: "NGN", symbol: "₦", name: "Nigeria", country: "NG", sep: ",", decimals: 2 },
  { code: "KES", symbol: "KSh", name: "Kenya", country: "KE", sep: ",", decimals: 2 },
  { code: "GHS", symbol: "₵", name: "Ghana", country: "GH", sep: ",", decimals: 2 },
  { code: "MAD", symbol: "د.م.", name: "Morocco", country: "MA", sep: ",", decimals: 2 },
  { code: "ILS", symbol: "₪", name: "Israel", country: "IL", sep: ",", decimals: 2 },
  { code: "PLN", symbol: "zł", name: "Poland", country: "PL", sep: ",", decimals: 2 },
  { code: "CZK", symbol: "Kč", name: "Czechia", country: "CZ", sep: ",", decimals: 2 },
  { code: "HUF", symbol: "Ft", name: "Hungary", country: "HU", sep: ",", decimals: 0 },
  { code: "RON", symbol: "lei", name: "Romania", country: "RO", sep: ",", decimals: 2 },
  { code: "UAH", symbol: "₴", name: "Ukraine", country: "UA", sep: ",", decimals: 2 },
  { code: "CLP", symbol: "$", name: "Chile", country: "CL", sep: ",", decimals: 0 },
  { code: "COP", symbol: "$", name: "Colombia", country: "CO", sep: ",", decimals: 2 },
  { code: "ARS", symbol: "$", name: "Argentina", country: "AR", sep: ",", decimals: 2 },
  { code: "PEN", symbol: "S/", name: "Peru", country: "PE", sep: ",", decimals: 2 },
  { code: "IQD", symbol: "ع.د", name: "Iraq", country: "IQ", sep: ",", decimals: 3 },
  { code: "JOD", symbol: "د.ا", name: "Jordan", country: "JO", sep: ",", decimals: 3 },
  { code: "LBP", symbol: "ل.ل", name: "Lebanon", country: "LB", sep: ",", decimals: 2 },
  { code: "TWD", symbol: "NT$", name: "Taiwan", country: "TW", sep: ",", decimals: 2 },
  { code: "ISK", symbol: "kr", name: "Iceland", country: "IS", sep: ",", decimals: 0 },
  { code: "BGN", symbol: "лв", name: "Bulgaria", country: "BG", sep: ",", decimals: 2 },
  { code: "RSD", symbol: "дин", name: "Serbia", country: "RS", sep: ",", decimals: 2 },
  { code: "MMK", symbol: "K", name: "Myanmar", country: "MM", sep: ",", decimals: 2 },
  { code: "KHR", symbol: "៛", name: "Cambodia", country: "KH", sep: ",", decimals: 2 },
  { code: "LAK", symbol: "₭", name: "Laos", country: "LA", sep: ",", decimals: 2 },
  { code: "ETB", symbol: "Br", name: "Ethiopia", country: "ET", sep: ",", decimals: 2 },
  { code: "TZS", symbol: "TSh", name: "Tanzania", country: "TZ", sep: ",", decimals: 2 },
  { code: "UGX", symbol: "USh", name: "Uganda", country: "UG", sep: ",", decimals: 0 },
  { code: "DZD", symbol: "دج", name: "Algeria", country: "DZ", sep: ",", decimals: 2 },
  { code: "TND", symbol: "د.ت", name: "Tunisia", country: "TN", sep: ",", decimals: 3 },
  { code: "MUR", symbol: "₨", name: "Mauritius", country: "MU", sep: ",", decimals: 2 },
  { code: "MVR", symbol: "Rf", name: "Maldives", country: "MV", sep: ",", decimals: 2 },
  { code: "AFN", symbol: "؋", name: "Afghanistan", country: "AF", sep: ",", decimals: 2 },
  { code: "YER", symbol: "﷼", name: "Yemen", country: "YE", sep: ",", decimals: 2 },
  { code: "XOF", symbol: "CFA", name: "West African CFA", country: "SN", sep: ",", decimals: 0 },
  { code: "XAF", symbol: "FCFA", name: "Central African CFA", country: "CM", sep: ",", decimals: 0 },
];
