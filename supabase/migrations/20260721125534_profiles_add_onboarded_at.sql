-- Account-level flag for the guided-setup (name/photo/phone) flow. NULL = the user hasn't completed
-- setup yet; a timestamp = when they finished. Lives on profiles (not a localStorage flag) so the
-- "already onboarded" state syncs across every device the account signs in on.
alter table public.profiles
  add column if not exists onboarded_at timestamptz;

comment on column public.profiles.onboarded_at is
  'When the user completed guided setup (name/photo/phone). NULL means not yet onboarded. Account-level so it syncs across devices, unlike a per-device localStorage flag.';

-- profiles uses column-level grants (phone_number is deliberately revoked), so a new column is NOT
-- selectable by default — grant SELECT explicitly or profileQuery() errors. UPDATE is intentionally
-- left ungranted here: this phase only makes the column readable; the write path is a later phase.
grant select (onboarded_at) on public.profiles to anon, authenticated;
