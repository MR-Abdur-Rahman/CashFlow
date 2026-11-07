import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { COUNTRY_DIAL_CODES } from "@/lib/countries";
import { currencyFlag } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  DEFAULT_COUNTRY,
  dialCode,
  digitsOnly,
  normalisePhone,
  parsePasted,
  parseStored,
  validatePhone,
} from "@/lib/phone";
import type { CountryCode } from "libphonenumber-js/mobile";

export type PhoneInputValue = { e164: string | null; valid: boolean };

/**
 * Country selector (flag + dial code) on the left, NATIONAL number on the right.
 *
 * The user never types the `+94` — it comes from the selector. Typing a leading 0 is NOT silently
 * stripped: an inline hint asks the user to remove it, so they learn the box wants the national
 * number. Pasting a full international number is the exception — that auto-detects the country and
 * strips the code / trunk zero, since a paste is clearly "here is my whole number".
 *
 * Reports `{ e164, valid }` upward; `e164` is always canonical E.164 or null. Validation and
 * normalisation both live in lib/phone.ts so this component holds no phone rules of its own.
 */
export function PhoneInput({
  value,
  onChange,
  optional = false,
  disabled = false,
  placeholder = "Phone number",
  inputClassName,
  triggerClassName,
  hintClassName,
}: {
  /** Stored value (canonical E.164, or a legacy space-joined value) to seed the fields from. */
  value?: string | null;
  onChange: (next: PhoneInputValue) => void;
  /** When true, an empty input counts as valid (used for optional fields like Add Person). */
  optional?: boolean;
  disabled?: boolean;
  placeholder?: string;
  inputClassName?: string;
  triggerClassName?: string;
  hintClassName?: string;
}) {
  const [country, setCountry] = useState<CountryCode>(DEFAULT_COUNTRY);
  const [national, setNational] = useState("");
  const [open, setOpen] = useState(false);
  // Seed from `value` only once per distinct incoming value, so typing is never clobbered by a
  // re-render carrying the old prop.
  const seeded = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (seeded.current === value) return;
    seeded.current = value;
    const parsed = parseStored(value);
    if (parsed) {
      setCountry(parsed.country);
      setNational(parsed.national);
    } else if (!value) {
      setNational("");
    }
  }, [value]);

  const validation = validatePhone(national, country);
  const isEmpty = digitsOnly(national) === "";
  const valid = isEmpty ? optional : validation.valid;

  // Report upward whenever the resolved value changes.
  const lastReported = useRef<string>("");
  useEffect(() => {
    const e164 = valid && !isEmpty ? normalisePhone(national, country) : null;
    const key = `${e164}|${valid}`;
    if (key === lastReported.current) return;
    lastReported.current = key;
    onChange({ e164, valid });
  }, [national, country, valid, isEmpty, onChange]);

  const selected = COUNTRY_DIAL_CODES.find((c) => c.country === country);
  const code = selected?.dial ?? dialCode(country);
  // Hide the hint until the user has actually typed something.
  const hint = isEmpty ? null : validation.message;

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              aria-label="Select country code"
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm outline-none disabled:opacity-50",
                triggerClassName,
              )}
            >
              <span className="text-base leading-none">{currencyFlag(country)}</span>
              <span className="font-mono">{code}</span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-[260px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search country or code" />
              <CommandList>
                <CommandEmpty>No country found.</CommandEmpty>
                <CommandGroup>
                  {COUNTRY_DIAL_CODES.map((c) => (
                    <CommandItem
                      key={c.country}
                      // Include the dial code so searching "+94" or "94" finds Sri Lanka.
                      value={`${c.name} ${c.dial} ${c.country}`}
                      onSelect={() => {
                        setCountry(c.country as CountryCode);
                        setOpen(false);
                      }}
                    >
                      <span className="text-base leading-none">{currencyFlag(c.country)}</span>
                      <span className="flex-1 truncate">{c.name}</span>
                      <span className="font-mono text-xs text-muted-foreground">{c.dial}</span>
                      {c.country === country && <Check className="h-4 w-4 text-income" />}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          disabled={disabled}
          placeholder={placeholder}
          value={national}
          // Digits only: strips letters, spaces, `+` and any other punctuation as the user types.
          onChange={(e) => setNational(digitsOnly(e.target.value))}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text");
            const parsed = parsePasted(text, country);
            if (parsed) {
              e.preventDefault();
              setCountry(parsed.country);
              setNational(parsed.national);
            }
          }}
          className={cn(
            "min-w-0 flex-1 rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm outline-none focus:border-primary disabled:opacity-50",
            hint && "border-expense focus:border-expense",
            inputClassName,
          )}
        />
      </div>
      {hint && <p className={cn("text-[11px] text-expense", hintClassName)}>{hint}</p>}
    </div>
  );
}
