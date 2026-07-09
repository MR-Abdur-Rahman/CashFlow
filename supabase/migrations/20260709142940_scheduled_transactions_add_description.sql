-- A longer free-text description, separate from `note`. `note` is overloaded: scheduled.ts feeds it
-- into income_source_text when the schedule posts, so it can't double as a general description
-- without changing what lands on posted income transactions.
alter table public.scheduled_transactions
  add column if not exists description text;

comment on column public.scheduled_transactions.description is
  'Free-text description shown on the Scheduled Transactions list. Distinct from note, which becomes income_source_text on posted income transactions.';
