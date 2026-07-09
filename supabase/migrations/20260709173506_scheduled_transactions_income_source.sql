-- Mirror the transactions table's income source fields so a scheduled income can carry a real
-- person/source instead of borrowing `note` as its label when it posts (see postScheduled).
alter table public.scheduled_transactions
  add column if not exists income_source_type text,
  add column if not exists income_person_id uuid references public.people(id) on delete set null,
  add column if not exists income_source_text text;

alter table public.scheduled_transactions
  drop constraint if exists scheduled_transactions_income_source_type_check;

alter table public.scheduled_transactions
  add constraint scheduled_transactions_income_source_type_check
  check (income_source_type is null or income_source_type in ('person', 'source'));

comment on column public.scheduled_transactions.income_source_type is
  'person | source — mirrors transactions.income_source_type. Null for expense/transfer schedules.';
