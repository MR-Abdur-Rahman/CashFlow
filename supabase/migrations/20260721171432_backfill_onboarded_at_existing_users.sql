-- Backfill onboarded_at for accounts that predate the guided-setup feature. The onboarded_at column
-- was added in 20260721125534; every profile created before that couldn't possibly have completed the
-- new setup flow, so they sit at NULL and the App.tsx onboarding gate wrongly funnels them into /setup
-- on sign-in (reported as "sign in behaves like sign up"). These users have already been using the app,
-- so mark them onboarded (as of account creation). New sign-ups still get NULL → /setup, unchanged.
update public.profiles
set onboarded_at = created_at
where onboarded_at is null
  and created_at < '2026-07-21 12:55:34+00';
