// Single source of truth for phone-number handling: parsing, validation and normalisation.
//
// Storage rule: the DB holds ONE canonical format — E.164 (`+94743303794`, no spaces, no doubled
// prefixes). Everything that writes a phone column must go through normalisePhone(); everything
// that compares phone numbers must normalise both sides first, so legacy rows and new rows can't
// mismatch.
//
// Uses the `mobile` metadata build: it validates mobile numbers only, which is what we want
// (an LK mobile is 9 digits starting with 7). The `min` build is NOT sufficient — it accepts
// landline-shaped input like `123456789` as a valid LK number and omits getType().
import {
  parsePhoneNumberFromString,
  getCountryCallingCode,
  type CountryCode,
} from "libphonenumber-js/mobile";

/** Default country for a fresh input. */
export const DEFAULT_COUNTRY: CountryCode = "LK";

/** Strip everything that isn't a digit. Used for the national-number box and for comparisons. */
export function digitsOnly(raw: string): string {
  return (raw ?? "").replace(/\D/g, "");
}

/**
 * National-number length expected for a country, derived from a known-good example rather than
 * hardcoded per country. Returns null when it can't be determined.
 */
function expectedNationalLength(country: CountryCode): number | null {
  // Build the shortest valid-looking probe by asking the library to parse increasing lengths is
  // expensive; instead rely on the metadata via a representative number when available.
  // LK and most countries have a single mobile length, which is all the hint text needs.
  const probe = EXAMPLE_NATIONAL[country];
  return probe ? probe.length : null;
}

// Representative national mobile numbers, used only to tell the user how many digits are expected.
// Validation itself is always done by libphonenumber-js, never by these lengths.
const EXAMPLE_NATIONAL: Partial<Record<CountryCode, string>> = {
  LK: "712345678",
  IN: "9123456789",
  GB: "7400123456",
  US: "2015550123",
  AE: "501234567",
  AU: "412345678",
  SG: "81234567",
  MY: "123456789",
  PK: "3012345678",
  BD: "1812345678",
};

/** Dial code for a country, as `+94`. */
export function dialCode(country: CountryCode): string {
  try {
    return `+${getCountryCallingCode(country)}`;
  } catch {
    return "";
  }
}

export type PhoneValidation = {
  valid: boolean;
  /** Machine-readable reason, null when valid. */
  reason: "empty" | "leading-zero" | "too-short" | "too-long" | "invalid" | null;
  /** Human-facing hint for the UI, null when valid. */
  message: string | null;
  /** How many digits the country expects, when known. */
  expected: number | null;
  /** How many digits the user has typed (national part). */
  entered: number;
};

/**
 * Validates a NATIONAL number (no country code, no leading 0) for the given country.
 *
 * A leading zero is reported rather than silently stripped — the user typed their local trunk
 * prefix and should be told the box wants the number without it. (Pasting a full number is a
 * different flow: see parsePasted, which does strip it.)
 */
export function validatePhone(national: string, country: CountryCode): PhoneValidation {
  const d = digitsOnly(national);
  const expected = expectedNationalLength(country);
  const countryName = COUNTRY_LABEL[country] ?? country;

  if (d === "") {
    return { valid: false, reason: "empty", message: null, expected, entered: 0 };
  }

  if (d.startsWith("0")) {
    const withoutZero = d.replace(/^0+/, "");
    const need =
      expected !== null && withoutZero.length !== expected
        ? ` ${countryName} numbers have ${expected} digits. You have ${withoutZero.length}.`
        : "";
    return {
      valid: false,
      reason: "leading-zero",
      message: `Remove the leading 0.${need}`,
      expected,
      entered: withoutZero.length,
    };
  }

  const parsed = parsePhoneNumberFromString(d, country);
  if (parsed?.isValid()) {
    return { valid: true, reason: null, message: null, expected, entered: d.length };
  }

  // Not valid — give a length-aware hint when we know the expected length.
  if (expected !== null && d.length !== expected) {
    return {
      valid: false,
      reason: d.length < expected ? "too-short" : "too-long",
      message: `${countryName} numbers have ${expected} digits. You have ${d.length}.`,
      expected,
      entered: d.length,
    };
  }
  return {
    valid: false,
    reason: "invalid",
    message: `That doesn't look like a valid ${countryName} mobile number.`,
    expected,
    entered: d.length,
  };
}

// Display names for hint text. Falls back to the ISO code for countries not listed.
const COUNTRY_LABEL: Partial<Record<CountryCode, string>> = {
  LK: "Sri Lanka",
  IN: "India",
  GB: "UK",
  US: "US",
  AE: "UAE",
  AU: "Australia",
  SG: "Singapore",
  MY: "Malaysia",
  PK: "Pakistan",
  BD: "Bangladesh",
};

/**
 * Normalises a national number + country to canonical E.164, or null when it isn't a valid
 * mobile number. This is the ONLY function that should produce a value for a phone column.
 */
export function normalisePhone(national: string, country: CountryCode): string | null {
  const d = digitsOnly(national);
  if (!d) return null;
  // Tolerate a trunk zero here: callers that care about warning the user run validatePhone first,
  // and normalising must never produce a wrong-but-plausible number.
  const parsed = parsePhoneNumberFromString(d.replace(/^0+/, ""), country);
  return parsed?.isValid() ? parsed.number : null;
}

export type ParsedPhone = { country: CountryCode; national: string };

/**
 * Parses a PASTED value that may be a full international number, and returns the country +
 * national part so the UI can fill the selector and show only the national digits.
 *
 * Handles `+94743303794`, `0094743303794` (the `00` international prefix, which
 * libphonenumber-js does not accept on its own) and, with a country hint, a local `0743303794`.
 *
 * A bare `94743303794` with no `+` is deliberately NOT treated as international — it's
 * ambiguous with a national number, so it stays national.
 */
export function parsePasted(raw: string, fallbackCountry: CountryCode = DEFAULT_COUNTRY): ParsedPhone | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;

  // Keep digits and a single leading +, then convert a `00` international prefix to `+`.
  let cleaned = trimmed.replace(/[^\d+]/g, "");
  const hadPlus = cleaned.startsWith("+");
  cleaned = (hadPlus ? "+" : "") + cleaned.replace(/\+/g, "");
  if (!hadPlus && cleaned.startsWith("00")) cleaned = `+${cleaned.slice(2)}`;

  if (cleaned.startsWith("+")) {
    const intl = parsePhoneNumberFromString(cleaned);
    if (intl?.country && intl.nationalNumber) {
      return { country: intl.country as CountryCode, national: String(intl.nationalNumber) };
    }
    return null;
  }

  // No `+`: treat as a national number for the current country, dropping any trunk zero.
  const national = digitsOnly(cleaned).replace(/^0+/, "");
  if (!national) return null;
  return { country: fallbackCountry, national };
}

/**
 * Parses a value as STORED in the DB into country + national parts.
 *
 * Accepts canonical E.164 and the legacy formats this app wrote before normalisation existed:
 * `"+94 743303794"` (space-joined) and `"+94 +94785533115"` / `"+94 +940779437678"` (a doubled
 * country-code prefix, caused by re-saving a full stored value back through the national box).
 * Repeated `+CC` prefixes and any trunk zero are stripped.
 */
export function parseStored(value: string | null | undefined): ParsedPhone | null {
  if (!value) return null;
  // Collapse to digits and `+` only; a legacy value may contain spaces.
  let s = value.replace(/[^\d+]/g, "");
  if (!s) return null;

  // Collapse repeated leading `+CC` prefixes (e.g. `+94+94785533115` -> `+94785533115`) by
  // dropping the FIRST copy and keeping the rest intact. Loop because the doubling could in
  // principle have compounded across several re-saves.
  for (let i = 0; i < 5; i++) {
    const m = /^\+(\d{1,4})\+\1/.exec(s);
    if (!m) break;
    s = s.slice(1 + m[1].length); // drop the leading `+CC`, leaving `+CC…`
  }
  // After collapsing, a value like `+940779437678` may still carry a trunk zero after the code.
  const direct = parsePhoneNumberFromString(s);
  if (direct?.country && direct.nationalNumber) {
    return { country: direct.country as CountryCode, national: String(direct.nationalNumber) };
  }

  // Retry: strip a trunk zero that sits immediately after the country code.
  const withPlus = /^\+(\d{1,4})0+(\d+)$/.exec(s);
  if (withPlus) {
    const retry = parsePhoneNumberFromString(`+${withPlus[1]}${withPlus[2]}`);
    if (retry?.country && retry.nationalNumber) {
      return { country: retry.country as CountryCode, national: String(retry.nationalNumber) };
    }
  }

  // Last resort (malformed/over-long legacy values): keep the digits so the user still sees what
  // was stored rather than silently losing it. Peel off a leading `+CC` when one is present so the
  // national box doesn't show the country code twice.
  const leading = /^\+(\d{1,4})(\d+)$/.exec(s);
  let rest = digitsOnly(s);
  let country: CountryCode = DEFAULT_COUNTRY;
  if (leading) {
    const guess = leading[1];
    const defaultCode = dialCode(DEFAULT_COUNTRY).replace("+", "");
    if (guess.startsWith(defaultCode) || defaultCode.startsWith(guess)) {
      rest = leading[2];
    } else {
      rest = digitsOnly(leading[2]);
      country = DEFAULT_COUNTRY;
    }
  }
  const national = rest.replace(/^0+/, "");
  return national ? { country, national } : null;
}

/** Pretty international form for display (`+94 74 330 3794`). Storage stays E.164. */
export function formatForDisplay(e164: string | null | undefined): string {
  if (!e164) return "";
  const parsed = parsePhoneNumberFromString(e164);
  return parsed?.isValid() ? parsed.formatInternational() : e164;
}

/**
 * Comparison key for a stored/entered phone: the E.164 digits with no `+`.
 * Normalises both legacy and canonical values so they can be compared or substring-searched.
 */
export function phoneCompareKey(value: string | null | undefined): string {
  if (!value) return "";
  const parsed = parseStored(value);
  if (!parsed) return digitsOnly(value);
  const e164 = normalisePhone(parsed.national, parsed.country);
  return e164 ? digitsOnly(e164) : digitsOnly(value);
}
