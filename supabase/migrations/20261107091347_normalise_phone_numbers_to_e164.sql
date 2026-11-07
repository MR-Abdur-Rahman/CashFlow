-- Data cleanup: bring every stored phone number to canonical E.164 (`+94743303794`).
--
-- Why these values exist: the app used to save `phone_number` as a country-code string joined to a
-- free-text box with a space (`'+94' || ' ' || number`), and the profile-edit prefill put the whole
-- stored value back into the national box — so re-saving produced a doubled prefix
-- (`+94 +94785533115`). There was no length or format validation at all, which is how a 20-digit
-- value got in. The client now writes only E.164 (see src/lib/phone.ts, commit f75bd26).
--
-- Value-by-value UPDATEs rather than a regex sweep: the set is small, fully known, and was
-- re-verified against live data immediately before this migration was written. Each target was
-- produced by libphonenumber-js (mobile metadata) and the 7 results are mutually distinct, so the
-- existing UNIQUE constraint on profiles.phone_number cannot be violated.
--
-- public.people has zero non-null phone_number rows, so it needs no data fix.

-- 1) Plain space-joined values: drop the space.
update public.profiles set phone_number = '+94712818282' where phone_number = '+94 712818282';
update public.profiles set phone_number = '+94743303794' where phone_number = '+94 743303794';
update public.profiles set phone_number = '+94770276644' where phone_number = '+94 770276644';
update public.profiles set phone_number = '+94779839397' where phone_number = '+94 779839397';
update public.profiles set phone_number = '+94789495079' where phone_number = '+94 789495079';

-- 2) Doubled country-code prefix: keep one '+94', drop the duplicate.
update public.profiles set phone_number = '+94785533115' where phone_number = '+94 +94785533115';

-- 3) Doubled prefix AND a trunk zero after the country code ('+94 +94 0779437678').
update public.profiles set phone_number = '+94779437678' where phone_number = '+94 +940779437678';

-- 4) Unrecoverable: 20 digits, no valid interpretation. Cleared so the column can be constrained;
--    the PROFILE ITSELF IS KEPT. The user can re-enter a number through the validated input.
update public.profiles set phone_number = null where phone_number = '+94 75206464999595948484';
