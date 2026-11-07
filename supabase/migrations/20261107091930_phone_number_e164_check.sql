-- Enforce canonical E.164 at the database level, on both phone columns.
--
-- Ordering matters and this is the LAST of the three phone migrations:
--   1. 20261107091347_normalise_phone_numbers_to_e164 — cleaned the 8 legacy rows, so no existing
--      row can fail validation here.
--   2. 20261107093000_harden_phone_writers_to_e164 — made handle_new_user(),
--      create_mutual_connection() and sync_group_member_connections() drop a non-E.164 value to
--      NULL instead of inserting it. Without that, this constraint would turn a bad phone into a
--      failed SIGN-UP (handle_new_user runs inside the auth.users INSERT transaction) or a failed
--      CONNECT, rather than a dropped field.
--   3. this file.
--
-- NULL stays allowed: phone is optional everywhere (and remains optional on Add Person).
-- Pattern: a leading '+', a non-zero first digit, then 6–14 more digits (E.164 allows at most 15
-- digits in total).

alter table public.profiles
  add constraint profiles_phone_number_e164
  check (phone_number is null or phone_number ~ '^\+[1-9][0-9]{6,14}$');

alter table public.people
  add constraint people_phone_number_e164
  check (phone_number is null or phone_number ~ '^\+[1-9][0-9]{6,14}$');
